import { COLLIDERS, PLAZA_RADIUS } from './world';

export const THROW_GAP = 600;
/** 맞은 뒤와 광장에 들어온 직후에는 잠시 맞지 않는다. */
export const SAFE_MS = 1500;
const SPEED = 13;
const RISE = 2.6;
const GRAVITY = 9;
const START_Y = 1.15;
/** 높이를 모르는 낮은 물건(벤치, 눈사람, 전시대)은 이 높이까지 눈을 막는다. */
const LOW_HEIGHT = 1.2;
const TREE_RADIUS = 2.6;

export interface Ball {
  id: string;
  from: string;
  x: number;
  z: number;
  dx: number;
  dz: number;
}

export function ballAt(b: Ball, t: number) {
  return { x: b.x + b.dx * SPEED * t, y: START_Y + RISE * t - (GRAVITY * t * t) / 2, z: b.z + b.dz * SPEED * t };
}

/** 바닥, 가운데 트리, 건물이나 나무 같은 물건에 부딪히거나 광장을 벗어났는지 */
export const stopped = ({ x, y, z }: { x: number; y: number; z: number }) =>
  y <= 0 ||
  Math.hypot(x, z) > PLAZA_RADIUS + 1 ||
  Math.hypot(x, z) < TREE_RADIUS ||
  COLLIDERS.some((c) => y < (c.block ?? c.h ?? LOW_HEIGHT) && Math.hypot(x - c.x, z - c.z) < c.r);

export const touches = (ball: { x: number; y: number; z: number }, p: { x: number; z: number }) =>
  ball.y < 1.6 && Math.hypot(ball.x - p.x, ball.z - p.z) < 0.55;
