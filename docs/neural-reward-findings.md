# Neural reward model: findings

**Short version.** Baymax now has real machine learning, in two layers. A small neural network, the reward model, is **pretrained** offline by imitating the original planner and **fine-tuned** in the browser from each answer you give. In the app, switch **Model → Neural network** in the top bar, or open `?brain=neural`. One answer is enough to stop cutting through conversations on every floor. The trade-offs: deliveries get slower, and moving a lesson to another floor works less well than with the simpler 6-weight model.

## What existed before

`src/learning/model.ts` is a linear reward model. Each candidate path gets U = −w·φ over 6 hand-made cost features, and the 6 weights are fit by logistic regression (Bradley-Terry) on your answers. That is genuine training, but it is just 6 numbers. There was no neural network and nothing pretrained or fine-tuned. There is still no LLM.

## What was added

| Piece | Where | What it does |
|---|---|---|
| Network | `src/learning/neural/mlp.ts` | 46 → 32 → 32 → 1 MLP, tanh, 2,593 parameters. Hand-written backprop and Adam with no ML library, so the same code runs in Node and in the Web Worker. Backprop is gradient-checked in the tests. |
| Input | `descriptor.ts` | Per candidate path: the 6 features, a 10-step timeline (closeness to predicted people, speed, aisle occupancy), meters through conversation areas over the rest of the route, minimum clearance, and the maneuver type. |
| Utility | `reward.ts` | U = −delay + 0.1 · f_θ(x). As in the linear model, delay keeps a fixed weight of 1 as the unit of measure. |
| Pretraining data | `collect.ts` | 15,698 recorded planner decisions over all 4 floors, with randomly perturbed weights so Baymax visits varied situations. |
| Pretraining | `train.ts` | Distillation from the factory planner: listwise KL on the safe options plus a centered utility-matching loss. Trained on classic, café and floor 2 (11,954 decisions); floor 3 is held out. About 2 minutes on a laptop. |
| Fine-tuning | `reward.ts`, `runtime.ts` | Each answer runs Bradley-Terry on all answers so far, starting from the pretrained weights. An L2 pull keeps it near the pretrained weights, and a 96-situation replay set (where every option crosses conversations equally) must keep its pretrained ranking. This is the same pretrain → preference-tune → stay-close-to-reference recipe used for LLMs (RLHF). |
| Safety | unchanged | The network only re-ranks options that already passed collision rejection. A test drives a deliberately random network and checks it never picks an unsafe option. |

## In the app (this PR)

- The top bar has a **Model** selector (6 linear weights / Neural network), and `?brain=neural` opens with the network.
- Both models learn from every answer, so switching keeps what you taught. Each answer now stores the network's inputs for both options. Answers saved earlier still teach the linear model, and the network skips them.
- When you answer, the network fine-tunes in the planning worker, taking about 1.5 s in headless Chrome. The evidence card adds "Neural net P(your choice) 40% → 93%".
- Before / after replay with the network compares the pretrained net (before) against the fine-tuned net (after) on identical recorded customers.
- The "What Baymax is considering" panel says when the network is ranking. Its cost breakdown still shows the linear weights, for reference.

**Checked end to end** with the production build in headless Chrome, running the real worker and messages. Rendering was off because headless has no WebGL. In Teach, Baymax asked "pass between them or go around", the teacher picked around, and P rose from 0.40 to 0.93 after a 1.5 s fine-tune. The run finished with 0 intrusions and 0 collisions. Before/after on Generalize went from 1 intrusion to 0, with the delivery completed and 0 collisions. Switching back to linear kept the answer. Planning averaged 7.3 ms per update.

## Measured results (`npm run eval:neural`)

One scripted answer per floor (the teacher prefers the less intrusive option). The sim is deterministic, so these reproduce exactly.

### Pretraining

| | Untrained | Pretrained |
|---|---|---|
| KL to factory choices, held-out floor 3 | 0.233 | 0.000 |
| Same pick as factory, held-out floor 3 | 84.4% | 71.5% to 79.8% (near-ties) |
| Utility lost vs factory pick, held-out floor 3 | 0.0046 | 0.0000 |
| Closed-loop runs matching the factory (choices, intrusions, time within 0.1 s) | — | 12 of 12 |

Caveat: because delay is built into the utility, even an untrained network makes the factory's pick 84 to 92% of the time. Many options are near-identical (the same path at slightly different speeds), so "same pick" bounces around between epochs while the lost utility stays at zero. The convincing evidence is the closed loop: the pretrained network drives exactly like the original planner on all 12 floor and scenario runs, including the held-out top floor.

