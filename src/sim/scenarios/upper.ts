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
  subtitle: 'Cass and Honey Lemon are catching up in the hallway, between the stairs and the sofa.',
  duration: 45,
  robotStart: C_START,
  delivery: { tableId: 'SOFA', at: 1.5, item: 'cocoa' },
  allowQueries: true,
  groups: [{ id: 'g-teach', members: ['cass', 'honey'] }],
  customers: [
    { id: 'cass', name: 'Aunt Cass', character: 'cass', look: LOOKS.honey, start: { pos: v(-3.06, 1.06), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(-1.44, -0.56), dur: FOREVER }] },
    { id: 'honey', name: 'Honey Lemon', character: 'honey', look: LOOKS.rose, start: { pos: v(-1.44, -0.56), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(-3.06, 1.06), dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'S1' }, script: [{ type: 'sit', seat: 'S1', dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'AC' }, script: [{ type: 'sit', seat: 'AC', dur: FOREVER }] },
  ],
};

const cassGeneralize: Scenario = {
  id: 'generalize',
  title: 'Generalize',
  subtitle: 'Go Go and Wasabi are talking by the dining table, on the way to the bedroom. No new instruction.',
  duration: 45,
  robotStart: C_START,
  delivery: { tableId: 'BED', at: 1.5, item: 'tea' },
  allowQueries: false,
  groups: [{ id: 'g-gen', members: ['gogo', 'wasabi'] }],
  customers: [
    { id: 'gogo', name: 'Go Go', character: 'gogo', look: LOOKS.plum, start: { pos: v(0.75, -0.1), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(0.75, -2.4), dur: FOREVER }] },
    { id: 'wasabi', name: 'Wasabi', character: 'wasabi', look: LOOKS.teal, start: { pos: v(0.75, -2.4), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(0.75, -0.1), dur: FOREVER }] },
    { id: 'cass', name: 'Aunt Cass', character: 'cass', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'BD' }, script: [{ type: 'sit', seat: 'BD', dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'S2' }, script: [{ type: 'sit', seat: 'S2', dur: FOREVER }] },
  ],
};

const cassAdapt: Scenario = {
  id: 'adapt',
  title: 'Adapt',
  subtitle: 'Hiro gets up from the sofa and heads to the bedroom, across Baymax’s way to the armchair.',
  duration: 45,
  robotStart: C_START,
  delivery: { tableId: 'ARM', at: 1.0, item: 'tea' },
  allowQueries: false,
  groups: [],
  customers: [
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, speed: 1.0, start: { pos: v(0, 0), facing: 0, seated: 'S1' }, script: [{ type: 'sit', seat: 'S1', dur: 10.0 }, { type: 'sit', seat: 'BD', dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'AC' }, script: [{ type: 'sit', seat: 'AC', dur: FOREVER }] },
    { id: 'cass', name: 'Aunt Cass', character: 'cass', look: LOOKS.honey, start: { pos: v(0, 0), facing: 0, seated: 'D1' }, script: [{ type: 'sit', seat: 'D1', dur: FOREVER }] },
  ],
};

export const CASS_SCENARIOS: Record<ScenarioId, Scenario> = { teach: cassTeach, generalize: cassGeneralize, adapt: cassAdapt };

// ---------------------------------------------------------------- floor 3 · Hiro
const H_START = { pos: HIRO.pickup, heading: 0 };

const hiroTeach: Scenario = {
  id: 'teach',
  title: 'Teach',
  subtitle: 'Go Go and Wasabi are mid-argument in front of the workbench, on the way to the desk.',
  duration: 45,
  robotStart: H_START,
  delivery: { tableId: 'DESK', at: 1.5, item: 'gummy bears' },
  allowQueries: true,
  groups: [{ id: 'g-teach', members: ['gogo', 'wasabi'] }],
  customers: [
    { id: 'gogo', name: 'Go Go', character: 'gogo', look: LOOKS.plum, start: { pos: v(2.2, 0.0), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(2.2, -2.3), dur: FOREVER }] },
    { id: 'wasabi', name: 'Wasabi', character: 'wasabi', look: LOOKS.teal, start: { pos: v(2.2, -2.3), facing: 0 }, script: [{ type: 'chat', group: 'g-teach', lookAt: v(2.2, 0.0), dur: FOREVER }] },
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, start: { pos: v(0, 0), facing: 0, seated: 'DK' }, script: [{ type: 'sit', seat: 'DK', dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(0, 0), facing: 0, seated: 'HB' }, script: [{ type: 'sit', seat: 'HB', dur: FOREVER }] },
  ],
};

const hiroGeneralize: Scenario = {
  id: 'generalize',
  title: 'Generalize',
  subtitle: 'Honey Lemon and Fred are chatting by the bookshelf, on the way to the bed. No new instruction.',
  duration: 45,
  robotStart: H_START,
  delivery: { tableId: 'HBED', at: 1.5, item: 'tea' },
  allowQueries: false,
  groups: [{ id: 'g-gen', members: ['honey', 'fred'] }],
  customers: [
    { id: 'honey', name: 'Honey Lemon', character: 'honey', look: LOOKS.rose, start: { pos: v(0.59, 3.25), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(1.41, 1.25), dur: FOREVER }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(1.41, 1.25), facing: 0 }, script: [{ type: 'chat', group: 'g-gen', lookAt: v(0.59, 3.25), dur: FOREVER }] },
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
    { id: 'hiro', name: 'Hiro', character: 'hiro', look: LOOKS.sky, speed: 1.15, start: { pos: v(0, 0), facing: 0, seated: 'HB' }, script: [{ type: 'sit', seat: 'HB', dur: 6.0 }, { type: 'exit', to: HIRO.restroom! }] },
    { id: 'fred', name: 'Fred', character: 'fred', look: LOOKS.sage, start: { pos: v(-4.79, 0.21), facing: 0, seated: 'GB' }, script: [{ type: 'sit', seat: 'GB', dur: FOREVER }] },
  ],
};

export const HIRO_SCENARIOS: Record<ScenarioId, Scenario> = { teach: hiroTeach, generalize: hiroGeneralize, adapt: hiroAdapt };
