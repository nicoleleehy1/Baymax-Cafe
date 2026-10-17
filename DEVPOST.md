# After You: Teaching Baymax Consideration

**Tagline:** Aunt Cass can tell Baymax which table needs coffee. You teach him how to get there thoughtfully.

**Track:** Physical AI with a human touch

---

## Inspiration

"AI can write code, but it can't decide what's worth building." Robots have the same problem. A planner can find a collision-free path to table 4, but it can't know whether cutting between two friends mid-conversation is rude, or whether the extra two seconds of going around are worth it. Those are human judgment calls, and they differ by person and by place.

We wanted a small, honest demo of the human touch in physical AI: a robot that is already safe, asks a person when the socially right choice is unclear, and actually changes its later behavior because of the answer. Baymax, the gentlest robot we know, working in Aunt Cass's café, felt like the right character for it.

## What it does

An interactive 3D café where a Baymax-inspired robot delivers drinks around customers who move on their own: people queue at the counter, sit at tables, browse the pastry case, and chat in small groups.

1. **Teach.** Aunt Cass asks for a latte at table 4. Baymax heads for the gap between two chatting friends. When two safe options score closely but differ socially, the scene pauses and two ghost Baymaxes rehearse the options from the same moment: **A, pass between them** or **B, go around**. The card shows the real consequences (seconds of delay, meters through the conversation, closest gap). You pick one.
2. **Learn.** Your answer updates a pairwise-preference reward model. The app shows which features differed, which weights moved (conversation intrusion goes from 0.15 to about 1.7) and how the probability of your choice rose (about 38% to about 80%). Baymax resumes on the new ranking: *"Your conversation appears to be ongoing. I will take the scenic route."*
3. **Generalize.** A different pair, in a different spot, on the way to a different table. No question is asked. He goes around, purely from the updated scoring.
4. **Adapt.** A customer steps out from the pastry case across his route. Baymax predicts her motion, slows, waits (*"After you."*), then replans.
5. **See inside.** "Show what Baymax is considering" draws every candidate trajectory colored by score, rejected ones in red, predicted human paths with growing uncertainty rings, the conversation area and his clearance ring, plus a ranked breakdown of each candidate's cost terms and what the untaught weights would have chosen.
6. **Before / after replay.** Both policies run against the identical recorded customer motion, side by side, with a metrics table.

## How we built it

- **Stack:** React 19, TypeScript, Three.js through React Three Fiber and drei, Zustand, Vite, Vitest, a Web Worker for planning and IndexedDB for persistence. All geometry is procedural; there are no external assets, services or API keys.
- **Authoritative simulation** at a fixed 30 Hz. Rendering only interpolates between sim frames, and Baymax's waddle, lean and head turns come from simulated velocity and acceleration.
- **Planner in a Web Worker**, replanning at 5 Hz with a 3 s horizon: A* route variants on a 0.1 m inflated occupancy grid, then roughly 35 to 55 candidate rollouts (speeds, lateral offsets, wait, step aside, step back) under holonomic dynamics limits.
- **Human motion prediction:** a constant-velocity hypothesis plus slow-down and turn hypotheses, with uncertainty that grows over the horizon. The planner only sees what an observer could see (position, velocity, facing, radius, and the authored conversation-group annotations); a test enforces that it never reads customer scripts.
- **Hard safety first, preferences second.** Any candidate that comes within a margin of a predicted person or touches static geometry is rejected before scoring. If nothing survives, Baymax brakes. Learning can't touch this layer.
- **Preference learning:** six normalized cost features (delay, closeness to people, conversation intrusion, speed near people, aisle blocking, abrupt motion), utility U = −w·φ, and a Bradley-Terry model P(A ≻ B) = σ(U(A) − U(B)) refit on every stored answer by gradient descent with a pull back toward the initial weights. The delay weight is fixed at 1 as the unit of measure, so every other weight reads as "how many 3-second units of delay Baymax will accept to avoid one unit of this cost."
- **When to ask:** an active-learning heuristic. Baymax asks only when the chosen option and the best option from a different behavior class are both safe, score within 1.2 of each other, differ meaningfully in social features, and a person is nearby, with at most 2 questions per run.
- **Headless evaluation:** `npm run eval` runs the same planner synchronously and deterministically and prints the metrics below; a Vitest suite checks learning, transfer, safety, prediction and repeatability.

## Measured results

From `npm run eval`, with a scripted teacher that gives one answer preferring the lower-intrusion option. The sim is deterministic, so these reproduce exactly.

