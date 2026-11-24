import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { foldName, nameKey, parseWhisper } from '../shared/names';
import { clientMessage, MAX_CHAT, MAX_NOTE, MAX_NOTES, type ServerMessage } from '../shared/protocol';

let now = 0;
let inbox: Record<string, ServerMessage[]>;
let world: World;

function of<T extends ServerMessage['t']>(id: string, t: T) {
  return (inbox[id] ?? []).filter((m) => m.t === t) as Extract<ServerMessage, { t: T }>[];
}
const join = (id: string, name = id) => world.handle(id, { t: 'join', name, character: 'Mage', color: 0 });
const whisper = (from: string, to: string, text = '비밀', ref = 1) => world.handle(from, { t: 'whisper', ref, to, text });
const note = (from: string, to: string, text = '쪽지', ref = 1) => world.handle(from, { t: 'note', ref, to, text });
const mute = (by: string, id: string, on = true) => world.handle(by, { t: 'mute', id, on });
const pair = (a: string, b: string) => {
  world.handle(a, { t: 'wait', kind: 'cake' });
  world.handle(b, { t: 'joinWaiting', host: a });
};
const results = (id: string) => of(id, 'sent').map((m) => m.result);

beforeEach(() => {
  now = 10_000;
  inbox = {};
  world = new World((id, m) => (inbox[id] ??= []).push(structuredClone(m)), () => now);
  ['a', 'b', 'c'].forEach((id) => join(id));
});

describe('nicknames', () => {
  it.each([
    ['Snow', 'ｓＮＯＷ'],
    ['눈 사람', '눈사람'],
    ['눈사람', '눈​사⁠람'],
    ['눈사람', '눈　사람'],
    ['각', '각'],
    ['각', 'ᄀ​ᅡᆨ'],
    ['straße', 'STRASSE'],
    ['a', '‮aㅤ️⠀'],
  ])('%j and %j are the same', (x, y) => expect(nameKey(x)).toBe(nameKey(y)));

  it('keeps different names apart and foldName keeps inner spaces', () => {
    expect(nameKey('눈사람1')).not.toBe(nameKey('눈사람2'));
    expect(foldName('  눈   사람 ')).toBe('눈 사람');
  });

  it('a duplicate is rejected privately and can retry on the same connection', () => {
    join('d', ' A​');
    expect(inbox.d).toEqual([{ t: 'joinRejected', reason: 'taken' }]);
    expect(of('a', 'player').some((m) => m.player.id === 'd')).toBe(false);
    whisper('d', 'a');
    expect(of('a', 'whisper')).toHaveLength(0);
    join('d', 'd');
    expect(of('d', 'welcome')).toHaveLength(1);
  });

  it.each(['​', 'ㅤ', '⠀⁠'])('rejects the invisible name %j', (name) => {
    join('d', name);
    expect(inbox.d).toEqual([{ t: 'joinRejected', reason: 'invalid' }]);
  });

  it('a name is free again after its owner leaves, not when a rejected socket leaves', () => {
    join('d', 'a');
    world.disconnect('d');
    join('e', 'a');
    expect(of('e', 'joinRejected')).toHaveLength(1);
    world.disconnect('a');
    join('e', 'a');
    expect(of('e', 'welcome')).toHaveLength(1);
  });
});

