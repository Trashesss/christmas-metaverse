import { THROW_GAP, type Ball } from '../shared/snowball';
import { positions, send } from './net';
import { useStore } from './store';

/** 매 프레임 바뀌는 값이라 React 상태 밖에 둔다. at은 이 화면에서 본 시각이다. */
export const balls = new Map<string, Ball & { at: number }>();
export const splats: { x: number; y: number; z: number; at: number }[] = [];
export const MAX_SPLATS = 24;
/** 던지거나 맞은 순간의 몸짓 */
export const bumps = new Map<string, { at: number; hit: boolean }>();
/** 카메라가 보는 방향. 버튼과 스페이스바로 던질 때 쓴다. */
export const aim = { x: 0, z: -1 };

let lastThrow = 0;

export function throwBall(dx: number, dz: number) {
  const now = performance.now();
  const len = Math.hypot(dx, dz);
  const { me, scores, editing, gallery } = useStore.getState();
  const p = positions.get(me);
  if (!p || scores[me] === undefined || editing || gallery || len < 0.01 || now - lastThrow < THROW_GAP) return;
  lastThrow = now;
  p.ry = Math.atan2(dx, dz);
  send({ t: 'throw', dx: dx / len, dz: dz / len });
}

/** 바라보는 쪽에 사람이 있으면 그 사람에게, 없으면 정면으로 던진다. */
export function throwAhead() {
  const { me, scores, muted } = useStore.getState();
  const p = positions.get(me);
  if (!p) return;
  let best = { x: aim.x, z: aim.z };
  let near = Infinity;
  for (const id of Object.keys(scores)) {
    const q = positions.get(id);
    if (!q || id === me || muted[id]) continue;
    const x = q.x - p.x;
    const z = q.z - p.z;
    const d = Math.hypot(x, z);
    if (d < near && d > 0.01 && (x * aim.x + z * aim.z) / d > 0.6) [best, near] = [{ x, z }, d];
  }
  throwBall(best.x, best.z);
}
