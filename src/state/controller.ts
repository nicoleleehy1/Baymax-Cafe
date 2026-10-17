// Glue between the authoritative simulation, the planning/learning worker, persistence and UI.
// The render loop calls `advance(dt)`; renderers read `prevFrame`/`curFrame`/`alpha` directly.
import type { PlanResult } from '../core/types';
import { exampleFromQuery } from '../eval/runner';
import { createModel, isCompatible } from '../learning/model';
import { listRuns, loadModel, saveModel, saveRun } from '../persistence/db';
import { SIM_DT, SimEngine } from '../sim/engine';
import type { Frame } from '../sim/metrics';
import { SCENARIOS, type ScenarioId } from '../sim/scenarios';
import { PROTOCOL_VERSION, type FromWorker, type ToWorker } from '../worker/protocol';
import { useApp } from './store';

const QUERY_COOLDOWN = 15;
const MAX_QUERIES_PER_RUN = 2;

class Controller {
  engine: SimEngine;
  prevFrame: Frame;
  curFrame: Frame;
  alpha = 0;
  private acc = 0;
  private worker: Worker | null = null;
  private inFlight = false;
  private inFlightSince = 0;
  private epochCounter = 0;
  private jobCounter = 0;
  private queriesThisRun = 0;
  private lastQueryT = -Infinity;
  private hudTimer = 0;
  private pendingResume = false;
  /** latest plan for overlays (read by renderers each frame; not React state) */
  latestPlan: PlanResult | null = null;
  planVersion = 0;
  /** before/after playback clock (mutable; UI polls it) */
  replay = { t: 0, duration: 0, playing: false, speed: 1 };

  constructor() {
    this.engine = this.makeEngine(useApp.getState().scenarioId);
    this.prevFrame = this.engine.snapshot();
    this.curFrame = this.prevFrame;
  }

  private makeEngine(id: ScenarioId): SimEngine {
    this.epochCounter++;
    return new SimEngine(SCENARIOS[id], { mode: 'interactive', epoch: this.epochCounter, autoAssign: true, record: true });
  }

  init(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL('../worker/planner.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => this.onWorker(ev.data);
    this.worker.onerror = (e) => console.warn('planner worker error', e.message);
    loadModel().then((m) => {
      if (isCompatible(m)) useApp.getState().set({ model: m, modelLoaded: true });
      else useApp.getState().set({ modelLoaded: true });
    });
    listRuns().then(() => undefined);
  }

  private send(m: ToWorker): void {
    this.worker?.postMessage(m);
  }

  // ------------------------------------------------------------ scenario control

  loadScenario(id: ScenarioId): void {
    this.engine = this.makeEngine(id);
    this.prevFrame = this.engine.snapshot();
    this.curFrame = this.prevFrame;
    this.acc = 0;
    this.inFlight = false;
    this.queriesThisRun = 0;
    this.lastQueryT = -Infinity;
    this.latestPlan = null;
    this.planVersion++;
    this.pendingResume = false;
    useApp.getState().set({
      scenarioId: id,
      runState: 'ready',
      query: null,
      plan: null,
      dialogue: [],
      liveMetrics: null,
      replayActive: false,
      evaluation: { status: 'idle' },
    });
    this.pushHud();
  }

  start(): void {
    const s = useApp.getState();
    if (s.runState === 'finished' || this.engine.t > 0) this.loadScenario(s.scenarioId);
    useApp.getState().set({ runState: 'running', replayActive: false });
  }

  reset(): void {
    this.loadScenario(useApp.getState().scenarioId);
  }

  assign(tableId: string): void {
    if (this.engine.taskActive) return;
    this.engine.assign(tableId);
    this.drainEvents();
    if (useApp.getState().runState === 'ready') useApp.getState().set({ runState: 'running' });
  }

  resetPreferences(): void {
    const m = createModel();
    useApp.getState().set({ model: m, evidence: null, evaluation: { status: 'idle' } });
    void saveModel(m);
    useApp.getState().say('system', 'Learned preferences reset to the initial model.', this.engine.t);
  }

  // ------------------------------------------------------------ loop

  advance(frameDt: number): void {
    const s = useApp.getState();
    if (s.runState !== 'running' || s.replayActive) {
      this.alpha = 1;
      return;
    }
    this.acc += Math.min(frameDt, 0.1);
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      this.prevFrame = this.curFrame;
      this.engine.step();
      this.curFrame = this.engine.frames[this.engine.frames.length - 1];
      this.drainEvents();
      this.maybeRequestPlan();
      if (useApp.getState().runState !== 'running') break;
      if (this.engine.finished) {
        useApp.getState().set({ runState: 'finished', liveMetrics: this.engine.metrics() });
        break;
      }
    }
    // keep memory bounded for long interactive sessions
    if (this.engine.frames.length > 30 * 240) this.engine.frames.splice(0, this.engine.frames.length - 30 * 240);
    this.alpha = this.acc / SIM_DT;
    this.hudTimer += frameDt;
    if (this.hudTimer > 0.2) {
      this.hudTimer = 0;
      this.pushHud();
    }
  }

