import { useEffect, useState } from 'react';
import type { CandidateSummary, PlanResult } from '../core/types';
import { FEATURES, LEARNED } from '../learning/model';
import { neuralPreferences, PARAMS, type Brain } from '../learning/neural/runtime';
import { METRIC_DEFS, type Metrics } from '../sim/metrics';
import { SCENARIO_ORDER, SCENARIOS, type ScenarioId } from '../sim/scenarios';
import { controller } from '../state/controller';
import { useApp } from '../state/store';
import { OPTION_COLORS } from '../render/Teaching';
import { REPLAY_COLORS } from '../render/Replay';
import { BUILDING, LAYOUT, LAYOUT_ID, TABLES } from '../world/layout';

const fmt = (x: number, d = 2): string => (Math.abs(x) < 0.005 && d <= 2 ? '0' : x.toFixed(d));
const signed = (x: number, d = 2): string => (x > 0.004 ? '+' : '') + fmt(x, d);

// ------------------------------------------------------------------ top bar

export function TopBar() {
  const scenarioId = useApp((s) => s.scenarioId);
  const runState = useApp((s) => s.runState);
  const view = useApp((s) => s.view);
  const askEnabled = useApp((s) => s.askEnabled);
  const brain = useApp((s) => s.brain);
  const evaluation = useApp((s) => s.evaluation);
  const examples = useApp((s) => s.model.examples.length);
  const phase = useApp((s) => s.hud.phase);
  const buildingView = useApp((s) => s.buildingView);
  const set = useApp((s) => s.set);
  const [table, setTable] = useState(LAYOUT.tables[0]?.id ?? 'T3');

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" />
        <div>
          <div className="brand-title">After You</div>
          <div className="brand-sub">Teaching Baymax consideration</div>
        </div>
      </div>
      {LAYOUT_ID !== 'classic' && (
        <nav className="scenarios floors" aria-label="Floor">
          {BUILDING.map((def) => (
            <a key={def.id} className={`tab ${def.id === LAYOUT_ID ? 'active' : ''}`} href={`?floor=${def.floor}`} title={def.name}>
              <span className="tab-num">{def.floor}</span>
              {def.floor === 1 ? 'Café' : def.floor === 2 ? 'Cass' : 'Hiro'}
            </a>
          ))}
          <button className={`tab ${buildingView ? 'active' : ''}`} onClick={() => set({ buildingView: !buildingView })} title="Show the whole building">
            Building
          </button>
        </nav>
      )}
      <nav className="scenarios" aria-label="Scenario">
        {SCENARIO_ORDER.map((id, i) => (
          <button key={id} className={`tab ${id === scenarioId ? 'active' : ''}`} onClick={() => controller.loadScenario(id as ScenarioId)}>
            <span className="tab-num">{i + 1}</span>
            {SCENARIOS[id].title}
          </button>
        ))}
      </nav>
      <div className="actions">
        {runState === 'ready' || runState === 'finished' ? (
          <button className="btn primary" onClick={() => controller.start()}>
            {runState === 'finished' ? 'Run again' : 'Start'}
          </button>
        ) : (
          <button className="btn" onClick={() => controller.reset()}>
            Reset scenario
          </button>
        )}
        <div className="assign">
          <select value={table} onChange={(e) => setTable(e.target.value)} aria-label="Table">
            {TABLES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="btn" disabled={phase === 'delivering' || phase === 'returning' || phase === 'placing'} onClick={() => controller.assign(table)}>
            Assign delivery
          </button>
        </div>
        <button className={`btn ${view === 'considering' ? 'on' : ''}`} onClick={() => set({ view: view === 'cafe' ? 'considering' : 'cafe' })}>
          {view === 'considering' ? 'Hide' : 'Show'} what Baymax is considering
        </button>
        <label className="toggle" title="Active learning: Baymax may pause and ask when two safe options score closely but differ socially.">
          <input type="checkbox" checked={askEnabled} onChange={(e) => set({ askEnabled: e.target.checked })} />
          Let Baymax ask
        </label>
        <label className="toggle" title="Which reward model ranks Baymax's safe options. Both learn from every answer; the neural network is pretrained and fine-tuned from your answers.">
          Model
          <select value={brain} onChange={(e) => controller.setBrain(e.target.value as Brain)} aria-label="Reward model">
            <option value="linear">6 linear weights</option>
            <option value="neural">Neural network</option>
          </select>
        </label>
        <button className="btn" disabled={evaluation.status === 'running'} onClick={() => controller.evaluate()}>
          {evaluation.status === 'running' ? 'Evaluating…' : 'Before / after replay'}
        </button>
        <button className="btn ghost" onClick={() => controller.resetPreferences()} title="Restore the initial weights and delete stored preference examples">
          Reset preferences{examples ? ` (${examples})` : ''}
        </button>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------ intro + status

export function IntroCard() {
  const runState = useApp((s) => s.runState);
  const scenarioId = useApp((s) => s.scenarioId);
  const replayActive = useApp((s) => s.replayActive);
  if (runState !== 'ready' || replayActive) return null;
  const sc = SCENARIOS[scenarioId];
  return (
    <div className="intro card">
      <div className="eyebrow">Scenario {SCENARIO_ORDER.indexOf(scenarioId) + 1} · {sc.title}</div>
      <h1>Aunt Cass can tell Baymax which table needs coffee.</h1>
      <p className="lead">We’re teaching him how to get there thoughtfully.</p>
      <p className="muted">{sc.subtitle}</p>
      <button className="btn primary big" onClick={() => controller.start()}>
        Start scenario
      </button>
    </div>
  );
}

export function StatusChip() {
  const hud = useApp((s) => s.hud);
  const runState = useApp((s) => s.runState);
  const replayActive = useApp((s) => s.replayActive);
  if (replayActive || runState === 'ready' || runState === 'teaching') return null;
  return (
    <div className={`status-chip ${hud.noSafe ? 'warn' : ''}`}>
      <span className={`pulse ${runState === 'running' ? 'live' : ''}`} />
      <span className="status-label">{runState === 'learning' ? 'Updating preferences…' : hud.label}</span>
      {hud.chosenDiffersFromInitial && (
        <span className="taught" title={`With the initial weights Baymax would choose: ${hud.initialChoiceLabel}`}>
          changed by your teaching
        </span>
      )}
      <span className="status-meta">{hud.speed.toFixed(2)} m/s</span>
    </div>
  );
}

export function Dialogue() {
  const lines = useApp((s) => s.dialogue);
  const replayActive = useApp((s) => s.replayActive);
  const runState = useApp((s) => s.runState);
  if (replayActive || runState === 'teaching' || runState === 'learning' || runState === 'ready') return null;
  const shown = lines.slice(-3);
  return (
    <div className="dialogue" aria-live="polite">
      {shown.map((l, i) => (
        <div key={l.id} className={`line ${l.speaker}`} style={{ opacity: 0.45 + (0.55 * (i + 1)) / shown.length }}>
          <span className="who">{l.speaker === 'cass' ? 'Aunt Cass' : l.speaker === 'baymax' ? 'Baymax' : 'Note'}</span>
          <span className="text">{l.text}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ teaching

function consequence(c: CandidateSummary, ref: CandidateSummary, refKey: string): string[] {
  const out: string[] = [];
  const dt = (c.features[0] - ref.features[0]) * 3;
  if (Math.abs(dt) > 0.15) out.push(`est. ${dt > 0 ? '+' : '−'}${Math.abs(dt).toFixed(1)} s vs. ${refKey}`);
  else out.push(`about the same time as ${refKey}`);
  out.push(c.features[2] > 0.05 ? `${c.features[2].toFixed(1)} m through the conversation` : 'stays out of the conversation');
  out.push(`closest gap ${Math.max(0, c.minClearance).toFixed(2)} m`);
  return out;
}

export function TeachingCard() {
  const runState = useApp((s) => s.runState);
  const query = useApp((s) => s.query);
  const focus = useApp((s) => s.previewFocus);
  const compare = useApp((s) => s.previewCompare);
  const set = useApp((s) => s.set);
  if (!query?.query || (runState !== 'teaching' && runState !== 'learning')) return null;
  const a = query.candidates[query.query.a];
  const b = query.candidates[query.query.b];
  const busy = runState === 'learning';
  return (
    <div className="teach card">
      <div className="eyebrow">Baymax is asking</div>
      <h2>{query.query.prompt}</h2>
      <div className="options">
        {([['A', a, b, 'B'], ['B', b, a, 'A']] as const).map(([k, c, other, otherKey]) => (
          <button
            key={k}
            className={`option ${focus === k ? 'focused' : ''}`}
            disabled={busy}
            onClick={() => controller.answerQuery(k)}
            onMouseEnter={() => set({ previewFocus: k })}
            onMouseLeave={() => set({ previewFocus: null })}
            onFocus={() => set({ previewFocus: k })}
            onBlur={() => set({ previewFocus: null })}
            style={{ borderColor: OPTION_COLORS[k] }}
          >
            <span className="option-key" style={{ background: OPTION_COLORS[k] }}>
              {k}
            </span>
            <span className="option-body">
              <span className="option-title">{c.label}</span>
              <span className="option-cons">{consequence(c, other, otherKey).join(' · ')}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="teach-foot">
        <span className="muted small">
          Hover an option to preview it. Solid = Baymax’s next 3 s as planned; dashed = the rest of the route he intends. Times are estimates.
        </span>
        <span className="teach-actions">
          <label className="toggle small">
            <input type="checkbox" checked={compare} onChange={(e) => set({ previewCompare: e.target.checked })} />
            Compare both
          </label>
          <button className="btn ghost small" disabled={busy} onClick={() => controller.answerQuery('skip')}>
            Either is fine
          </button>
        </span>
      </div>
    </div>
  );
}

export function EvidenceCard() {
  const ev = useApp((s) => s.evidence);
  const set = useApp((s) => s.set);
  const replayActive = useApp((s) => s.replayActive);
  const runState = useApp((s) => s.runState);
  const [open, setOpen] = useState(false);
  // never compete with an open question
  if (!ev || replayActive || runState === 'teaching' || runState === 'learning') return null;
  const r = ev.report;
  const changes = FEATURES.map((f, i) => ({ f, i, d: r.weightsAfter[i] - r.weightsBefore[i] }))
    .filter((x) => Math.abs(x.d) > 0.01)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return (
    <div className={`evidence card ${open ? 'open' : ''}`}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Preference model updated</div>
          <div className="evidence-title">
            You preferred <b>{ev.preferredLabel}</b> over <b>{ev.otherLabel}</b>
          </div>
        </div>
        <button className="icon-btn" onClick={() => set({ evidence: null })} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="evidence-summary">
        {changes.slice(0, 2).map((x) => (
          <span key={x.f.key} className="chg">
            {x.f.name} {fmt(r.weightsBefore[x.i])} → <b>{fmt(r.weightsAfter[x.i])}</b> <span className={x.d > 0 ? 'up' : 'down'}>{x.d > 0 ? '▲' : '▼'}</span>
          </span>
        ))}
        <span className="chg">
          P(your choice) {(r.probBefore * 100).toFixed(0)}% → <b>{(r.probAfter * 100).toFixed(0)}%</b>
        </span>
        {r.neural && (
          <span className="chg" title={`All ${PARAMS} network parameters were fine-tuned from the pretrained weights in ${(r.neural.ms / 1000).toFixed(1)} s`}>
            Neural net P(your choice) {(r.neural.probBefore * 100).toFixed(0)}% → <b>{(r.neural.probAfter * 100).toFixed(0)}%</b>
          </span>
        )}
      </div>
      <button className="btn ghost small inspector-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Hide details' : 'Inspect the update'}
      </button>
      {open && (
        <>
          <table className="mini">
            <thead>
              <tr>
                <th>Feature</th>
                <th title="features(preferred) − features(other)">Δ feature</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => {
                const dw = r.weightsAfter[i] - r.weightsBefore[i];
                return (
                  <tr key={f.key} className={Math.abs(r.featureDiff[i]) > 0.02 || Math.abs(dw) > 0.01 ? '' : 'dim'} title={f.description}>
                    <td>{f.name}</td>
                    <td className="num">{signed(r.featureDiff[i])}</td>
                    <td className="num">
                      {fmt(r.weightsBefore[i])} → <b>{fmt(r.weightsAfter[i])}</b>
                      {!LEARNED[i] && <span className="tag">fixed</span>}
                      {Math.abs(dw) > 0.01 && <span className={dw > 0 ? 'up' : 'down'}>{dw > 0 ? ' ▲' : ' ▼'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="evidence-foot muted">
            Utilities (preferred vs other): {fmt(r.rankBefore.preferred)} vs {fmt(r.rankBefore.other)} → {fmt(r.rankAfter.preferred)} vs {fmt(r.rankAfter.other)}. Delay is fixed at 1 as the unit of
            measure. All stored answers are refit together with regularization toward the initial weights.
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ considering panel

export function ConsideringPanel() {
  const view = useApp((s) => s.view);
  const plan = useApp((s) => s.plan);
  const hud = useApp((s) => s.hud);
  const weights = useApp((s) => s.model.weights);
  const initial = useApp((s) => s.model.initialWeights);
  const replayActive = useApp((s) => s.replayActive);
  const brain = useApp((s) => s.brain);
  const answers = useApp((s) => neuralPreferences(s.model.examples).length);
  if (view !== 'considering' || replayActive) return null;
  return (
    <aside className="considering card">
      <div className="eyebrow">What Baymax is considering</div>
      {brain === 'neural' && (
        <p className="muted">
          Ranked by the neural reward model ({PARAMS} parameters, pretrained on the factory planner{answers ? `, fine-tuned on ${answers} answer${answers === 1 ? '' : 's'}` : ''}). The cost breakdown uses the linear weights for reference.
        </p>
      )}
      {!plan || plan.chosen < 0 ? (
        <p className="muted">Assign a delivery to see candidate trajectories.</p>
      ) : (
        <PlanDetails plan={plan} weights={weights} initial={initial} latency={hud.latencyMs} />
      )}
      <Legend />
    </aside>
  );
}

function PlanDetails({ plan, weights, initial }: { plan: PlanResult; weights: number[]; initial: number[]; latency: number }) {
  const chosen = plan.candidates[plan.chosen];
  const safe = plan.candidates.filter((c) => c.safe);
  // best per distinct label, for a readable ranking
  const seen = new Set<string>();
  const ranked = [...safe].sort((a, b) => b.total - a.total).filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true))).slice(0, 6);
  const initialChoice = plan.candidates[plan.chosenUnderInitial];
  const differs = initialChoice && initialChoice.label !== chosen.label;
  const contrib = chosen.features.map((f, i) => -weights[i] * f);
  const maxC = Math.max(0.05, ...contrib.map((x) => Math.abs(x)));
  return (
    <>
      <div className="stats">
        <span>
          <b>{plan.candidates.length}</b> candidates
        </span>
        <span>
          <b>{safe.length}</b> safe
        </span>
        <span>
          <b>{plan.candidates.length - safe.length}</b> rejected
        </span>
        <span>
          <b>{plan.latencyMs.toFixed(1)}</b> ms
        </span>
      </div>
      {plan.noSafe && <div className="warn-box">No safe candidate. Baymax is stopping.</div>}
      <div className="section-title">Ranking (learned utility − switching penalty)</div>
      <ol className="ranking">
        {ranked.map((c) => (
          <li key={c.index} className={c.index === plan.chosen ? 'chosen' : ''}>
            <span className="r-label">{c.label}</span>
            <span className="r-score">{fmt(c.total)}</span>
          </li>
        ))}
      </ol>
      <div className={`counterfactual ${differs ? 'diff' : ''}`}>
        With the initial (untaught) weights Baymax would choose: <b>{initialChoice?.label ?? '—'}</b>
        {differs ? ' — teaching changed this decision.' : ''}
      </div>
      <div className="section-title">Why this trajectory (−weight × feature)</div>
      <div className="bars">
        {FEATURES.map((f, i) => (
          <div key={f.key} className="bar-row" title={f.description}>
            <span className="bar-name">{f.name}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(Math.abs(contrib[i]) / maxC) * 100}%` }} />
            </span>
            <span className="bar-val">{fmt(contrib[i])}</span>
          </div>
        ))}
      </div>
      <div className="section-title">Learned weights</div>
      <div className="weights">
        {FEATURES.map((f, i) => (
          <span key={f.key} className={`w ${Math.abs(weights[i] - initial[i]) > 0.01 ? 'changed' : ''}`} title={f.description}>
            {f.name} <b>{fmt(weights[i])}</b>
          </span>
        ))}
      </div>
    </>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: '#37e0c8' }} />chosen (next 3 s)</span>
      <span><i style={{ background: 'repeating-linear-gradient(90deg,#9ff5e7 0 4px,transparent 4px 7px)' }} />route intention</span>
      <span><i style={{ background: '#fff1d6', outline: '1px solid #c9b79c' }} />actual movement</span>
      <span><i style={{ background: 'linear-gradient(90deg,#5b7bd5,#ffb347)' }} />candidates (low→high score)</span>
      <span><i style={{ background: '#c0392b' }} />rejected (collision)</span>
      <span><i style={{ background: '#ff6f91' }} />predicted people + uncertainty</span>
      <span><i style={{ background: '#ffcf5c' }} />conversation area (annotated)</span>
    </div>
  );
}

// ------------------------------------------------------------------ evaluation

const ROWS: { key: keyof Metrics; label: string; fmt: (m: Metrics) => string; better?: 'low' | 'high' }[] = [
  { key: 'completed', label: 'Delivered', fmt: (m) => (m.completed ? 'yes' : 'no') },
  { key: 'deliveryTime', label: 'Delivery time', fmt: (m) => (m.deliveryTime === null ? '—' : `${m.deliveryTime.toFixed(1)} s`), better: 'low' },
  { key: 'conversationIntrusions', label: 'Conversation intrusions', fmt: (m) => `${m.conversationIntrusions} (${m.intrusionTime.toFixed(1)} s)`, better: 'low' },
  { key: 'minClearance', label: 'Min. clearance to people', fmt: (m) => `${m.minClearance.toFixed(2)} m`, better: 'high' },
  { key: 'timeTooClose', label: 'Time under 0.35 m gap', fmt: (m) => `${m.timeTooClose.toFixed(1)} s`, better: 'low' },
  { key: 'hardBrakes', label: 'Hard brake / accel events', fmt: (m) => `${m.hardBrakes}`, better: 'low' },
  { key: 'collisions', label: 'Collisions', fmt: (m) => `${m.collisions}`, better: 'low' },
  { key: 'planLatencyMeanMs', label: 'Planner latency (mean / p95)', fmt: (m) => `${m.planLatencyMeanMs.toFixed(1)} / ${m.planLatencyP95Ms.toFixed(1)} ms` },
];

export function EvaluationPanel() {
  const ev = useApp((s) => s.evaluation);
  const active = useApp((s) => s.replayActive);
  const weights = useApp((s) => s.model.weights);
  const initial = useApp((s) => s.model.initialWeights);
  const brain = useApp((s) => s.brain);
  const neuralAnswers = useApp((s) => neuralPreferences(s.model.examples).length);
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((x) => x + 1), 100);
    return () => clearInterval(id);
  }, [active]);
  if (!active || ev.status !== 'done' || !ev.result) return null;
  const r = ev.result;
  const clock = controller.replay;
  const same = brain === 'neural' ? neuralAnswers === 0 : weights.every((w, i) => Math.abs(w - initial[i]) < 1e-6);
  return (
    <div className="evaluation card">
      <div className="card-head">
        <div>
          <div className="eyebrow">
            Controlled before / after · {SCENARIOS[r.scenarioId].title}
            {brain === 'neural' ? ' · neural network, pretrained vs fine-tuned' : ''}
          </div>
          <div className="evidence-title">Same recorded customer motion for both runs {r.identicalCustomers ? '✓' : '✗'}</div>
        </div>
        <button className="icon-btn" onClick={() => controller.closeReplay()} aria-label="Close replay">
          ×
        </button>
      </div>
      {same && <div className="warn-box">No preferences learned yet, so both runs use the initial weights. Teach in scenario 1 first.</div>}
      <table className="mini metrics">
        <thead>
          <tr>
            <th />
            <th style={{ color: REPLAY_COLORS.before }}>Before teaching</th>
            <th style={{ color: REPLAY_COLORS.after }}>After teaching</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key} title={(METRIC_DEFS as Record<string, string>)[row.key] ?? ''}>
              <td>{row.label}</td>
              <td className="num">{row.fmt(r.before.metrics)}</td>
              <td className="num">{row.fmt(r.after.metrics)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="decisions">
        <div>
          <span className="dot" style={{ background: REPLAY_COLORS.before }} />
          {summarizeDecisions(r.before.decisions.map((d) => d.label))}
        </div>
        <div>
          <span className="dot" style={{ background: REPLAY_COLORS.after }} />
          {summarizeDecisions(r.after.decisions.map((d) => d.label))}
        </div>
      </div>
      <div className="player">
        <button
          className="btn small"
          onClick={() => {
            if (clock.t >= clock.duration) clock.t = 0;
            clock.playing = !clock.playing;
            force((x) => x + 1);
          }}
        >
          {clock.playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={clock.duration}
          step={0.01}
          value={clock.t}
          onChange={(e) => {
            clock.t = parseFloat(e.target.value);
            force((x) => x + 1);
          }}
          aria-label="Replay time"
        />
        <span className="muted small num">{clock.t.toFixed(1)} s</span>
        <select
          value={clock.speed}
          onChange={(e) => {
            clock.speed = parseFloat(e.target.value);
            force((x) => x + 1);
          }}
          aria-label="Playback speed"
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </select>
      </div>
      <div className="muted small">Evaluation ran headless in the worker in {ev.ms?.toFixed(0)} ms. Metrics are computed from simulation frames; hover a row for its definition.</div>
    </div>
  );
}

function summarizeDecisions(labels: string[]): string {
  const out: string[] = [];
  for (const l of labels) {
    const base = l.replace(/, a little slower| slowly/g, '');
    if (out[out.length - 1] !== base) out.push(base);
  }
  return out.slice(0, 5).join(' → ') + (out.length > 5 ? ' → …' : '');
}
