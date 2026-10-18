# After You: Teaching Baymax Consideration

> *Aunt Cass can tell Baymax which table needs coffee. We're teaching him how to get there thoughtfully.*

An interactive 3D café simulation (React + TypeScript + Three.js via React Three Fiber) where a
Baymax-inspired robot delivers drinks around independently-behaving customers. He starts out
collision-aware but socially clumsy. When two safe options score closely but differ socially, he
pauses and asks you to pick one. Your answer updates a real pairwise-preference reward model, and
his later decisions in new situations change because of it.

"Socially aware" here means *his trajectory scoring accounts for people's comfort*. It does not
mean sentience or perception: conversation groups are authored scene annotations.

<img width="2668" height="1658" alt="FB4AE302-23EC-496E-82D9-B5B34BA6F23B" src="https://github.com/user-attachments/assets/7d432c7a-db94-458a-845f-f3b79ea6d477" />
<img width="2662" height="1654" alt="8D1674DF-75C6-4C2A-A4EB-4EDFF8BF2EA9" src="https://github.com/user-attachments/assets/00668511-e5c4-4377-9d5c-c04262e4dc17" />
<img width="2670" height="1654" alt="A0E295C2-5479-49CE-8607-26B23DC7C001" src="https://github.com/user-attachments/assets/a061987d-dcec-4ca6-bcc1-b074bf017707" />


---

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 14 verification tests (vitest, headless)
npm run eval         # reproduces teach → generalize → adapt headlessly and prints measured metrics
npm run eval:neural  # neural reward model: pretrained vs. fine-tuned from one answer, every floor
npm run neural:train # re-collect planner decisions and re-pretrain the network (~2 min)
npm run build        # type-check + production build
```

Requires Node 20.19+ (tested on Node 20.20). No external assets, network services or API keys.

---

## Demo script (≈3 minutes)

1. **Open on the café.** Sunlight through the right-hand windows, pastry cases, seated customers, a
   queue forming at the counter, two friends chatting mid-floor. *"Baymax knows how to reach a
   table. He doesn't yet know how we'd like him to move around people."*
2. **Teach (scenario 1).** Press **Start**. Aunt Cass: *"Table 4 needs a latte, Baymax."* He heads
   straight for the gap between the two friends. As the conversation comes within ~3 m, the scene
   **pauses** and two ghost Baymaxes rehearse **A: pass between them** and **B: go around**, from
   the same paused moment. The card lists real consequences (seconds of delay, meters through the
   conversation, closest gap).
3. **Choose B.** The *Preference model updated* card shows which features differed, which weights
   moved (conversation intrusion 0.15 → ~1.7) and how the probability of your choice rose
   (≈38% → ≈80%). He resumes on the new ranking: *"Your conversation appears to be ongoing. I will
   take the scenic route."* The status chip shows **changed by your teaching**.
4. **Toggle "Show what Baymax is considering".** Translucent candidate trajectories (blue→gold by
   score), rejected ones in red, the chosen path in teal, predicted human paths with uncertainty
   rings, the yellow conversation area, and his clearance ring. The panel ranks candidates, shows
   −weight × feature contributions, and says what the *untaught* weights would have chosen.
5. **Generalize (scenario 2).** A *different* pair, in a different spot, on the way to a different
   table. No question is asked. He goes around, purely from the updated scoring.
6. **Adapt (scenario 3).** A customer leaves the pastry case and crosses his route. Prediction picks
   it up from her velocity, Baymax slows, waits (*"After you."*), then replans and continues.
7. **Before / after replay.** Click it in any scenario: both policies run headlessly against the
   *identical recorded* customer motion; the initial-weights Baymax plays as a coral ghost, the
   taught one solid, both trails drawn, with a metrics table. Be honest about the trade-off:
   consideration costs ~2 seconds per delivery.

---

## The Lucky Cat building (three floors)

The café is the ground floor of a three-storey dollhouse, traced from the reference floor plan.
Each storey is its own layout (`src/world/layouts/`): shared map data drives the navigation
obstacles, the rendered props, the serving positions and the people's destinations.

| Floor | URL | Layout | Scenarios |
|---|---|---|---|
| 1 | `/?floor=1` | Lucky Cat Café (kitchen, galley, L-shaped pastry counter, espresso bar, booths, communal table) | latte to the window bench, cocoa by the front window, a customer crossing from the restroom |
| 2 | `/?floor=2` | Aunt Cass's apartment (kitchen + bay nook, bathroom, dining table, sofa cluster, bedroom) | cocoa to the sofa past Cass and Honey Lemon, tea to the bedroom past Go Go and Wasabi, Hiro crossing to the bedroom |
| 3 | `/?floor=3` | Hiro's room + rooftop garden (planters, bathroom, desk, bed, workbench, robot parts) | gummy bears to the desk past Go Go and Wasabi, tea to the bed past Honey Lemon and Fred, Hiro dashing to the bathroom |

The original square café is still available at `/?layout=classic`. The **Building** button shows
all three storeys stacked (floors above the active one are otherwise hidden so nothing covers
Baymax). Switching floors reloads the page; learned preferences persist in IndexedDB, so a lesson
taught in the café carries upstairs. `npm run eval:long`, `eval:cass`, `eval:hiro` and the matching
`test:*` scripts run the headless checks per floor.

## Architecture

```
SimEngine (fixed 30 Hz step, authoritative)          src/sim/engine.ts
  ├─ customers: scripted state machines + TTC avoidance   src/sim/customers.ts, scenarios.ts
  ├─ observe() → Observation (kinematics + annotations only)
  │        │   postMessage (typed, versioned, epoch + reqId)   src/worker/protocol.ts
  │        ▼
  │   Web Worker: plan(obs, weights)                       src/worker/planner.worker.ts
  │     predict humans (const-vel + slow/turn hyps, growing σ)   src/prediction/predictor.ts
  │     global route variants (A* on inflated grid)         src/planning/routes.ts, src/world/grid.ts
  │     ~35–55 candidate rollouts over 3 s                  src/planning/planner.ts
  │     hard collision rejection (footprints + σ margin)
  │     features φ → utility −w·φ (+ authored hysteresis) → choose
  │     optional teaching query (active-learning heuristic)
  │        ▼
  ├─ applyPlan(): discard stale (epoch/reqId), execute the 0.2 s prefix, replan at 5 Hz
  └─ frames[] → metrics (src/sim/metrics.ts), replay
