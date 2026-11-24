import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { BODIES, DEFAULT_LOOKS, HAIR_COLORS, PARTS, SKIN_COLORS, lookSchema, parseLooks, randomLook } from '../shared/look';
import { clientMessage, type ServerMessage } from '../shared/protocol';
import { sameLook, withLook } from '../src/look';
import { baseUrl, partUrls } from '../src/three/avatarParts';

const file = (url: string) => new URL(`../public${url}`, import.meta.url);
function gltf(url: string) {
  const bytes = readFileSync(file(url));
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}

describe('부품 파일', () => {
  it.each(BODIES)('%s의 모든 선택지가 실제 파일을 가리킨다', (body) => {
    const used = new Set(['base.glb']);
    for (const kind of ['hair', 'top', 'bottom', 'shoes'] as const) {
      for (const { id } of PARTS[body][kind]) {
        for (const url of partUrls(lookSchema.parse({ ...DEFAULT_LOOKS[body], [kind]: id }))) {
          expect(existsSync(file(url)), url).toBe(true);
          expect(gltf(url).nodes.some((n: { name: string }) => n.name === 'main'), url).toBe(true);
          used.add(url.split('/').at(-1)!);
        }
      }
    }
    expect(readdirSync(file(`/assets/quaternius-modular/${body}`)).sort()).toEqual([...used].sort());
  });
  it.each(BODIES)('%s 뼈대에 쓰는 동작이 모두 있다', (body) => {
    const names = gltf(baseUrl(DEFAULT_LOOKS[body])).animations.map((a: { name: string }) => a.name);
    expect(names.sort()).toEqual(['Cheer', 'Idle', 'Jump', 'Run', 'Sit', 'Wave']);
  });
  it('피부색이 열 가지 이상이다', () => expect(SKIN_COLORS.length).toBeGreaterThanOrEqual(10));
});

describe('모습 검증', () => {
  const ok = (look: unknown) => lookSchema.safeParse(look).success;
  it('기본값과 무작위 값을 받는다', () => {
    for (const b of BODIES) {
      expect(ok(DEFAULT_LOOKS[b])).toBe(true);
      for (let i = 0; i < 50; i++) expect(ok(randomLook(b))).toBe(true);
    }
  });
  it('무작위로는 민머리가 드물다', () => {
    const bald = Array.from({ length: 2000 }, () => randomLook('male')).filter((l) => l.hair === 'bald').length;
    expect(bald).toBeGreaterThan(20);
    expect(bald).toBeLessThan(200);
  });
  it('다른 몸의 부품, 모르는 값, 범위를 벗어난 색을 거절한다', () => {
    const base = DEFAULT_LOOKS.male;
    expect(ok({ ...base, top: 'tunic' })).toBe(false);
    expect(ok({ ...base, body: 'female' })).toBe(false);
    expect(ok({ ...base, hair: '../x' })).toBe(false);
    expect(ok({ ...base, eyes: 'laser' })).toBe(false);
    expect(ok({ ...base, hairColor: HAIR_COLORS.length })).toBe(false);
    expect(ok({ ...base, skin: -1 })).toBe(false);
    expect(ok({ ...base, skin: 1.5 })).toBe(false);
    expect(ok({ ...base, extra: 1 })).toBe(false);
    expect(ok({ ...base, hat: undefined })).toBe(false);
    expect(ok(null)).toBe(false);
  });
  it('입장 메시지도 모습을 확인하고 크기 제한 안에 든다', () => {
    const join = { t: 'join', name: '가나다라마바사아자차카타', look: DEFAULT_LOOKS.female };
    expect(clientMessage.safeParse(join).success).toBe(true);
    expect(clientMessage.safeParse({ ...join, look: undefined }).success).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(join))).toBeLessThan(600);
  });
  it('저장된 값이 깨졌으면 성한 것만 쓴다', () => {
    expect(parseLooks(null).looks).toEqual(DEFAULT_LOOKS);
    expect(parseLooks('{oops').looks).toEqual(DEFAULT_LOOKS);
    const male = { ...DEFAULT_LOOKS.male, skin: 9 };
    const saved = parseLooks(JSON.stringify({ body: 'male', looks: { male, female: { hair: 'x' } } }));
    expect(saved).toEqual({ body: 'male', looks: { male, female: DEFAULT_LOOKS.female } });
    expect(parseLooks(JSON.stringify({ body: 'x', looks: { male: DEFAULT_LOOKS.female } })).looks.male).toEqual(DEFAULT_LOOKS.male);
  });
});

