// Baymax's physical envelope, shared by the renderer (where the tray is drawn) and by
// planning/tests (the circle the tray must stay inside).
import { CARRY, ROBOT_RADIUS } from './layout';

/** Tray carried in front of the chest: height, forward offset of its centre, radius (m). */
export const TRAY_ENVELOPE = { y: 1.12, z: 0.42, r: 0.1, kind: 'tray' as const };
/** A single cup held close to the chest (upstairs): far edge 0.43 m, inside the 0.46 m footprint. */
export const CUP_ENVELOPE = { y: 1.14, z: 0.36, r: 0.07, kind: 'cup' as const };
/** What Baymax carries on the active layout. */
export const CARRY_ENVELOPE = CARRY === 'cup' ? CUP_ENVELOPE : TRAY_ENVELOPE;
/** Widest torso radius (m) and its fore-aft squash; both must fit inside the footprint. */
export const TORSO_ENVELOPE = { r: 0.445, zSquash: 0.9 };

export const CARRY_REACH = CARRY_ENVELOPE.z + CARRY_ENVELOPE.r; // 0.52 with the tray, 0.43 with a cup
export const FOOTPRINT = ROBOT_RADIUS;