  private maybeRequestPlan(): void {
    const eng = this.engine;
    if (this.inFlight && eng.t - this.inFlightSince > 1.0) this.inFlight = false; // lost/slow reply
    if (this.inFlight || !eng.needsPlan()) return;
    const s = useApp.getState();
    eng.markPlanRequested();
    this.inFlight = true;
    this.inFlightSince = eng.t;
    const allowQuery =
      SCENARIOS[s.scenarioId].allowQueries &&
      s.askEnabled &&
      eng.robot.phase === 'delivering' &&
      this.queriesThisRun < MAX_QUERIES_PER_RUN &&
      eng.t - this.lastQueryT > QUERY_COOLDOWN;
    this.send({
      v: PROTOCOL_VERSION,
      type: 'plan',
      input: {
        reqId: eng.nextReqId(),
        epoch: eng.epoch,
        obs: eng.observe(),
        weights: s.model.weights,
        initialWeights: s.model.initialWeights,
        prev: eng.prevMeta,
        stuckFor: eng.robot.stuckFor,
        allowQuery,
      },
    });
  }

  private onWorker(m: FromWorker): void {
    if (m.v !== PROTOCOL_VERSION) return;
    const s = useApp.getState();
    switch (m.type) {
      case 'plan': {
        const res = m.result;
        if (res.epoch !== this.engine.epoch) return; // scenario changed: stale
        this.inFlight = false;
        if (res.query && s.runState === 'running') {
          // Pause the shared scene and ask. Both previews start from this same observation.
          this.queriesThisRun++;
          this.lastQueryT = this.engine.t;
          this.engine.applyPlan(res);
          this.setPlan(res);
          s.set({ runState: 'teaching', query: res });
          s.say('baymax', res.query.prompt, this.engine.t);
          return;
        }
        if (this.engine.applyPlan(res)) {
          this.setPlan(res);
          this.drainEvents();
          if (this.pendingResume) {
            this.pendingResume = false;
            s.set({ runState: 'running' });
          }
        }
        break;
      }
      case 'learned': {
        s.set({ model: m.model });
        void saveModel(m.model);
        const q = s.query;
        if (q?.query) {
          const pref = m.model.examples[m.model.examples.length - 1].preferred;
          const a = q.candidates[q.query.a].label;
          const b = q.candidates[q.query.b].label;
          s.set({ evidence: { report: m.report, preferredLabel: pref === 'A' ? a : b, otherLabel: pref === 'A' ? b : a, at: Date.now() } });
        }
        s.set({ query: null });
        this.replanAndResume();
        break;
      }
      case 'evaluated': {
        const r = m.result;
        this.replay = { t: 0, duration: Math.max(lastT(r.before.frames), lastT(r.after.frames)), playing: true, speed: 1 };
        s.set({ evaluation: { status: 'done', result: r, ms: m.ms }, replayActive: true });
        void saveRun({
          id: `run-${Date.now()}`,
          createdAt: Date.now(),
          scenarioId: r.scenarioId,
          featureVersion: s.model.featureVersion,
          initialWeights: s.model.initialWeights,
          learnedWeights: s.model.weights,
          before: r.before.metrics,
          after: r.after.metrics,
          identicalCustomers: r.identicalCustomers,
        });
        break;
      }
      case 'error':
        console.warn('worker error:', m.message);
        if (m.jobId !== undefined) s.set({ evaluation: { status: 'error', error: m.message } });
        break;
    }
  }

