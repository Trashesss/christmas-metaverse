import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '../server/world';
import type { ServerMessage, Vec3 } from '../shared/protocol';
import { MAX_EXHIBITS, PLAZA_RADIUS, STATIONS, COLLIDERS, resolveMove, workSpots } from '../shared/world';

let now = 0;
let inbox: Record<string, ServerMessage[]>;
let world: World;

function of<T extends ServerMessage['t']>(id: string, t: T) {
  return (inbox[id] ?? []).filter((m) => m.t === t) as Extract<ServerMessage, { t: T }>[];
}
const join = (id: string) =>
  world.handle(id, { t: 'join', name: id, character: 'Mage', color: 0 });
const at = (id: string, x: number, z: number) =>
  world.handle(id, { t: 'move', x, z, ry: 0, moving: false });
const place = (id: string, item = 'strawberry', n: Vec3 = [0, 1, 0]) =>
  world.handle(id, { t: 'place', item, color: 0, p: [0, 1.5, 0], n });
function pair(a: string, b: string, kind: 'cake' | 'tree' = 'cake') {
  world.handle(a, { t: 'wait', kind });
  world.handle(b, { t: 'joinWaiting', host: a });
}

beforeEach(() => {
  now = 10_000;
  inbox = {};
  world = new World((id, m) => (inbox[id] ??= []).push(structuredClone(m)), () => now);
  ['a', 'b', 'c'].forEach(join);
});

const draw = (by: string, id: string, pts = [0, 0, 0.1, 0.1]) =>
  world.handle(by, { t: 'stroke', id, tool: 'pen', color: 0, size: 1, pts });

describe('lettering cake', () => {
  beforeEach(() => pair('a', 'b'));

  it('streams strokes to the partner and echoes the start for ordering', () => {
    draw('a', 's1');
    world.handle('a', { t: 'strokeMore', id: 's1', pts: [0.2, 0.2] });
    expect(of('a', 'stroke')).toHaveLength(1);
    expect(of('b', 'stroke')[0].stroke).toMatchObject({ id: 's1', by: 'a' });
    expect(of('b', 'strokeMore')).toHaveLength(1);
    expect(of('a', 'strokeMore')).toHaveLength(0);
    expect(of('c', 'stroke')).toHaveLength(0);
  });

  it('only the author extends or erases a stroke', () => {
    draw('a', 's1');
    world.handle('b', { t: 'strokeMore', id: 's1', pts: [0.2, 0.2] });
    world.handle('b', { t: 'unstroke', id: 's1' });
    expect(of('a', 'unstroke')).toHaveLength(0);
    world.handle('a', { t: 'unstroke', id: 's1' });
    expect(of('b', 'unstroke')).toHaveLength(1);
  });

  it('rejects odd, off-cake and textless strokes', () => {
    draw('a', 'odd', [0, 0, 0.1]);
    draw('a', 'off', [0.9, 0.9]);
    world.handle('a', { t: 'stroke', id: 'txt', tool: 'text', color: 0, size: 1, pts: [0, 0] });
    expect(of('b', 'stroke')).toHaveLength(0);
    expect(of('a', 'unstroke')).toHaveLength(3);
  });

  it('a runaway stroke is capped on both sides', () => {
    draw('a', 's1');
    for (let i = 0; i < 7; i++) world.handle('a', { t: 'strokeMore', id: 's1', pts: Array(128).fill(0) });
    expect(of('a', 'unstroke').map((m) => m.id)).toEqual(['s1']);
    expect(of('b', 'unstroke')).toHaveLength(1);
  });

  it('a drawing alone can be finished, cancels ready, and lands in the gallery', () => {
    draw('a', 's1');
    world.handle('a', { t: 'ready', on: true });
    draw('b', 's2');
    expect(of('a', 'sessionMeta').at(-1)!.ready).toEqual([]);
    world.handle('a', { t: 'ready', on: true });
    world.handle('b', { t: 'ready', on: true });
    now += 1000;
    world.handle('c', { t: 'gallery' });
    const [cake] = of('c', 'gallery')[0].cakes;
    expect(cake.names).toEqual(['a', 'b']);
    expect(cake.strokes.map((k) => k.id)).toEqual(['s1', 's2']);
  });

  it('trees cannot be painted and stay out of the gallery', () => {
    world.handle('a', { t: 'leaveSession' });
    world.handle('b', { t: 'leaveSession' });
    pair('a', 'b', 'tree');
    draw('a', 's1');
    expect(of('b', 'stroke')).toHaveLength(0);
    place('a', 'star');
    world.handle('a', { t: 'ready', on: true });
    world.handle('b', { t: 'ready', on: true });
    now += 1000;
    world.handle('c', { t: 'gallery' });
    expect(of('c', 'gallery')[0].cakes).toEqual([]);
  });
});

