// The neural reward model through the same worker messages the app sends.
import { describe, expect, it } from 'vitest';
import type { PlanResult, PreferenceExample } from '../src/core/types';
import { conversationOracle, exampleFromQuery, runEpisode } from '../src/eval/runner';
import { createModel, INITIAL_WEIGHTS } from '../src/learning/model';
import { neuralPreferences, withDescriptors } from '../src/learning/neural/runtime';
import { handleMessage } from '../src/worker/handler';

describe('neural reward model in the worker', () => {
  it('plans, asks, fine-tunes from the answer and evaluates through worker messages', () => {
    let model = createModel();
    let asked: PlanResult | null = null;
    let report: { probBefore: number; probAfter: number } | undefined;
    runEpisode('teach', {
      weights: INITIAL_WEIGHTS,
      initialWeights: INITIAL_WEIGHTS,
      allowQuery: true,
      planner: (input) => {
        const m = handleMessage({ v: 1, type: 'plan', input, neural: { prefs: neuralPreferences(model.examples) } });
        if (m.type !== 'plan') throw new Error(JSON.stringify(m));
        return m.result;
      },
      onQuery: (res) => {
        asked = res;
        const ex = withDescriptors(exampleFromQuery(res, 'teach', conversationOracle(res)), res);
        const m = handleMessage({ v: 1, type: 'learn', jobId: 1, model, example: ex, neural: { prefs: neuralPreferences(model.examples) } });
        if (m.type !== 'learned') throw new Error(JSON.stringify(m));
        model = m.model;
        report = m.report.neural;
        return model.weights;
      },
    });
    expect(asked).not.toBeNull();
    expect(model.examples[0].descA?.length).toBeGreaterThan(0);
    expect(report!.probBefore).toBeLessThan(0.5);
    expect(report!.probAfter).toBeGreaterThan(0.85);

    const ev = handleMessage({ v: 1, type: 'evaluate', jobId: 2, scenarioId: 'generalize', initialWeights: INITIAL_WEIGHTS, learnedWeights: model.weights, neural: { prefs: neuralPreferences(model.examples) } });
    if (ev.type !== 'evaluated') throw new Error(JSON.stringify(ev));
    expect(ev.result.before.metrics.conversationIntrusions).toBeGreaterThan(0);
    expect(ev.result.after.metrics.conversationIntrusions).toBe(0);
    expect(ev.result.after.metrics.completed).toBe(true);
    expect(ev.result.after.metrics.collisions).toBe(0);
  }, 60000);

  it('answers saved before the neural model existed are kept for the linear model and skipped by the network', () => {
    const old: PreferenceExample = { id: 'x', createdAt: 0, scenarioId: 'teach', tObs: 0, featuresA: [0, 0, 1, 0, 0, 0], featuresB: [1, 0, 0, 0, 0, 0], labelA: 'a', labelB: 'b', preferred: 'B' };
    expect(neuralPreferences([old])).toHaveLength(0);
  });
});
