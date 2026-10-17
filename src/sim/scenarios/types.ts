import type { Vec2 } from '../../core/vec';
import type { CustomerSpec } from '../customers';

export type ScenarioId = 'teach' | 'generalize' | 'adapt';

export interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  duration: number;
  customers: CustomerSpec[];
  groups: { id: string; members: string[] }[];
  delivery: { tableId: string; at: number; item: string };
  allowQueries: boolean;
  robotStart: { pos: Vec2; heading: number };
}
