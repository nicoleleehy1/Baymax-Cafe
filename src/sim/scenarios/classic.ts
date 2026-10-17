// Three authored, repeatable scenarios in the same café. Conversation groups are
// authored scene annotations (not perceived); customers' scripts are private.
import { v, type Vec2 } from '../../core/vec';
import { CLASSIC } from '../../world/layouts/classic';
import type { Look } from '../customers';
import type { Scenario, ScenarioId } from './types';

const PICKUP = CLASSIC.pickup;

export const L = (shirt: string, pants: string, skin: string, hair: string, hairStyle: Look['hairStyle'], height = 1.0): Look => ({
  shirt,
  pants,
  skin,
  hair,
  hairStyle,
  height,
});

export const LOOKS = {
  honey: L('#e9a23b', '#4b5a7a', '#f1c7a5', '#3a2a20', 'bun', 0.97),
  sage: L('#7fa37a', '#3b3f4f', '#c98f6b', '#1f1a17', 'short', 1.04),
  rose: L('#d86f7e', '#2f3c58', '#e8b897', '#7a4a2a', 'long', 0.95),
  sky: L('#5d8fc9', '#5a4a3e', '#8d5a3e', '#16120f', 'cap', 1.02),
  plum: L('#8a6bb0', '#3a3a3a', '#f3d2b8', '#c48a4a', 'long', 0.98),
  teal: L('#3f9c9a', '#6b5440', '#b07a57', '#2a1e18', 'short', 1.06),
};

/** Place two people facing each other across the straight line a→b, at fraction f along it. */
export function pairAcross(a: Vec2, b: Vec2, f: number, halfGap: number): [Vec2, Vec2] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L0 = Math.hypot(dx, dy);
  const d = { x: dx / L0, y: dy / L0 };
  const n = { x: -d.y, y: d.x };
  const m = { x: a.x + dx * f, y: a.y + dy * f };
  return [v(m.x + n.x * halfGap, m.y + n.y * halfGap), v(m.x - n.x * halfGap, m.y - n.y * halfGap)];
}

const FOREVER = 1e6;

// ---- TEACH: a pair chatting right across the line to Table 4
const T4_SERVE = v(4.64, 1.4);
const [teachA, teachB] = pairAcross(PICKUP, T4_SERVE, 0.48, 1.05);

const teach: Scenario = {
  id: 'teach',
  title: 'Teach',
  subtitle: 'Two friends are chatting between Baymax and Table 4.',
  duration: 40,
  robotStart: { pos: PICKUP, heading: Math.PI / 2 },
  delivery: { tableId: 'T4', at: 1.5, item: 'latte' },
  allowQueries: true,
  groups: [{ id: 'g-teach', members: ['mei', 'tomas'] }],
  customers: [
    { id: 'mei', name: 'Mei', look: LOOKS.rose, start: { pos: teachA, facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: teachB, dur: FOREVER }] },
    { id: 'tomas', name: 'Tomás', look: LOOKS.sage, start: { pos: teachB, facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: teachA, dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'T2b' }, script: [{ type: 'sit', seat: 'T2b', dur: FOREVER }] },
    {
      id: 'kofi',
      name: 'Kofi',
      look: LOOKS.sky,
      start: { pos: v(-7.3, 3.2), facing: 0 },
      script: [{ type: 'walk', to: v(-4.6, 2.9) }, { type: 'queue', orderDur: 3.5 }, { type: 'sit', seat: 'T6a', dur: FOREVER }],
    },
    { id: 'iris', name: 'Iris', look: LOOKS.plum, start: { pos: v(4.3, -1.55), facing: -Math.PI / 2 }, script: [{ type: 'browse', face: -Math.PI / 2, dur: FOREVER }] },
  ],
};

// ---- GENERALIZE: a different pair, elsewhere, on the way to Table 5
const T5_SERVE = v(2.2, 2.64);
const [genA, genB] = pairAcross(PICKUP, T5_SERVE, 0.6, 1.08);

const generalize: Scenario = {
  id: 'generalize',
  title: 'Generalize',
  subtitle: 'A new conversation in a new spot, on the way to Table 5. No new instruction.',
  duration: 40,
  robotStart: { pos: PICKUP, heading: Math.PI / 2 },
  delivery: { tableId: 'T5', at: 1.5, item: 'cocoa' },
  allowQueries: false,
  groups: [{ id: 'g-gen', members: ['ravi', 'june'] }],
  customers: [
    { id: 'ravi', name: 'Ravi', look: LOOKS.teal, start: { pos: genA, facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: genB, dur: FOREVER }] },
    { id: 'june', name: 'June', look: LOOKS.honey, start: { pos: genB, facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: genA, dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.rose, start: { pos: v(0, 0), facing: 0, seated: 'T3a' }, script: [{ type: 'sit', seat: 'T3a', dur: FOREVER }] },
    { id: 'leo', name: 'Leo', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'T4b' }, script: [{ type: 'sit', seat: 'T4b', dur: FOREVER }] },
    {
      id: 'sol',
      name: 'Sol',
      look: LOOKS.sky,
      start: { pos: v(-7.3, 3.2), facing: 0 },
      script: [{ type: 'wait', dur: 3 }, { type: 'walk', to: v(-4.6, 2.9) }, { type: 'queue', orderDur: 3 }, { type: 'sit', seat: 'T1a', dur: FOREVER }],
    },
  ],
};

// ---- ADAPT: someone unexpectedly crosses Baymax's route to Table 6
const adapt: Scenario = {
  id: 'adapt',
  title: 'Adapt',
  subtitle: 'A customer leaves the pastry case and crosses Baymax’s route.',
  duration: 40,
  robotStart: { pos: PICKUP, heading: Math.PI / 2 },
  delivery: { tableId: 'T6', at: 1.0, item: 'espresso' },
  allowQueries: false,
  groups: [{ id: 'g-adapt', members: ['ines', 'oskar'] }],
  customers: [
    {
      id: 'nora',
      name: 'Nora',
      look: LOOKS.plum,
      start: { pos: v(3.6, -1.55), facing: -Math.PI / 2 },
      speed: 1.1,
      script: [{ type: 'waitUntil', t: 1.4, face: -Math.PI / 2, pose: 'browsing' }, { type: 'leave' }],
    },
    { id: 'ines', name: 'Inès', look: LOOKS.teal, start: { pos: v(5.0, 3.6), facing: 0 }, script: [{ type: 'chat', group: 'g-adapt', lookAt: v(6.2, 3.0), dur: FOREVER }] },
    { id: 'oskar', name: 'Oskar', look: LOOKS.sky, start: { pos: v(6.2, 3.0), facing: 0 }, script: [{ type: 'chat', group: 'g-adapt', lookAt: v(5.0, 3.6), dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'T1a' }, script: [{ type: 'sit', seat: 'T1a', dur: FOREVER }] },
    { id: 'leo', name: 'Leo', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'T5b' }, script: [{ type: 'sit', seat: 'T5b', dur: FOREVER }] },
  ],
};

export const CLASSIC_SCENARIOS: Record<ScenarioId, Scenario> = { teach, generalize, adapt };