describe('모습 기억', () => {
  it('같은 몸의 모습만 바꾸고 그 몸을 고른 상태로 둔다', () => {
    const male = { ...DEFAULT_LOOKS.male, skin: 9 };
    expect(withLook({ body: 'female', looks: DEFAULT_LOOKS }, male)).toEqual({ body: 'male', looks: { male, female: DEFAULT_LOOKS.female } });
  });
  it('값이 같으면 다른 객체라도 같은 모습으로 본다', () => {
    expect(sameLook(DEFAULT_LOOKS.male, structuredClone(DEFAULT_LOOKS.male))).toBe(true);
    expect(sameLook(DEFAULT_LOOKS.male, { ...DEFAULT_LOOKS.male, hat: false })).toBe(false);
    expect(sameLook(DEFAULT_LOOKS.male, DEFAULT_LOOKS.female)).toBe(false);
  });
});

describe('광장에서 갈아입기', () => {
  let now = 0;
  let inbox: Record<string, ServerMessage[]>;
  let world: World;
  const look = { ...DEFAULT_LOOKS.female, skin: 8, hat: false };
  const seen = (id: string) => inbox[id].flatMap((m) => (m.t === 'player' ? [m.player] : []));
  beforeEach(() => {
    now = 10_000;
    inbox = {};
    world = new World((id, m) => (inbox[id] ??= []).push(structuredClone(m)), () => now);
    for (const id of ['a', 'b']) world.handle(id, { t: 'join', name: id, look: DEFAULT_LOOKS.male });
    inbox = { a: [], b: [] };
  });

  it('모두에게 새 모습을 알리고 나중에 온 사람도 본다', () => {
    world.handle('a', { t: 'look', look });
    for (const id of ['a', 'b']) expect(seen(id)).toMatchObject([{ id: 'a', look }]);
    world.handle('c', { t: 'join', name: 'c', look });
    const welcome = inbox.c.find((m) => m.t === 'welcome');
    expect(welcome).toMatchObject({ players: [{ id: 'a', look }, { id: 'b' }, { id: 'c' }] });
  });
  it('1초에 한 번만 받는다', () => {
    world.handle('a', { t: 'look', look });
    now += 900;
    world.handle('a', { t: 'look', look: { ...look, skin: 0 } });
    expect(seen('b')).toHaveLength(1);
    expect(inbox.a.some((m) => m.t === 'notice')).toBe(true);
    now += 200;
    world.handle('a', { t: 'look', look: { ...look, skin: 0 } });
    expect(seen('b').at(-1)?.look.skin).toBe(0);
  });
  it('차단한 사람에게 대기 사실을 숨기는 규칙을 지킨다', () => {
    world.handle('a', { t: 'mute', id: 'b', on: true });
    world.handle('a', { t: 'wait', kind: 'cake' });
    world.handle('a', { t: 'look', look });
    expect(seen('b').at(-1)).toMatchObject({ look, waiting: null });
    expect(seen('a').at(-1)).toMatchObject({ look, waiting: 'cake' });
  });
  it('활동 중에는 바꾸지 않는다', () => {
    world.handle('a', { t: 'wait', kind: 'cake' });
    world.handle('b', { t: 'joinWaiting', host: 'a' });
    inbox = { a: [], b: [] };
    world.handle('a', { t: 'look', look });
    expect(seen('b')).toHaveLength(0);
  });
});
