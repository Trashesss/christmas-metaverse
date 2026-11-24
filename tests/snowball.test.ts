import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { DEFAULT_LOOKS } from '../shared/look';
import type { ServerMessage } from '../shared/protocol';
import { SAFE_MS, THROW_GAP, ballAt, inArena, stopped } from '../shared/snowball';
import { ARENA, FORTS, SPAWN, STATIONS, resolveMove } from '../shared/world';

let now = 0;
let inbox: Record<string, ServerMessage[]>;
let world: World;

function of<T extends ServerMessage['t']>(id: string, t: T) {
  return (inbox[id] ?? []).filter((m) => m.t === t) as Extract<ServerMessage, { t: T }>[];
}
const at = (id: string, dx: number, dz = 0) =>
  world.handle(id, { t: 'move', x: ARENA.x + dx, z: ARENA.z + dz, ry: 0, moving: false });
const toss = (id: string, dx: number, dz = 0) => world.handle(id, { t: 'throw', dx, dz });
function run(ms: number) {
  for (const end = now + ms; now < end; now += 33) world.stepBalls();
}
const scores = () => of('c', 'scores').at(-1)!.scores;

beforeEach(() => {
  now = 100_000;
  inbox = {};
  world = new World((id, m) => (inbox[id] ??= []).push(structuredClone(m)), () => now);
  for (const id of ['a', 'b', 'c']) world.handle(id, { t: 'join', name: id, look: DEFAULT_LOOKS.female });
  at('a', -2);
  at('b', 1);
  now += SAFE_MS;
});

describe('snowball fight', () => {
  it('a hit scores once and is seen by everyone', () => {
    toss('a', 1);
    run(1000);
    expect(of('c', 'splat').map((m) => m.hit)).toEqual(['b']);
    expect(scores()).toEqual({ a: 1, b: 0 });
  });

  it('people outside neither throw nor get hit', () => {
    at('b', 30);
    toss('b', -1);
    toss('a', 1);
    run(2000);
    expect(of('c', 'throw')).toHaveLength(1);
    expect(of('c', 'splat')[0].hit).toBeNull();
    expect(scores()).toEqual({ a: 0 });
  });

  it('limits how often one can throw', () => {
    toss('a', 1);
    toss('a', 1);
    expect(of('c', 'throw')).toHaveLength(1);
    now += THROW_GAP;
    toss('a', 1);
    expect(of('c', 'throw')).toHaveLength(2);
  });

  it('is safe right after a hit and right after entering', () => {
    toss('a', 1);
    run(THROW_GAP + 50);
    toss('a', 1);
    run(700);
    expect(scores().a).toBe(1);
    at('b', 30);
    at('b', 1);
    now += THROW_GAP;
    toss('a', 1);
    run(500);
    expect(scores().a).toBe(1);
  });

  it.each([2.5, 4, 5.5, 7, 9])('every fort protects the person behind it from %sm', (range) => {
    for (const f of FORTS) {
      const ux = (f.x - ARENA.x) / 4;
      const uz = (f.z - ARENA.z) / 4;
      at('b', ux * 5, uz * 5);
      at('a', ux * (5 - range), uz * (5 - range));
      now += SAFE_MS;
      toss('a', ux, uz);
      run(1500);
    }
    expect(of('c', 'splat').map((m) => m.hit)).toEqual(FORTS.map(() => null));
  });

  it('a blocked thrower sees a normal hit while the blocker sees nothing', () => {
    world.handle('b', { t: 'mute', id: 'a', on: true });
    toss('a', 1);
    run(1000);
    expect(of('a', 'splat')[0].hit).toBe('b');
    expect(scores().a).toBe(1);
    expect(of('b', 'throw')).toHaveLength(0);
    expect(of('b', 'splat')).toHaveLength(0);
  });

  it('leaving, disconnecting or starting an activity removes the score', () => {
    at('a', 30);
    expect(scores()).toEqual({ b: 0 });
    world.disconnect('b');
    expect(scores()).toEqual({});
    at('a', 0);
    world.handle('a', { t: 'wait', kind: 'cake' });
    world.handle('c', { t: 'wait', kind: 'cake' });
    expect(scores()).toEqual({});
  });

  it('a thrower who left does not score, and balls always end', () => {
    toss('a', 1);
    world.disconnect('a');
    run(3000);
    expect(of('c', 'splat')).toHaveLength(1);
    expect(scores()).toEqual({ b: 0 });
  });

  it('rejects a throw without direction', () => {
    toss('a', 0, 0);
    expect(of('c', 'throw')).toHaveLength(0);
  });
});

describe('arena', () => {
  it('is away from spawn and stations, and reachable', () => {
    for (const p of [SPAWN, STATIONS.cake, STATIONS.tree]) expect(inArena(p.x, p.z, 3)).toBe(false);
    expect(resolveMove(ARENA.x, ARENA.z)).toEqual({ x: ARENA.x, z: ARENA.z });
  });

  it('a ball lands within about 12m', () => {
    const b = { id: '', from: '', x: ARENA.x, z: ARENA.z, dx: 1, dz: 0 };
    let t = 0;
    while (!stopped(ballAt(b, t))) t += 0.02;
    expect(t).toBeLessThan(1);
  });
});
