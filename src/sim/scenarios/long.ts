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
const OUTSIDE = v(8.25, 3.75);

// TEACH: a pair chatting in the open floor past the counter, across the way to the window table
// facing each other north-south across the open floor past the counter
const teachA = v(3.9, 0.25);
const teachB = v(3.9, -1.95);

const teach: Scenario = {
  id: 'teach',
  title: 'Teach',
  subtitle: 'Two friends are chatting on the open floor between Baymax and the window table.',
  duration: 45,
  robotStart: START,
  delivery: { tableId: 'T4', at: 1.5, item: 'latte' },
  allowQueries: true,
  groups: [{ id: 'g-teach', members: ['mei', 'tomas'] }],
  customers: [
    { id: 'mei', name: 'Mei', look: LOOKS.rose, start: { pos: teachA, facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: teachB, dur: FOREVER }] },
    { id: 'tomas', name: 'Tomás', look: LOOKS.sage, start: { pos: teachB, facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: teachA, dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'B2a' }, script: [{ type: 'sit', seat: 'B2a', dur: FOREVER }] },
    { id: 'iris', name: 'Iris', look: LOOKS.plum, start: { pos: v(0, 0), facing: 0, seated: 'T1b' }, script: [{ type: 'sit', seat: 'T1b', dur: FOREVER }] },
    {
      id: 'kofi',
      name: 'Kofi',
      look: LOOKS.sky,
      start: { pos: OUTSIDE, facing: Math.PI },
      script: [{ type: 'wait', dur: 16 }, { type: 'walk', to: v(6.4, 2.0) }, { type: 'queue', orderDur: 3.5 }, { type: 'sit', seat: 'C2a', dur: FOREVER }],
    },
  ],
};

// GENERALIZE: a different pair, by the window booths, on the way to Booth 1
// facing each other east-west across the short walk from the counter to Booth 1
const genA = v(-6.33, 0.45);
const genB = v(-4.42, 0.62);

const generalize: Scenario = {
  id: 'generalize',
  title: 'Generalize',
  subtitle: 'A new conversation near the window booths, on the way to Booth 1. No new instruction.',
  duration: 45,
  robotStart: START,
  delivery: { tableId: 'B1', at: 1.5, item: 'cocoa' },
  allowQueries: false,
  groups: [{ id: 'g-gen', members: ['ravi', 'june'] }],
  customers: [
    { id: 'ravi', name: 'Ravi', look: LOOKS.teal, start: { pos: genA, facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: genB, dur: FOREVER }] },
    { id: 'june', name: 'June', look: LOOKS.honey, start: { pos: genB, facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: genA, dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.rose, start: { pos: v(0, 0), facing: 0, seated: 'T2a' }, script: [{ type: 'sit', seat: 'T2a', dur: FOREVER }] },
    { id: 'leo', name: 'Leo', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'C3a' }, script: [{ type: 'sit', seat: 'C3a', dur: FOREVER }] },
    {
      id: 'sol',
      name: 'Sol',
      look: LOOKS.sky,
      start: { pos: OUTSIDE, facing: Math.PI },
      script: [{ type: 'wait', dur: 14 }, { type: 'walk', to: v(6.4, 2.0) }, { type: 'queue', orderDur: 3 }, { type: 'sit', seat: 'T3b', dur: FOREVER }],
    },
  ],
};

// ADAPT: someone gets up from the communal table and crosses Baymax's route to the restroom
const adapt: Scenario = {
  id: 'adapt',
  title: 'Adapt',
  subtitle: 'A customer gets up from the communal table and crosses Baymax’s route.',
  duration: 45,
  robotStart: START,
  delivery: { tableId: 'T4', at: 1.0, item: 'espresso' },
  allowQueries: false,
  groups: [{ id: 'g-adapt', members: ['ines', 'oskar'] }],
  customers: [
    {
      id: 'nora',
      name: 'Nora',
      look: LOOKS.plum,
      start: { pos: v(0, 0), facing: 0, seated: 'C2a' },
      speed: 1.05,
      script: [{ type: 'sit', seat: 'C2a', dur: CROSS_AT }, { type: 'exit', to: LONG.restroom! }],
    },
    { id: 'ines', name: 'Inès', look: LOOKS.teal, start: { pos: v(0, 0), facing: 0, seated: 'B3a' }, script: [{ type: 'sit', seat: 'B3a', dur: FOREVER }] },
    { id: 'oskar', name: 'Oskar', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'B3b' }, script: [{ type: 'sit', seat: 'B3b', dur: FOREVER }] },
    { id: 'ana', name: 'Ana', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'T2a' }, script: [{ type: 'sit', seat: 'T2a', dur: FOREVER }] },
    { id: 'leo', name: 'Leo', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'T4a' }, script: [{ type: 'sit', seat: 'T4a', dur: FOREVER }] },
  ],
};

export const LONG_SCENARIOS: Record<ScenarioId, Scenario> = { teach, generalize, adapt };