describe('plaza', () => {
  it('only nearby people hear chat', () => {
    at('a', 0, 5);
    at('b', 2, 5);
    at('c', 0, -15);
    world.handle('a', { t: 'chat', text: '안녕', session: null });
    expect(of('b', 'chat')).toHaveLength(1);
    expect(of('c', 'chat')).toHaveLength(0);
  });

  it('muted people are not heard and cannot pair', () => {
    world.handle('b', { t: 'mute', id: 'a', on: true });
    world.handle('a', { t: 'chat', text: '안녕', session: null });
    world.handle('a', { t: 'invite', to: 'b', kind: 'cake' });
    expect(of('b', 'chat')).toHaveLength(0);
    expect(of('b', 'invite')).toHaveLength(0);
    pair('b', 'a');
    expect(of('a', 'session')).toHaveLength(0);
  });

  it('clamps positions and batches moves', () => {
    at('a', 900, 0);
    world.flush();
    expect(of('b', 'moves')[0].moves).toEqual([['a', PLAZA_RADIUS, 0, 0, false]]);
  });

  it('resolveMove pushes out of every collider', () => {
    for (const c of COLLIDERS) {
      const p = resolveMove(c.x, c.z);
      expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThan(c.r);
    }
  });
});

describe('pairing', () => {
  it('accepting an invite starts a session', () => {
    world.handle('a', { t: 'invite', to: 'b', kind: 'tree' });
    world.handle('b', { t: 'reply', from: 'a', accept: true });
    expect(of('a', 'session').at(-1)!.session).toMatchObject({ kind: 'tree', members: ['a', 'b'] });
    expect(of('b', 'session')).toHaveLength(1);
  });

  it('declining tells the inviter nothing', () => {
    world.handle('a', { t: 'invite', to: 'b', kind: 'tree' });
    const before = inbox.a.length;
    world.handle('b', { t: 'reply', from: 'a', accept: false });
    expect(inbox.a).toHaveLength(before);
  });

  it('expired invites do not start a session', () => {
    world.handle('a', { t: 'invite', to: 'b', kind: 'tree' });
    now += 30_000;
    world.handle('b', { t: 'reply', from: 'a', accept: true });
    expect(of('b', 'session')).toHaveLength(0);
  });

  it('a third person cannot join a running pair', () => {
    pair('a', 'b');
    world.handle('c', { t: 'joinWaiting', host: 'a' });
    expect(of('c', 'session')).toHaveLength(0);
  });

  it('session chat stays private', () => {
    pair('a', 'b');
    at('c', STATIONS.cake.x, STATIONS.cake.z);
    const session = of('a', 'session')[0].session.id;
    world.handle('a', { t: 'chat', text: '비밀', session });
    expect(of('b', 'chat')).toHaveLength(1);
    expect(of('c', 'chat')).toHaveLength(0);
  });
});

describe('privacy and matching', () => {
  it('a private line arriving after the session ended is dropped', () => {
    pair('a', 'b');
    const session = of('a', 'session')[0].session.id;
    world.handle('b', { t: 'leaveSession' });
    world.handle('a', { t: 'leaveSession' });
    world.handle('a', { t: 'chat', text: '비밀', session });
    for (const id of ['a', 'b', 'c']) expect(of(id, 'chat')).toHaveLength(0);
  });

  it('two people waiting for the same activity are paired', () => {
    world.handle('a', { t: 'wait', kind: 'cake' });
    world.handle('b', { t: 'wait', kind: 'cake' });
    expect(of('b', 'session')[0].session.members).toEqual(['a', 'b']);
  });

  it('a blocked person never sees the blocker waiting, before or after the block', () => {
    const seen = () => of('a', 'player').filter((m) => m.player.id === 'b').at(-1)!.player.waiting;
    world.handle('b', { t: 'wait', kind: 'cake' });
    expect(seen()).toBe('cake');
    world.handle('b', { t: 'mute', id: 'a', on: true });
    expect(seen()).toBeNull();
    world.handle('b', { t: 'wait', kind: 'tree' });
    expect(seen()).toBeNull();
    expect(of('c', 'player').at(-1)!.player.waiting).toBe('tree');
  });
});

