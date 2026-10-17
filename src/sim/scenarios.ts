// Scenario set for the active layout (each layout authors its own three scenarios).
import { LAYOUT_ID } from '../world/layout';
import { CLASSIC_SCENARIOS } from './scenarios/classic';
import { LONG_SCENARIOS } from './scenarios/long';
import type { Scenario, ScenarioId } from './scenarios/types';

export type { Scenario, ScenarioId } from './scenarios/types';
export const SCENARIOS: Record<ScenarioId, Scenario> = LAYOUT_ID === 'long' ? LONG_SCENARIOS : CLASSIC_SCENARIOS;
export const SCENARIO_ORDER: ScenarioId[] = ['teach', 'generalize', 'adapt'];
