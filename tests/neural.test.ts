import { describe as group, expect, it } from 'vitest';
import pretrainedFile from '../src/learning/neural/pretrained.json';
import replay from '../src/learning/neural/replay.json';
import { runEpisode } from '../src/eval/runner';
import { INITIAL_WEIGHTS } from '../src/learning/model';
import { DESCRIPTOR_DIM } from '../src/learning/neural/descriptor';
import { backward, createMLP, forward, forwardAll, fromJson, zeroGrads, type MLPJson } from '../src/learning/neural/mlp';
import { planNeural, prefProbNeural, score } from '../src/learning/neural/reward';
import { teachNeural } from '../src/learning/neural/teach';
import { recordCustomerTrack } from '../src/sim/engine';
import { SCENARIOS } from '../src/sim/scenarios';

const base = fromJson((pretrainedFile as { net: MLPJson }).net);

group('neural reward model', () => {
  it('backprop matches finite differences', () => {
    const net = createMLP([5, 4, 3, 1], 3);
    const x = [0.3, -1.2, 0.5, 2, -0.1];
    const g = zeroGrads(net);
    backward(net, forwardAll(net, x), 1, g);
    const h = 1e-6;
    for (const [l, i] of [[0, 2], [1, 5], [2, 1]] as const) {
      const w0 = net.W[l][i];
      net.W[l][i] = w0 + h;
      const up = forward(net, x);
      net.W[l][i] = w0 - h;
      const dn = forward(net, x);
      net.W[l][i] = w0;
      expect(g.W[l][i]).toBeCloseTo((up - dn) / (2 * h), 5);
    }
  });

  it('shipped weights match the descriptor', () => {
    expect(base.sizes[0]).toBe(DESCRIPTOR_DIM);
    expect((replay as number[][][])[0][0].length).toBe(DESCRIPTOR_DIM);
  });

  it('one real answer flips the preferred pair while staying near the pretrained network', () => {
    const { net, examples } = teachNeural(base, replay as number[][][]);
    const ex = examples[0];
    expect(prefProbNeural(base, ex)).toBeLessThan(0.5);
    expect(prefProbNeural(net, ex)).toBeGreaterThan(0.85);
    // situations the lesson has no say in keep the pretrained ranking
    let same = 0;
    let all = 0;
    for (const X of replay as number[][][])
      for (let i = 0; i < X.length; i++)
        for (let j = i + 1; j < X.length; j++) {
          all++;
          if (Math.sign(score(net, X[i]) - score(net, X[j])) === Math.sign(score(base, X[i]) - score(base, X[j]))) same++;
        }
    expect(same / all).toBeGreaterThan(0.9);
  }, 30000);

  it('never chooses an unsafe candidate, even with a random network', () => {
    const garbage = createMLP([DESCRIPTOR_DIM, 16, 1], 42);
    for (let k = 0; k < garbage.W[1].length; k++) garbage.W[1][k] *= 50;
    const ep = runEpisode('generalize', {
      weights: INITIAL_WEIGHTS,
      initialWeights: INITIAL_WEIGHTS,
      track: recordCustomerTrack(SCENARIOS.generalize),
      planner: (input) => {
        const r = planNeural(input, garbage);
        if (r.chosen >= 0 && !r.noSafe) expect(r.candidates[r.chosen].safe).toBe(true);
        return r;
      },
    });
    expect(ep.metrics.collisions).toBe(0);
  });

  it('pretrained network reproduces the factory planner; one answer generalizes to a new scene', () => {
    const run = (planner?: Parameters<typeof runEpisode>[1]['planner']) =>
      runEpisode('generalize', { weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS, track: recordCustomerTrack(SCENARIOS.generalize), planner });
    const factory = run();
    const pre = run((i) => planNeural(i, base, base));
    expect(pre.metrics.conversationIntrusions).toBe(factory.metrics.conversationIntrusions);
    expect(factory.metrics.conversationIntrusions).toBeGreaterThan(0);

    const { net, examples } = teachNeural(base, replay as number[][][]);
    expect(examples.length).toBe(1);
    const after = run((i) => planNeural(i, net, base));
    expect(after.metrics.completed).toBe(true);
    expect(after.metrics.collisions).toBe(0);
    expect(after.metrics.conversationIntrusions).toBe(0);
  }, 60000);
});