describe('whisper', () => {
  it('reaches only the target at any distance', () => {
    world.handle('a', { t: 'move', x: 0, z: 18, ry: 0, moving: false });
    world.handle('b', { t: 'move', x: 0, z: -18, ry: 0, moving: false });
    whisper('a', 'b');
    expect(of('b', 'whisper')).toEqual([{ t: 'whisper', from: 'a', text: '비밀' }]);
    expect(results('a')).toEqual(['ok']);
    for (const id of ['a', 'c']) expect(of(id, 'whisper')).toHaveLength(0);
    for (const id of ['a', 'b', 'c']) expect(of(id, 'chat')).toHaveLength(0);
  });

  it('crosses activities in both directions without the partner hearing', () => {
    pair('a', 'b');
    whisper('a', 'c');
    whisper('c', 'a', '답장');
    expect(of('c', 'whisper')).toHaveLength(1);
    expect(of('a', 'whisper')).toHaveLength(1);
    expect(of('b', 'whisper')).toHaveLength(0);
    for (const id of ['a', 'b', 'c']) expect(of(id, 'chat')).toHaveLength(0);
  });

  it('shares the chat rate limit', () => {
    world.handle('a', { t: 'chat', text: '안녕', session: null });
    whisper('a', 'b', '하나', 1);
    now += 500;
    whisper('a', 'b', '둘', 2);
    whisper('a', 'c', '셋', 3);
    expect(of('a', 'sent')).toEqual([
      { t: 'sent', ref: 1, result: 'slow' },
      { t: 'sent', ref: 2, result: 'ok' },
      { t: 'sent', ref: 3, result: 'slow' },
    ]);
    expect(of('b', 'whisper').map((m) => m.text)).toEqual(['둘']);
    expect(of('c', 'whisper')).toHaveLength(0);
  });

  it('does not reach oneself or someone who left', () => {
    whisper('a', 'a');
    world.disconnect('b');
    whisper('a', 'b');
    expect(results('a')).toEqual(['gone', 'gone']);
  });
});

describe('notes', () => {
  const fill = () => {
    for (let i = 0; i < MAX_NOTES; i++) {
      now += 3000;
      note('a', 'b', `${i}`);
    }
  };

  it('is stored for the recipient only, with the sender name', () => {
    pair('a', 'b');
    note('a', 'c');
    expect(of('c', 'note')[0].note).toMatchObject({ from: 'a', name: 'a', text: '쪽지', at: now });
    for (const id of ['a', 'b']) expect(of(id, 'note')).toHaveLength(0);
    expect(JSON.stringify([inbox.a, inbox.b])).not.toContain('쪽지');
  });

  it('allows one every three seconds regardless of recipient and separately from chat', () => {
    whisper('a', 'b');
    note('a', 'b');
    note('a', 'c');
    now += 2999;
    note('a', 'c');
    now += 1;
    note('a', 'c');
    expect(results('a')).toEqual(['ok', 'ok', 'slow', 'slow', 'ok']);
    expect(of('c', 'note')).toHaveLength(1);
  });

  it('a full inbox drops new notes silently until its owner deletes one', () => {
    fill();
    now += 3000;
    note('a', 'b', 'over');
    expect(of('b', 'note')).toHaveLength(MAX_NOTES);
    expect(results('a').at(-1)).toBe('ok');
    const { id } = of('b', 'note')[0].note;
    for (const other of ['a', 'c']) world.handle(other, { t: 'deleteNote', id });
    now += 3000;
    note('a', 'b', 'still over');
    expect(of('b', 'note')).toHaveLength(MAX_NOTES);
    world.handle('b', { t: 'deleteNote', id });
    expect(of('b', 'noteDeleted')).toEqual([{ t: 'noteDeleted', id }]);
    now += 3000;
    note('a', 'b', 'fits');
    expect(of('b', 'note').at(-1)!.note.text).toBe('fits');
  });

  it('notes hidden by a block do not fill the inbox and are gone for good when their sender leaves', () => {
    fill();
    mute('b', 'a');
    note('c', 'b');
    expect(of('b', 'note')).toHaveLength(MAX_NOTES + 1);
    const { id } = of('b', 'note')[0].note;
    world.disconnect('a');
    world.handle('b', { t: 'deleteNote', id });
    expect(of('b', 'noteDeleted')).toHaveLength(0);
  });

  it('a new person with a freed name never receives anything meant for the old one', () => {
    note('a', 'b', '먼저');
    world.disconnect('b');
    join('d', 'b');
    now += 5000;
    note('a', 'b', '나중');
    whisper('a', 'b');
    expect(results('a')).toEqual(['ok', 'gone', 'gone']);
    expect(of('d', 'note')).toHaveLength(0);
    expect(of('d', 'whisper')).toHaveLength(0);
    expect(of('d', 'welcome')[0].players.every((p) => !('notes' in p))).toBe(true);
  });

  it('keeps the sender name after the sender leaves and someone reuses it', () => {
    note('a', 'b');
    world.disconnect('a');
    join('d', 'a');
    expect(of('b', 'note')[0].note).toMatchObject({ from: 'a', name: 'a' });
    note('b', of('b', 'note')[0].note.from);
    expect(results('b')).toEqual(['gone']);
    expect(of('d', 'note')).toHaveLength(0);
  });
});