### Fine-tuning from one answer, on the same floor

| Floor | Scenario | Original planner | Pretrained net | Fine-tuned net |
|---|---|---|---|---|
| Café (1) | Teach | 10.5 s, 1 intrusion | 10.5 s, 1 | **13.0 s, 0** |
| Café (1) | Generalize | 12.3 s, 1 | 12.3 s, 1 | **16.0 s, 0** |
| Café (1) | Adapt | 15.2 s, 0 | 15.3 s, 0 | 15.2 s, 0 |
| Classic | Teach / Generalize | 8.8 s, 1 / 8.1 s, 1 | same | **10.5 s, 0 / 10.3 s, 0** |
| Floor 2 | Teach / Generalize | 9.6 s, 1 / 12.8 s, 1 | same | **13.9 s, 0 / 37.8 s, 0** |
| Floor 3 (held out) | Teach / Generalize | 7.4 s, 1 / 6.4 s, 1 | same | **12.6 s, 0 / 11.1 s, 0** |

- Intrusions removed in **8 of 8** Teach and Generalize runs. Adapt is unchanged, and every delivery completes with **0 collisions**.
- **Held-out preference pairs:** recorded options that differ by more than 0.3 m of conversation and less than 3 s of delay. The less intrusive option ranks higher **11 to 21%** of the time before fine-tuning and **96 to 100%** after (café 17.6 → 96.0%, classic 19.6 → 100%, floor 2 11.2 → 99.7%, floor 3 21.3 → 99.1%).
- **Unrelated choices barely move:** 88 to 95% of option pairs that don't involve conversations keep their pretrained order.

### Where the network is worse than the 6 linear weights

- **Transfer between floors.** Taught once in the café and carried upstairs unchanged, the network removes intrusions in 3 of 6 runs (classic both, floor 2 Teach). The linear model does it in 6 of 6 (`npm run eval:transfer`). With a single answer, 6 interpretable weights generalize across rooms better than 2,593 parameters.
- **Speed.** It is more cautious after teaching. Floor 2 Generalize takes 37.8 s against 12.8 s, as Baymax waits out a crowded passage; the linear model takes 17.6 s there.
- **Cost.** Planning takes about 10 ms per update against about 5 ms in Node, and each answer costs about 1.5 to 2 s of fine-tuning.

## What went wrong along the way (and the fixes)

1. **It learned to procrastinate.** The first input had a "inside a conversation at step k" timeline. The fine-tuned network learned "don't be in a conversation during the next 3 s" and waited outside the horizon forever on floor 2. Conversation overlap is now given only as meters over the whole route.
2. **Waiting looked free.** With a fully learned utility, fine-tuning could make waiting outscore going around indefinitely. Fixing delay as the unit of measure (weight 1, not learned) removed every timeout.
3. **The lesson leaked.** With only an L2 pull, one answer flipped about 25% of unrelated rankings and made Baymax timid everywhere. The replay set brought that down to 5 to 12%.
4. **The wrong question got asked.** A softmax-only distillation ignored how bad clearly-worse options are. The pretrained network then rated "go around" too low to be worth asking about, and asked "pass between or wait here?" instead. The centered utility-matching term fixed the gaps, and the question became "pass between or go around?" again.

## How to reproduce

```bash
npm test               # 38 tests, including the neural ones
npm run eval:neural    # tables above (re-collects data first, ~30 s)
npm run neural:train   # re-collect + re-pretrain + rebuild the replay set (~2 min)
npm run eval:transfer  # linear-model transfer, for comparison
npm run dev            # then open http://localhost:5173/?floor=1&brain=neural
```

## Honest framing for the pitch

- **Fair to say:** "Baymax's reward is a neural network pretrained on 15.7k decisions from the factory planner, then fine-tuned in the browser from a person's answers with a preference loss and a pull back to the reference model. That's the RLHF recipe, at robot scale." Plus the numbers above.
- **Not fair to say:** that this is deep learning at scale, that it uses an LLM or perception, or that it beats the linear model. It doesn't beat it at cross-room transfer from one answer. The conversation groups are still authored annotations, and pretraining distills a hand-made planner, not human driving data.
- **Natural next steps:** pretrain on many simulated teachers with different tastes so fine-tuning starts closer to people, and learn conversation groups from body positions instead of annotations.