describe('decorating', () => {
  beforeEach(() => pair('a', 'b'));

  it('syncs decorations to both and only the owner removes', () => {
    place('a');
    const deco = of('b', 'deco')[0].deco;
    world.handle('b', { t: 'remove', id: deco.id });
    expect(of('a', 'undeco')).toHaveLength(0);
    world.handle('a', { t: 'remove', id: deco.id });
    expect(of('b', 'undeco')).toHaveLength(1);
  });

  it('rejects foreign items and sideways standing items', () => {
    place('a', 'bulb');
    place('a', 'candle', [1, 0, 0]);
    expect(of('a', 'deco')).toHaveLength(0);
  });

  it('exhibits only when both are ready; edits reset ready', () => {
    place('a');
    world.handle('a', { t: 'ready', on: true });
    place('b');
    world.handle('b', { t: 'ready', on: true });
    expect(of('c', 'exhibits')).toHaveLength(0);
    world.handle('a', { t: 'ready', on: true });
    expect(of('c', 'exhibits')[0].exhibits[0]).toMatchObject({ kind: 'cake', names: ['a', 'b'] });
    expect(of('a', 'sessionEnd')[0].finished).toBe(true);
  });

  it('the remaining person can finish after a disconnect', () => {
    place('a');
    world.disconnect('b');
    world.handle('a', { t: 'ready', on: true });
    expect(of('c', 'exhibits')).toHaveLength(1);
  });

  it('recycles exhibit slots per kind', () => {
    for (let i = 0; i <= MAX_EXHIBITS; i++) {
      place('a');
      world.handle('a', { t: 'ready', on: true });
      world.handle('b', { t: 'ready', on: true });
      pair('a', 'b');
    }
    const shown = of('c', 'exhibits').at(-1)!.exhibits;
    expect(shown).toHaveLength(MAX_EXHIBITS);
    // 일곱 번째가 첫 자리를 덮어쓰고 가장 오래된 것이 사라진다.
    expect(shown.map((e) => e.slot).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(shown.find((e) => e.slot === 0)!.id).not.toBe(of('c', 'exhibits')[0].exhibits[0].id);
  });

  it('cakes and trees keep separate slots', () => {
    const finish = (kind: 'cake' | 'tree') => {
      pair('a', 'b', kind);
      place('a', kind === 'tree' ? 'star' : 'strawberry');
      world.handle('a', { t: 'ready', on: true });
      world.handle('b', { t: 'ready', on: true });
    };
    world.handle('a', { t: 'leaveSession' });
    world.handle('b', { t: 'leaveSession' });
    for (const kind of ['cake', 'cake', 'tree', 'cake', 'tree'] as const) finish(kind);
    const shown = of('c', 'exhibits').at(-1)!.exhibits;
    expect(shown.filter((e) => e.kind === 'cake').map((e) => e.slot)).toEqual([0, 1, 2]);
    expect(shown.filter((e) => e.kind === 'tree').map((e) => e.slot)).toEqual([0, 1]);
    for (let i = 0; i < MAX_EXHIBITS; i++) finish('tree');
    const full = of('c', 'exhibits').at(-1)!.exhibits;
    expect(full.filter((e) => e.kind === 'tree')).toHaveLength(MAX_EXHIBITS);
    expect(full.filter((e) => e.kind === 'cake')).toHaveLength(3);
  });

  it('places the pair at the station spots', () => {
    world.handle('a', { t: 'leaveSession' });
    world.handle('b', { t: 'leaveSession' });
    pair('a', 'b', 'tree');
    const [first, second] = workSpots('tree');
    const seen = (id: string) => of('c', 'player').filter((m) => m.player.id === id).at(-1)!.player;
    expect(seen('a')).toMatchObject(first);
    expect(seen('b')).toMatchObject(second);
  });

  it('a tree gets exactly one topper', () => {
    world.handle('a', { t: 'leaveSession' });
    world.handle('b', { t: 'leaveSession' });
    pair('a', 'b', 'tree');
    place('a', 'star');
    place('b', 'star');
    expect(of('a', 'deco')).toHaveLength(1);
  });
});
