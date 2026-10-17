import { useFrame } from '@react-three/fiber';
import { controller } from '../state/controller';

/** Drives the fixed-step simulation from the render loop, before anything renders. */
export function SimDriver() {
  useFrame((_, dt) => controller.advance(dt), -1);
  return null;
}
