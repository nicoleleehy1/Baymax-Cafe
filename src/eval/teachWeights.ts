// Teach on the active layout with the scripted teacher (prefers less conversation intrusion)
// and print the learned weights as JSON. Used by transfer.ts to carry a lesson between floors.
import { conversationOracle, exampleFromQuery, runEpisode } from './runner';
import { addPreference, createModel } from '../learning/model';

let model = createModel();
runEpisode('teach', {
  weights: model.weights,
  initialWeights: model.initialWeights,
  allowQuery: true,
  onQuery: (res) => {
    model = addPreference(model, exampleFromQuery(res, 'teach', conversationOracle(res))).model;
    return model.weights;
  },
});
console.log(JSON.stringify({ weights: model.weights, examples: model.examples.length }));
