// Scenarios for the upper floors. Same planner, predictor and preference model as the café;
// only the map, the destinations and the people change. Conversation groups are authored.
import { v } from '../../core/vec';
import { CASS, HIRO } from '../../world/layouts/upper';
import { LOOKS } from './classic';
import type { Scenario, ScenarioId } from './types';

const FOREVER = 1e6;

// ---------------------------------------------------------------- floor 2 · Aunt Cass
const C_START = { pos: CASS.pickup, heading: 0 };

const cassTeach: Scenario = {
  id: 'teach',
  title: 'Teach',
  subtitle: 'Cass and Honey Lemon are catching up in the hall, between the stairs and the second sofa.',
  duration: 45,
  robotStart: C_START,
  delivery: { tableId: 'ARM', at: 1.5, item: 'cocoa' },
  allowQueries: true,
  groups: [{ id: 'g-teach', members: ['cass', 'honey'] }],
  customers: [
    { id: 'cass', name: 'Aunt Cass', character: 'cass', look: LOOKS.honey, start: { pos: v(-1.01, 0.7), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(1.41, -0.7), dur: FOREVER }] },
    { id: 'honey', name: 'Honey Lemon', character: 'honey', look: LOOKS.rose, start: { pos: v(1.41, -0.7), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(-1.01, 0.7), dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'AC' }, script: [{ type: 'sit', seat: 'AC', dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'S1' }, script: [{ type: 'sit', seat: 'S1', dur: FOREVER }] },
  ],
};

const cassGeneralize: Scenario = {
  id: 'generalize',
  title: 'Generalize',
  subtitle: 'Go Go and Wasabi are talking at the bedroom door, on the way to Cass’s bed. No new instruction.',
  duration: 45,
  robotStart: C_START,
  delivery: { tableId: 'BED', at: 1.5, item: 'tea' },
  allowQueries: false,
  groups: [{ id: 'g-gen', members: ['gogo', 'wasabi'] }],
  customers: [
    { id: 'gogo', name: 'Go Go', character: 'gogo', look: LOOKS.plum, start: { pos: v(4.5, 0.51), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(3.1, -1.91), dur: FOREVER }] },
    { id: 'wasabi', name: 'Wasabi', character: 'wasabi', look: LOOKS.teal, start: { pos: v(3.1, -1.91), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(4.5, 0.51), dur: FOREVER }] },
    { id: 'cass', name: 'Aunt Cass', character: 'cass', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'BD' }, script: [{ type: 'sit', seat: 'BD', dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'S2' }, script: [{ type: 'sit', seat: 'S2', dur: FOREVER }] },
  ],
};

const cassAdapt: Scenario = {
  id: 'adapt',
  title: 'Adapt',
  subtitle: 'Cass heads from the kitchen to the bedroom, across Baymax’s way to the sofa.',
  duration: 45,
  robotStart: C_START,
  delivery: { tableId: 'ARM', at: 1.0, item: 'tea' },
  allowQueries: false,
  groups: [],
  customers: [
    { id: 'cass', name: 'Aunt Cass', character: 'cass', look: LOOKS.honey, speed: 1.0, start: { pos: CASS.orderSpot, facing: Math.PI }, script: [{ type: 'waitUntil', t: 3.0, face: Math.PI }, { type: 'sit', seat: 'BD', dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'D2' }, script: [{ type: 'sit', seat: 'D2', dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'AC' }, script: [{ type: 'sit', seat: 'AC', dur: FOREVER }] },
  ],
};

export const CASS_SCENARIOS: Record<ScenarioId, Scenario> = { teach: cassTeach, generalize: cassGeneralize, adapt: cassAdapt };

// ---------------------------------------------------------------- floor 3 · Hiro
const H_START = { pos: HIRO.pickup, heading: 0 };

const hiroTeach: Scenario = {
  id: 'teach',
  title: 'Teach',
  subtitle: 'Go Go and Wasabi are mid-argument in the middle of the room, on the way to Hiro’s bed.',
  duration: 45,
  robotStart: H_START,
  delivery: { tableId: 'HBED2', at: 1.5, item: 'gummy bears' },
  allowQueries: true,
  groups: [{ id: 'g-teach', members: ['gogo', 'wasabi'] }],
  customers: [
    { id: 'gogo', name: 'Go Go', character: 'gogo', look: LOOKS.plum, start: { pos: v(2.5, -0.56), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(1.3, -2.64), dur: FOREVER }] },
    { id: 'wasabi', name: 'Wasabi', character: 'wasabi', look: LOOKS.teal, start: { pos: v(1.3, -2.64), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(2.5, -0.56), dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'HB2' }, script: [{ type: 'sit', seat: 'HB2', dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'DK' }, script: [{ type: 'sit', seat: 'DK', dur: FOREVER }] },
  ],
};

const hiroGeneralize: Scenario = {
  id: 'generalize',
  title: 'Generalize',
  subtitle: 'Honey Lemon and Fred are chatting by the workbenches, on the way to Tadashi’s bed. No new instruction.',
  duration: 45,
  robotStart: H_START,
  delivery: { tableId: 'HBED', at: 1.5, item: 'tea' },
  allowQueries: false,
  groups: [{ id: 'g-gen', members: ['honey', 'fred'] }],
  customers: [
    { id: 'honey', name: 'Honey Lemon', character: 'honey', look: LOOKS.rose, start: { pos: v(0.09, 1.5), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(2.51, 0.1), dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(2.51, 0.1), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(0.09, 1.5), dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'HB' }, script: [{ type: 'sit', seat: 'HB', dur: FOREVER }] },
    { id: 'gogo', name: 'Go Go', character: 'gogo', look: LOOKS.plum, start: { pos: v(0, 0), facing: 0, seated: 'WB' }, script: [{ type: 'sit', seat: 'WB', dur: FOREVER }] },
  ],
};

const hiroAdapt: Scenario = {
  id: 'adapt',
  title: 'Adapt',
  subtitle: 'Hiro jumps up from the bed and dashes to the bathroom, straight across Baymax’s route.',
  duration: 45,
  robotStart: H_START,
  delivery: { tableId: 'DESK', at: 1.0, item: 'tea' },
  allowQueries: false,
  groups: [],
  customers: [
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, speed: 1.15, start: { pos: v(0, 0), facing: 0, seated: 'HB' }, script: [{ type: 'sit', seat: 'HB', dur: 1.5 }, { type: 'exit', to: HIRO.restroom! }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'HB2' }, script: [{ type: 'sit', seat: 'HB2', dur: FOREVER }] },
  ],
};

export const HIRO_SCENARIOS: Record<ScenarioId, Scenario> = { teach: hiroTeach, generalize: hiroGeneralize, adapt: hiroAdapt };
