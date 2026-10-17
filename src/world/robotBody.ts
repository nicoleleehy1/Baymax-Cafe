// Baymax's physical envelope, shared by the renderer (where the tray is drawn) and by
// planning/tests (the circle the tray must stay inside).
import { ROBOT_RADIUS } from './layoutTypes';

/** Tray carried in front of the chest: height, forward offset of its centre, radius (m). */
export const TRAY_ENVELOPE = { y: 1.12, z: 0.42, r: 0.1 };
/** Widest torso radius (m) and its fore-aft squash; both must fit inside the footprint. */
export const TORSO_ENVELOPE = { r: 0.445, zSquash: 0.9 };

export const CARRY_REACH = TRAY_ENVELOPE.z + TRAY_ENVELOPE.r; // 0.52
export const FOOTPRINT = ROBOT_RADIUS;
