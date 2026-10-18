// Headless TEACH with the neural reward model: the scripted teacher answers Baymax's question and
// every answer fine-tunes the network from its pretrained weights.
import type { PlanResult } from '../../core/types';
import { conversationOracle, runEpisode } from '../../eval/runner';
import { INITIAL_WEIGHTS } from '../model';
import { describe } from './descriptor';
import type { MLP } from './mlp';
import { fineTune, planNeural, prefProbNeural, type NeuralPreference } from './reward';

export function teachNeural(pretrained: MLP, replay: number[][][] = [], maxQueries = 1): { net: MLP; examples: NeuralPreference[]; log: string[] } {
  let net = pretrained;
  const examples: NeuralPreference[] = [];
  const log: string[] = [];
  runEpisode('teach', {
    weights: INITIAL_WEIGHTS,
    initialWeights: INITIAL_WEIGHTS,
    allowQuery: true,
    maxQueries,
    planner: (input) => planNeural(input, net, pretrained),
    onQuery: (res: PlanResult) => {
      const a = res.candidates[res.query!.a];
      const b = res.candidates[res.query!.b];
      const pick = conversationOracle(res);
      const [p, o] = pick === 'A' ? [a, b] : [b, a];
      const ex = { preferred: describe(p, res), other: describe(o, res) };
      examples.push(ex);
      const before = prefProbNeural(net, ex);
      net = fineTune(pretrained, examples, {}, replay);
      log.push(`t=${res.tObs.toFixed(1)}s asked "${res.query!.prompt}" → teacher picks "${p.label}". P(preferred) ${before.toFixed(3)} → ${prefProbNeural(net, ex).toFixed(3)}`);
      return INITIAL_WEIGHTS; // non-null: replan now (the planner closure reads the updated network)
    },
  });
  return { net, examples, log };
}