  private setPlan(res: PlanResult): void {
    this.latestPlan = res;
    this.planVersion++;
  }

  // ------------------------------------------------------------ teaching

  answerQuery(choice: 'A' | 'B' | 'skip'): void {
    const s = useApp.getState();
    const q = s.query;
    if (!q || !q.query) return;
    if (choice === 'skip') {
      s.set({ query: null });
      this.replanAndResume();
      return;
    }
    s.set({ runState: 'learning' });
    const ex = exampleFromQuery(q, s.scenarioId, choice);
    this.send({ v: PROTOCOL_VERSION, type: 'learn', jobId: ++this.jobCounter, model: s.model, example: ex });
  }

  private replanAndResume(): void {
    // Request a fresh plan from the same paused state with the current model, then resume.
    this.engine.lastPlanReqT = -Infinity;
    this.inFlight = false;
    this.pendingResume = true;
    useApp.getState().set({ runState: 'learning' });
    this.maybeRequestPlanWhilePaused();
  }

  private maybeRequestPlanWhilePaused(): void {
    if (!this.engine.taskActive) {
      this.pendingResume = false;
      useApp.getState().set({ runState: 'running' });
      return;
    }
    this.maybeRequestPlan();
  }

  // ------------------------------------------------------------ evaluation

  evaluate(id?: ScenarioId): void {
    const s = useApp.getState();
    const scenarioId = id ?? s.scenarioId;
    s.set({ evaluation: { status: 'running' } });
    this.send({ v: PROTOCOL_VERSION, type: 'evaluate', jobId: ++this.jobCounter, scenarioId, initialWeights: s.model.initialWeights, learnedWeights: s.model.weights });
  }

  closeReplay(): void {
    this.replay.playing = false;
    useApp.getState().set({ replayActive: false });
  }

  // ------------------------------------------------------------ HUD / dialogue

  private drainEvents(): void {
    const s = useApp.getState();
    for (const e of this.engine.drainEvents()) {
      if (e.kind === 'say' || e.kind === 'assign') s.say(e.speaker ?? 'system', e.text ?? '', e.t);
    }
  }

  private pushHud(): void {
    const e = this.engine;
    const p = e.plan;
    const initialLabel = p && p.chosenUnderInitial >= 0 ? p.candidates[p.chosenUnderInitial].label : null;
    useApp.getState().set({
      hud: {
        t: e.t,
        phase: e.robot.phase,
        label: e.robot.label,
        speed: Math.hypot(e.robot.vel.x, e.robot.vel.y),
        tableId: e.robot.tableId,
        latencyMs: p?.latencyMs ?? 0,
        replans: e.latencies.length,
        noSafe: !!p?.noSafe,
        chosenDiffersFromInitial: !!p && p.chosenUnderInitial !== p.chosen && initialLabel !== p.candidates[p.chosen].label,
        initialChoiceLabel: initialLabel,
      },
      plan: this.latestPlan,
    });
  }
}

const lastT = (f: Frame[]): number => (f.length ? f[f.length - 1].t : 0);

export const controller = new Controller();
