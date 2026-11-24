import { ARENA, FORTS_COLLIDERS, FORT_HEIGHT } from './world';

export const THROW_GAP = 600;
/** 맞은 뒤와 들어온 직후에는 잠시 맞지 않는다. */
export const SAFE_MS = 1500;
const SPEED = 13;
const RISE = 2.6;
const GRAVITY = 9;
const START_Y = 1.15;

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

export const inArena = (x: number, z: number, margin = 0) => Math.hypot(x - ARENA.x, z - ARENA.z) <= ARENA.r + margin;

/** 바닥이나 요새에 부딪히거나 눈싸움장을 벗어났는지 */
export const stopped = ({ x, y, z }: { x: number; y: number; z: number }) =>
  y <= 0 || !inArena(x, z, 1) || (y < FORT_HEIGHT && FORTS_COLLIDERS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r));

export const touches = (ball: { x: number; y: number; z: number }, p: { x: number; z: number }) =>
  ball.y < 1.6 && Math.hypot(ball.x - p.x, ball.z - p.z) < 0.55;
