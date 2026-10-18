// Scenarios for the long café. Conversation groups are authored annotations; customers'
// scripts are private to the simulation.
import { v } from '../../core/vec';
import { LONG } from '../../world/layouts/long';
import { LOOKS } from './classic';
import type { Scenario, ScenarioId } from './types';

const PICKUP = LONG.pickup;
const FOREVER = 1e6;
/** when the ADAPT customer stands up (timed so she meets Baymax on the open floor) */
const CROSS_AT = 9.2;
const START = { pos: PICKUP, heading: 0 };

// TEACH: a pair chatting in the open floor past the counter, across the way to the window table
// two friends chatting on the open floor by the front window, across the way to the bench
const teachA = v(2.5, 3.64);
const teachB = v(1.3, 1.56);

const teach: Scenario = {
  id: 'teach',
  title: 'Teach',
  subtitle: 'Two friends are chatting between the booths and the communal table, on the way to the window bench.',
  duration: 45,
  robotStart: START,
  delivery: { tableId: 'F', at: 1.5, item: 'latte' },
  allowQueries: true,
  groups: [{ id: 'g-teach', members: ['mei', 'tomas'] }],
  customers: [
    { id: 'mei', name: 'Mei', look: LOOKS.rose, start: { pos: teachA, facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: teachB, dur: FOREVER }] },
    { id: 'tomas', name: 'Tomás', look: LOOKS.sage, start: { pos: teachB, facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: teachA, dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'B2a' }, script: [{ type: 'sit', seat: 'B2a', dur: FOREVER }] },
    { id: 'iris', name: 'Iris', look: LOOKS.plum, start: { pos: v(0, 0), facing: 0, seated: 'T1b' }, script: [{ type: 'sit', seat: 'T1b', dur: FOREVER }] },
    { id: 'kofi', name: 'Kofi', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'F1' }, script: [{ type: 'sit', seat: 'F1', dur: FOREVER }] },
  ],
};

// GENERALIZE: a different pair, by the window booths, on the way to Booth 1
// a different pair, chatting in the gap between the booths and the communal table
const genA = v(4.6, 0.1);
const genB = v(4.6, -2.2);

const generalize: Scenario = {
  id: 'generalize',
  title: 'Generalize',
  subtitle: 'A new conversation by the front window, on the way to the bench by the restroom. No new instruction.',
  duration: 45,
  robotStart: START,
  delivery: { tableId: 'FL', at: 1.5, item: 'cocoa' },
  allowQueries: false,
  groups: [{ id: 'g-gen', members: ['ravi', 'june'] }],
  customers: [
    { id: 'ravi', name: 'Ravi', look: LOOKS.teal, start: { pos: genA, facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: genB, dur: FOREVER }] },
    { id: 'june', name: 'June', look: LOOKS.honey, start: { pos: genB, facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: genA, dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.rose, start: { pos: v(0, 0), facing: 0, seated: 'T2b' }, script: [{ type: 'sit', seat: 'T2b', dur: FOREVER }] },
    { id: 'leo', name: 'Leo', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'C3a' }, script: [{ type: 'sit', seat: 'C3a', dur: FOREVER }] },
    { id: 'sol', name: 'Sol', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'T3b' }, script: [{ type: 'sit', seat: 'T3b', dur: FOREVER }] },
  ],
};

// ADAPT: someone gets up from the communal table and crosses Baymax's route to the restroom
const adapt: Scenario = {
  id: 'adapt',
  title: 'Adapt',
  subtitle: 'A customer comes out of the restroom and crosses Baymax’s route to the communal table.',
  duration: 45,
  robotStart: START,
  delivery: { tableId: 'FL', at: 1.0, item: 'espresso' },
  allowQueries: false,
  groups: [{ id: 'g-adapt', members: ['ines', 'oskar'] }],
  customers: [
    {
      id: 'nora',
      name: 'Nora',
      look: LOOKS.plum,
      start: { pos: LONG.restroom!, facing: Math.PI / 2 },
      speed: 1.05,
      script: [{ type: 'waitUntil', t: CROSS_AT, face: Math.PI / 2 }, { type: 'sit', seat: 'C4a', dur: FOREVER }],
    },
    { id: 'ines', name: 'Inès', look: LOOKS.teal, start: { pos: v(0, 0), facing: 0, seated: 'B3a' }, script: [{ type: 'sit', seat: 'B3a', dur: FOREVER }] },
    { id: 'oskar', name: 'Oskar', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'B3b' }, script: [{ type: 'sit', seat: 'B3b', dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'T2a' }, script: [{ type: 'sit', seat: 'T2a', dur: FOREVER }] },
    { id: 'leo', name: 'Leo', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'F1' }, script: [{ type: 'sit', seat: 'F1', dur: FOREVER }] },
  ],
};

export const LONG_SCENARIOS: Record<ScenarioId, Scenario> = { teach, generalize, adapt };