describe('blocking', () => {
  /** 보낸 사람이 받는 메시지 전체가 차단 여부와 상관없이 같아야 한다. */
  function senderView(blocked: boolean, full: boolean) {
    inbox = {};
    now = 10_000;
    world = new World((id, m) => (inbox[id] ??= []).push(structuredClone(m)), () => now);
    ['a', 'b', 'c'].forEach((id) => join(id));
    if (full) for (let i = 0; i < MAX_NOTES; i++) {
      now += 3000;
      note('c', 'b');
    }
    if (blocked) mute('b', 'a');
    inbox.a = [];
    const before = of('b', 'note').length;
    for (let i = 0; i < 60; i++) {
      whisper('a', 'b', '귓', i * 3);
      whisper('a', 'b', '귓', i * 3 + 1);
      note('a', 'b', '쪽', i * 3 + 2);
      now += i % 3 ? 3000 : 400;
    }
    return { seen: inbox.a, whispers: of('b', 'whisper').length, notes: of('b', 'note').length - before };
  }

  it.each([false, true])('looks identical to the sender (full inbox: %s)', (full) => {
    const open = senderView(false, full);
    const blocked = senderView(true, full);
    expect(blocked.seen).toEqual(open.seen);
    expect(blocked.whispers + blocked.notes).toBe(0);
    expect(open.whispers).toBeGreaterThan(0);
    expect(open.notes > 0).toBe(!full);
  });

  it('delivers again after unblocking', () => {
    mute('b', 'a');
    whisper('a', 'b');
    mute('b', 'a', false);
    now += 500;
    whisper('a', 'b');
    expect(of('b', 'whisper')).toHaveLength(1);
  });
});

describe('messages', () => {
  it('validates length and fits the 4096 byte payload in the worst case', () => {
    const to = 'x'.repeat(36);
    const ok = (msg: unknown) => clientMessage.safeParse(msg).success;
    for (const [t, max] of [['whisper', MAX_CHAT], ['note', MAX_NOTE]] as const) {
      const big = { t, ref: Number.MAX_SAFE_INTEGER, to, text: '\u0001'.repeat(max) };
      expect(ok(big)).toBe(true);
      expect(Buffer.byteLength(JSON.stringify(big))).toBeLessThan(4096);
      expect(ok({ ...big, text: '가'.repeat(max + 1) })).toBe(false);
      expect(ok({ ...big, text: '  ' })).toBe(false);
      expect(ok({ ...big, to: undefined })).toBe(false);
      expect(ok({ ...big, ref: 1.5 })).toBe(false);
    }
  });
});

describe('/w', () => {
  const people = [
    { id: '1', name: '눈' },
    { id: '2', name: '눈 사람' },
    { id: '3', name: 'Snow' },
    { id: '4', name: '겨울밤' },
  ];
  const parse = (text: string) => parseWhisper(text, people);

  it('finds the only matching name, ignoring case and extra spaces', () => {
    expect(parse('/w 눈 안녕')).toMatchObject({ to: { id: '1' }, body: '안녕' });
    expect(parseWhisper('/w 눈  사람 안녕 눈', [{ id: '2', name: '눈 사람' }])).toMatchObject({ to: { id: '2' }, body: '안녕 눈' });
    expect(parse(' /W sNOW hi')).toMatchObject({ to: { id: '3' }, body: 'hi' });
    expect(parseWhisper('/ㅈ 눈 사람', [{ id: '2', name: '눈 사람' }])).toMatchObject({ to: { id: '2' }, body: '' });
  });

  it('sends to nobody when one name extends another', () => {
    expect(parse('/w 눈 사람 안녕')).toHaveProperty('error');
  });

  it('does not join words into someone else’s name', () => {
    expect(parse('/w 겨울 밤 안녕')).toHaveProperty('error');
  });

  it.each(['/w', '/w ', '/w 없는사람 안녕', '/ww 눈 안녕', '/ w 눈 안녕', '／w2 눈', '//w 눈', '​/q 눈', '/w눈 안녕'])(
    'a mistyped %j is an error, never public',
    (text) => expect(parse(text)).toHaveProperty('error'),
  );

  it('leaves ordinary chat alone', () => expect(parse('안녕 /w 눈')).toBeNull());
});