Learning (worker): Bradley-Terry logistic update      src/learning/model.ts
Persistence: IndexedDB (model, examples, run summaries)    src/persistence/db.ts
UI state: Zustand, updated on events / 5 Hz HUD             src/state/store.ts, controller.ts
Rendering: R3F reads sim frames and interpolates; no per-frame React state   src/render/*
```

- **Simulation is authoritative.** Rendering interpolates between the last two fixed-step frames.
  Baymax's animation (waddle, lean on deceleration, head turning toward the person he's attending
  to, tray held level) is driven by simulated velocity, acceleration and the sim's `lookAt`. The
  0.5 m footprint used by the planner encloses the body and tray.
- **Planner never sees private customer state.** `observe()` returns only position, velocity
  (finite-differenced from positions), facing, radius, and the explicit `conversation` group
  annotations. A test checks this.
- **Stale results are dropped**: every plan carries the scenario `epoch` and a monotonically
  increasing `reqId`.
- **Evaluation runs the same planner synchronously** in lock-step for determinism; the
  interactive app runs it asynchronously in the worker.

### Planner details

| Element | Implementation |
|---|---|
| Global path | 8-connected A* on a 0.1 m occupancy grid inflated by Baymax's radius, plus string-pulling |
| Route variants | shortest route; a route with soft cost over annotated conversation areas (only when the shortest route crosses one); a people-aware reroute after waiting >3 s (deadlock breaker) |
| Local candidates | per route: 3 speeds × 5 lateral offsets; on the direct route also *wait here*, *step aside L/R*, *step back* |
| Dynamics | holonomic, v ≤ 0.9 m/s, a ≤ 0.7 m/s², turn-rate limit 1.6 rad/s with slowdown on sharp turns |
| Horizon | 3.0 s at 0.1 s; replan every 0.2 s (5 Hz); execute only the prefix |
| Safety | candidates whose footprint comes within (0.05 m + σ(t)) of any person hypothesis with p ≥ 0.12 in the first 2.5 s, or touches static geometry, are **rejected before scoring**. If none survive: brake to a stop. This is simulation behavior, not a real-world safety guarantee. |
| Hysteresis | authored switching penalty (0.35 route change, 0.08 maneuver change); not learned |
| Latency | ~1–3 ms mean, <10 ms p95 per update in Node on a laptop (`npm run eval`); the in-app panel shows live numbers. A hidden or background browser tab throttles the worker and inflates them. |

### Human motion prediction

Constant-velocity baseline (p = 0.55) plus *slow down* (0.2), *turn left/right* (0.125 each), with
σ(t) = 0.04·t + 0.12·t·min(1, speed/0.6). Stationary people get a single hypothesis. The
predictor never reads customers' scripts.

### Preference learning

- Features (all costs, normalized): **delay** (expected arrival vs. shortest route, per 3 s),
  **closeness to people**, **conversation intrusion** (meters, horizon + rest of route),
  **speed near people**, **aisle blocking**, **abrupt motion**.
- Utility U = −w·φ. P(A ≻ B) = σ(U(A) − U(B)). Each answer is stored; weights are refit on all
  stored examples by gradient descent on logistic loss + (λ/2)‖w − w₀‖² (λ = 0.15), weights clipped ≥ 0.
- **The delay weight is fixed at 1** as the unit of measure (Bradley-Terry utilities are only
  defined up to scale). Every other weight reads as "how many 3-second units of delay Baymax will
  accept to avoid one unit of this cost".
- Collision rejection is separate from the learned model and cannot be learned away.
- Persisted in IndexedDB: feature version + names, initial weights, current weights, every
  preference example (both feature vectors, labels, choice, scenario, time). **Reset preferences**
  restores w₀.

### Active learning (implemented as a heuristic)

Baymax may ask when the chosen candidate and the best representative of a *different* behavior
class are both safe, their scores are within 1.2, their feature vectors differ by ≥ 0.3 (L1) with
≥ 0.25 in social features, and a person or conversation is within ~3 m. Limited to 2 questions per
run with a 15 s cooldown, enabled in the Teach scenario (toggle **Let Baymax ask**). Score closeness
is a query heuristic, not a calibrated uncertainty estimate.

---

## What is learned vs. authored

| Learned from your choices | Authored |
|---|---|
| Weights on closeness, conversation intrusion, speed near people, aisle blocking, abrupt motion | Feature definitions and normalization; initial weights; delay weight (scale anchor) |
| | Café geometry, aisle zone, customer scripts, conversation-group annotations |
| | Collision constraints, uncertainty margins, dynamics limits, hysteresis |
| | Dialogue templates (each line is triggered by planner data; e.g. *scenic route* only fires when the chosen route skirts a conversation that the best direct option would cross) |

Generalization is targeted: one answer about *a* conversation changes how Baymax scores *any*
annotated conversation area, at any location or orientation. It does not establish broad
understanding of human preferences, and it can pick up incidental correlations: in the Teach
query the "around" option also turns more, so the abrupt-motion weight drops (0.40 → ~0.04). The
evidence card shows this openly.

---

## Measured results (`npm run eval`, one scripted teaching answer)

The teacher in the CLI and tests is a script that prefers the lower-intrusion option; in the app,
you are the teacher. Numbers are from this machine and are reproducible (deterministic sim).

| Scenario | Policy | Delivered | Time | Conv. intrusions | Min clearance | Time < 0.35 m | Collisions |
|---|---|---|---|---|---|---|---|
| Teach | before | ✓ | 8.9 s | 1 (1.3 s) | 0.27 m | 0.9 s | 0 |
| Teach | after | ✓ | 10.8 s | 0 | 0.49 m | 0.0 s | 0 |
| Generalize | before | ✓ | 8.2 s | 1 (1.3 s) | 0.29 m | 0.8 s | 0 |
| Generalize | after | ✓ | 10.6 s | 0 | 0.65 m | 0.0 s | 0 |
| Adapt | before | ✓ | 10.2 s | 0 | 1.22 m | 0.0 s | 0 |
| Adapt | after | ✓ | 10.1 s | 0 | 1.22 m | 0.0 s | 0 |

Consideration costs about 2 s per delivery. Adapt is unchanged by teaching, as expected: yielding
to a crossing person comes from prediction plus collision rejection, not from the learned weights.
Hard-brake events were 0 in all runs. Metric definitions are in `src/sim/metrics.ts` and are
shown as tooltips in the app.

### Training on every floor (verified 2026-10-18)

Each storey has its own teach / generalize / adapt scenarios and the same planner and
preference model. The loop was run end to end in a real browser (production build,
Playwright driving the actual UI, metrics read from the running simulation):

| Step | What happened | Delivered | Intrusions | Min clearance | Collisions |
|---|---|---|---|---|---|
| Café · Teach | asked "pass between them, or go around?"; chose *go around*; conversation weight 0.15 → 1.66, P(choice) 25 % → 83 % | 14.2 s | 0 | 0.17 m | 0 |
| Café · Generalize | no question; "scenic route" chosen from the learned scoring | 14.7 s | 0 | 0.31 m | 0 |
| Cass's floor · Generalize | **no teaching on this floor**; the café lesson carried over (IndexedDB) | 19.5 s | 0 | 0.08 m | 0 |
| Hiro's floor · Generalize | **no teaching on this floor**; café lesson carried over | 12.2 s | 0 | 0.58 m | 0 |
| Cass's floor · Adapt | "After you." — waited for Cass, then continued | 13.7 s | 0 | 0.25 m | 0 |
| Hiro's floor · Adapt | waited for Hiro's dash to the bathroom, then continued | 10.5 s | 0 | 0.40 m | 0 |
| Cass's floor · Teach (fresh model) | conversation 0.15 → 1.90, P(choice) 25 % → 81 % | 15.6 s | 0 | 0.29 m | 0 |
| Hiro's floor · Teach | asked again with the model already taught; P 76 % → 87 % | 11.5 s | 0 | 0.32 m | 0 |

Headless, `npm run eval:transfer` teaches once on the café and applies the untouched weights to
every other floor: conversation intrusions go 1 → 0 on the classic café, Cass's floor and Hiro's
floor, with no collisions. The "before" runs with the initial weights intrude on every floor, so the
change is the learned scoring, not the layout. `npm run eval:all` runs every floor's evaluation
plus the transfer check.

Honest notes from these runs: the model also picks up incidental correlations of the chosen
option (speed near people and abrupt motion moved along with conversation intrusion); upstairs
Baymax carries a cup (0.46 m footprint) instead of the tray, and the apartment's narrow spots
still produce low clearances (0.08 m on Cass's floor) without contact.

### Verification (`npm test`)

- A preference update raises P(preferred) above 0.5, re-ranks the pair, and increases the
  conversation weight; delay stays fixed; no data ⇒ w = w₀.
- Teach asks exactly once; the learned model has zero intrusions.
- **Transfer:** in Generalize, initial weights intrude, learned weights don't; the first decision
  differs between initial and learned weights over the *same* candidate set; consideration costs time.
- **Collision constraints survive learning:** zero collisions in all scenarios before/after, and
  even extreme weights never select a candidate flagged unsafe.
- **Prediction / replanning:** uncertainty grows; a crossing customer causes slowing/yielding;
  with the same customer standing still, Baymax never yields.
- **No-safe-path:** surrounded by approaching people, the planner reports no safe option and brakes to zero.
- **Observation boundary:** observations contain no scripts, targets or seats.
- **Repeatability:** identical metrics across runs; before/after use identical customer frames;
  route hysteresis limits route switches.
- The app was exercised end-to-end in a browser (teach → choose → resume → generalize → adapt →
  replay) with no console errors from app code. The only warning is a `THREE.Clock` deprecation notice
  from R3F's internals.

---

## Limitations and honest notes

- **Conversation groups are authored annotations**, not perceived from body language.
- **Customer avoidance** is a simple time-to-collision repulsion heuristic, not ORCA. In
  evaluation mode, customers follow recorded trajectories and do not react to Baymax (exogenous);
  in interactive mode they do avoid him, so live runs can differ from replays.
- Rapier (React Three Rapier) was **not** used: all collision and clearance queries run on the
  analytic 2D floor-plane geometry, which keeps the planner deterministic and usable inside the
  worker and in Node tests.
- The safety layer is a simulation constraint with heuristic uncertainty margins, not a certified
  guarantee. Humanoid balance and physics are out of scope.
- The learned model is linear in six hand-designed features, so it can only express preferences
  those features capture. One or two answers move it a lot (by design, for a demo) and can
  shift weights on incidental features.
- Assets are original procedural geometry; there are no GLB models.
- No LLM is used. All dialogue is templated and triggered by planner data.

### Possible extensions

- Learn per-context weights (e.g. busy vs quiet café) or a small neural reward model
  (Python/PyTorch/FastAPI) on the same feature/preference store.
- A proper ORCA implementation for customers; learned human trajectory forecasting.
- Better active-learning queries (expected information gain under a posterior over w).
- Visual social-group detection (F-formations) instead of annotations.
- An optional LLM for parsing Aunt Cass's requests ("the couple by the window wants cocoa"),
  explaining choices only from the planner's feature data.
