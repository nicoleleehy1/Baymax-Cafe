// Scenario set for the active layout (each layout authors its own three scenarios).
import { LAYOUT_ID } from '../world/layout';
import { CLASSIC_SCENARIOS } from './scenarios/classic';
import { LONG_SCENARIOS } from './scenarios/long';
import { CASS_SCENARIOS, HIRO_SCENARIOS } from './scenarios/upper';
import type { Scenario, ScenarioId } from './scenarios/types';

export type { Scenario, ScenarioId } from './scenarios/types';
const BY_LAYOUT = { classic: CLASSIC_SCENARIOS, long: LONG_SCENARIOS, cass: CASS_SCENARIOS, hiro: HIRO_SCENARIOS } as const;
export const SCENARIOS: Record<ScenarioId, Scenario> = BY_LAYOUT[LAYOUT_ID];
export const SCENARIO_ORDER: ScenarioId[] = ['teach', 'generalize', 'adapt'];
