import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { DEFAULT_LOOKS } from '../shared/look';
import type { ServerMessage } from '../shared/protocol';
import { SAFE_MS, THROW_GAP, ballAt, stopped } from '../shared/snowball';
import { COLLIDERS, SPAWN } from '../shared/world';

let now = 0;
let inbox: Record<string, ServerMessage[]>;
let world: World;

function of<T extends ServerMessage['t']>(id: string, t: T) {
  return (inbox[id] ?? []).filter((m) => m.t === t) as Extract<ServerMessage, { t: T }>[];
}
const at = (id: string, dx: number, dz = 0) =>
  world.handle(id, { t: 'move', x: SPAWN.x + dx, z: SPAWN.z + dz, ry: 0, moving: false });
const pair = () => {
  world.handle('b', { t: 'wait', kind: 'cake' });
  world.handle('c', { t: 'wait', kind: 'cake' });
};
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
    expect(scores()).toEqual({ a: 1, b: 0, c: 0 });
  });

  it('everyone in the plaza plays from the moment they join', () => {
    expect(scores()).toEqual({ a: 0, b: 0, c: 0 });
    at('b', -20, -30);
    expect(scores()).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('people in an activity neither throw nor get hit', () => {
    pair();
    expect(scores()).toEqual({ a: 0 });
    toss('b', -1);
    expect(of('a', 'throw')).toHaveLength(0);
    const { x, z } = of('a', 'player').filter((m) => m.player.id === 'b').at(-1)!.player;
    world.handle('a', { t: 'move', x: x - 2, z, ry: 0, moving: false });
    now += SAFE_MS;
    toss('a', 1);
    run(1500);
    expect(of('a', 'splat')[0].hit).toBeNull();
  });

  it('limits how often one can throw', () => {
    toss('a', 1);
    toss('a', 1);
    expect(of('c', 'throw')).toHaveLength(1);
    now += THROW_GAP;
    toss('a', 1);
    expect(of('c', 'throw')).toHaveLength(2);
  });

  it('is safe right after a hit and right after coming back from an activity', () => {
    toss('a', 1);
    run(THROW_GAP + 50);
    toss('a', 1);
    run(700);
    expect(scores().a).toBe(1);
    pair();
    world.handle('b', { t: 'leaveSession' });
    at('b', 1);
    now += THROW_GAP;
    toss('a', 1);
    run(500);
    expect(scores().a).toBe(1);
  });

  it('the central tree protects the person behind it', () => {
    world.handle('a', { t: 'move', x: 0, z: 6, ry: 0, moving: false });
    world.handle('b', { t: 'move', x: 0, z: -5, ry: 0, moving: false });
    toss('a', 0, -1);
    run(1500);
    expect(of('c', 'splat').map((m) => m.hit)).toEqual([null]);
    expect(scores().a).toBe(0);
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

  it('disconnecting or starting an activity removes the score, coming back starts from zero', () => {
    toss('a', 1);
    run(1000);
    world.handle('a', { t: 'wait', kind: 'cake' });
    world.handle('c', { t: 'wait', kind: 'cake' });
    expect(scores()).toEqual({ b: 0 });
    world.handle('a', { t: 'leaveSession' });
    expect(scores()).toEqual({ a: 0, b: 0 });
    world.disconnect('b');
    expect(scores()).toEqual({ a: 0 });
  });

  it('a thrower who left does not score, and balls always end', () => {
    toss('a', 1);
    world.disconnect('a');
    run(3000);
    expect(of('c', 'splat')).toHaveLength(1);
    expect(scores()).toEqual({ b: 0, c: 0 });
  });

  it('rejects a throw without direction', () => {
    toss('a', 0, 0);
    expect(of('c', 'throw')).toHaveLength(0);
  });
});

describe('flight', () => {
  it('a ball lands within about 12m', () => {
    const b = { id: '', from: '', x: SPAWN.x, z: SPAWN.z, dx: -1, dz: 0 };
    let t = 0;
    while (!stopped(ballAt(b, t))) t += 0.02;
    expect(t).toBeLessThan(1);
  });

  it('buildings, trees and low things stop balls', () => {
    for (const c of COLLIDERS) expect(stopped({ x: c.x, y: 1, z: c.z })).toBe(true);
    expect(stopped({ x: 0, y: 1.5, z: 0 })).toBe(true);
    // 가는 나무, 눈사람, 가로등은 눈덩이가 가장 높이 떠도 막는다.
    for (const c of COLLIDERS.filter((c) => c.block)) expect(stopped({ x: c.x, y: 1.53, z: c.z })).toBe(true);
    expect(stopped({ x: SPAWN.x, y: 1, z: SPAWN.z })).toBe(false);
  });
});