| Scenario | Policy | Time | Conversation intrusions | Min clearance | Time closer than 0.35 m | Collisions |
|---|---|---|---|---|---|---|
| Teach | before | 8.9 s | 1 (1.3 s) | 0.27 m | 0.9 s | 0 |
| Teach | after | 10.8 s | 0 | 0.49 m | 0.0 s | 0 |
| Generalize | before | 8.2 s | 1 (1.3 s) | 0.29 m | 0.8 s | 0 |
| Generalize | after | 10.6 s | 0 | 0.65 m | 0.0 s | 0 |
| Adapt | before | 10.2 s | 0 | 1.22 m | 0.0 s | 0 |
| Adapt | after | 10.1 s | 0 | 1.22 m | 0.0 s | 0 |

All deliveries succeeded, with zero collisions and zero hard-brake events in every run. One answer removed conversation intrusions in a scene Baymax had never been asked about. Consideration costs about 2 seconds per delivery, and we show that trade-off openly. Adapt is unchanged by teaching, as it should be: yielding to a crossing person comes from prediction plus the safety layer, not from learned weights. Planning takes about 1 to 3 ms on average per update in Node on a laptop.

## Challenges we ran into

- **Making the question worth asking.** Asking every time is annoying and asking never teaches nothing. Tuning the query rule so Baymax asks once, at the moment the choice is genuinely close, took a lot of iteration.
- **Keeping learning away from safety.** We had to structure the planner so collision rejection happens before scoring, then prove with tests that even extreme weights never select an unsafe candidate.
- **Fair before/after comparisons.** Live customers react to Baymax, so two runs never match. For evaluation and replay, customers follow recorded trajectories so both policies face identical motion.
- **Determinism across worker, browser and Node.** We skipped a physics engine and did all clearance queries on analytic 2D floor geometry, so the same planner runs in the worker, in tests and in the eval CLI with identical results. Every plan carries an epoch and request id so stale worker results are dropped.
- **Honest explanations.** Baymax's lines are templates, so we made each one fire only when planner data backs it (the "scenic route" line only plays when the chosen route skirts a conversation the best direct option would cross).

## Accomplishments that we're proud of

- A full teach, generalize, adapt loop where one human answer measurably changes behavior in a new situation.
- Everything is inspectable: candidates, rejections, predictions, feature contributions and weight changes are all visible in the app, not hidden in a black box.
- Learning provably can't override safety, verified by tests.
- Reproducible numbers from a single command, with no network, no keys and no assets to download.
- A café that feels alive, with the Big Hero 6 cast and Mochi the cat wandering after Baymax.

## What we learned

- The human touch is most valuable at the margin: when every option is already safe and the remaining choice is about comfort and courtesy.
- A small linear reward model can transfer surprisingly well when the features are the right ones, but it also picks up incidental correlations. In the Teach question the "around" option also turns more, so the abrupt-motion weight drops (0.40 to about 0.04). We show that in the evidence card rather than hide it.
- Being explicit about what is learned versus authored makes the demo more convincing, not less.

## What is learned vs. authored

We want to be clear about this:

- **Learned from your answers:** the weights on closeness, conversation intrusion, speed near people, aisle blocking and abrupt motion.
- **Authored by us:** the feature definitions, initial weights, the delay weight (scale anchor), café geometry, customer scripts, collision margins, dynamics limits, route hysteresis and all dialogue templates.
- **Conversation groups are authored scene annotations**, not perceived from body language.
- **Customer avoidance is a simple time-to-collision heuristic**, not ORCA.
- **There is no LLM in the loop.** All dialogue is templated and triggered by planner data.
- This is a simulation; the safety layer uses heuristic uncertainty margins and is not a real-world guarantee.

## What's next for After You

- Visual detection of conversation groups (F-formations) instead of annotations.
- Context-dependent preferences (a busy lunch rush versus a quiet afternoon), or a small neural reward model on the same preference store.
- Smarter questions using expected information gain over a posterior on the weights, instead of a score-closeness heuristic.
- ORCA for customers and learned human trajectory forecasting.
- An optional LLM to parse Aunt Cass's requests ("the couple by the window wants cocoa") and to explain choices strictly from the planner's own feature data.
- Moving the same preference model onto a real mobile robot.

## Theme tie-in

The hackathon asks what AI can't decide on its own. Our planner can generate dozens of safe paths in a few milliseconds, but it can't decide which one is considerate. That is a value judgment, and it belongs to the people sharing the space. After You keeps a human in that loop: the robot handles the physics and the safety, recognizes when a choice is a matter of taste, asks, and carries the answer into situations it has never seen. It is physical AI that leaves the "what's worth doing" decision to people.

## Built with

TypeScript, React, Three.js, React Three Fiber, drei, Zustand, Vite, Vitest, Web Workers, IndexedDB, Node.js
