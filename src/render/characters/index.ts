// The named café cast. Each module is a standalone CharacterSpec for the shared rig;
// Baymax stays in ../Baymax.tsx and Mochi the cat follows him via MochiCat.
import { AUNT_CASS } from './auntCass';
import { FRED } from './fred';
import { GO_GO } from './gogo';
import { HIRO } from './hiro';
import { HONEY_LEMON } from './honeyLemon';
import type { CharacterSpec } from './rig';
import { WASABI } from './wasabi';

export { CharacterModel, type CharacterSpec, type PersonPose } from './rig';
export { MochiCat, type LeaderPose } from './Mochi';
export { AUNT_CASS, FRED, GO_GO, HIRO, HONEY_LEMON, WASABI };

export const CAST: CharacterSpec[] = [AUNT_CASS, HIRO, GO_GO, WASABI, HONEY_LEMON, FRED];
