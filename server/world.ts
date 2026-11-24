import { randomUUID } from 'node:crypto';
import { MAX_GALLERY, MAX_POINTS, MAX_STROKES, MAX_STROKE_POINTS, type Stroke } from '../shared/paint';
import { BASES, MAX_DECOS, TREE_TOP, findItem, type Kind } from '../shared/items';
import { nameKey } from '../shared/names';
import { MAX_NOTES } from '../shared/protocol';
import type {
  ClientMessage,
  Deco,
  Exhibit,
  PlayerState,
  ServerMessage,
  SessionState,
  StoredNote,
  Vec3,
} from '../shared/protocol';
import { CHAT_RANGE, MAX_EXHIBITS, STATIONS, clampToPlaza } from '../shared/world';

const INVITE_TTL = 20_000;
const CHAT_GAP = 500;
const NOTE_GAP = 3000;
const GALLERY_GAP = 500;
const EMOTE_GAP = 400;

interface Player extends PlayerState {
  session: Session | null;
  muted: Set<string>;
  notes: StoredNote[];
  lastChat: number;
  lastNote: number;
  lastEmote: number;
  lastGallery: number;
}
interface Session extends SessionState {
  names: string[];
}
type Msg<T extends ClientMessage['t']> = Extract<ClientMessage, { t: T }>;

/** 접속 중인 사람, 2인 활동, 전시를 메모리에 보관한다. 전송 수단은 주입받는다. */
export class World {
  private players = new Map<string, Player>();
  private invites = new Map<string, { kind: Kind; expires: number }>();
  private dirty = new Set<string>();
  private exhibits: Exhibit[] = [];
  private gallery: Exhibit[] = [];
  private nextSlot = 0;

  constructor(
    private send: (id: string, msg: ServerMessage) => void,
    private now: () => number = Date.now,
  ) {}

  handle(id: string, msg: ClientMessage) {
    if (msg.t === 'join') return this.join(id, msg);
    const me = this.players.get(id);
    if (!me) return;
    switch (msg.t) {
      case 'move':
        return this.move(me, msg);
      case 'chat':
        return this.chat(me, msg);
      case 'whisper':
        return this.whisper(me, msg);
      case 'note':
        return this.note(me, msg);
      case 'deleteNote':
        if (!me.notes.some((n) => n.id === msg.id)) return;
        me.notes = me.notes.filter((n) => n.id !== msg.id);
        return this.send(me.id, { t: 'noteDeleted', id: msg.id });
      case 'emote':
        return this.emote(me, msg);
      case 'wait':
        return this.wait(me, msg.kind);
      case 'joinWaiting':
        return this.joinWaiting(me, msg.host);
      case 'invite':
        return this.invite(me, msg);
      case 'reply':
        return this.reply(me, msg);
      case 'mute':
        if (msg.on) me.muted.add(msg.id);
        else me.muted.delete(msg.id);
        if (this.players.has(msg.id)) this.send(msg.id, { t: 'player', player: viewFor(me, msg.id) });
        return;
      case 'place':
        return this.place(me, msg);
      case 'remove':
        return this.remove(me, msg.id);
      case 'stroke':
        return this.stroke(me, msg);
      case 'strokeMore':
        return this.strokeMore(me, msg);
      case 'unstroke':
        return this.unstroke(me, msg.id);
      case 'gallery':
        if (this.now() - me.lastGallery < GALLERY_GAP) return;
        me.lastGallery = this.now();
        return this.send(me.id, { t: 'gallery', cakes: this.gallery });
      case 'base':
        if (!me.session || !BASES[me.session.kind][msg.base]) return;
        me.session.base = msg.base;
        me.session.ready = [];
        return this.syncMeta(me.session);
      case 'cursor':
        for (const m of this.others(me)) this.send(m, { t: 'cursor', p: msg.p });
        return;
      case 'ready':
        return this.ready(me, msg.on);
      case 'leaveSession':
        return this.leaveSession(me);
    }
  }

  disconnect(id: string) {
    const me = this.players.get(id);
    if (!me) return;
    this.leaveSession(me);
    this.players.delete(id);
    this.dirty.delete(id);
    for (const key of this.invites.keys()) if (key.split('>').includes(id)) this.invites.delete(key);
    for (const p of this.players.values()) {
      // 차단이 풀리며 숨겨둔 쪽지가 다시 보이지 않게 함께 지운다.
      if (p.muted.delete(id)) p.notes = p.notes.filter((n) => n.from !== id);
    }
    this.broadcast({ t: 'gone', id });
  }

  /** 일정 주기로 호출해 이동한 사람의 위치만 묶어 보낸다. */
  flush() {
    if (!this.dirty.size) return;
    const moves = [...this.dirty].flatMap((id) => {
      const p = this.players.get(id);
      return p ? [[p.id, p.x, p.z, p.ry, p.moving] as [string, number, number, number, boolean]] : [];
    });
    this.dirty.clear();
    this.broadcast({ t: 'moves', moves });
  }

  private join(id: string, msg: Msg<'join'>) {
    if (this.players.has(id)) return;
    const key = nameKey(msg.name);
    if (!key) return this.send(id, { t: 'joinRejected', reason: 'invalid' });
    if ([...this.players.values()].some((p) => nameKey(p.name) === key)) {
      return this.send(id, { t: 'joinRejected', reason: 'taken' });
    }
    const a = Math.random() * Math.PI;
    const player: Player = {
      id,
      name: msg.name,
      character: msg.character,
      color: msg.color,
      x: Math.cos(a) * 3,
      z: 6 + Math.sin(a) * 3,
      ry: Math.PI,
      moving: false,
      activity: null,
      waiting: null,
      session: null,
      muted: new Set(),
      notes: [],
      lastChat: 0,
      lastNote: 0,
      lastEmote: 0,
      lastGallery: 0,
    };
    this.players.set(id, player);
    this.send(id, {
      t: 'welcome',
      id,
      players: [...this.players.values()].map((p) => viewFor(p, id)),
      exhibits: this.exhibits,
    });
    this.publish(player);
  }

  private move(me: Player, msg: Msg<'move'>) {
    if (me.session) return;
    Object.assign(me, clampToPlaza(msg.x, msg.z), { ry: msg.ry, moving: msg.moving });
    this.dirty.add(me.id);
  }

  private chat(me: Player, { text, session }: Msg<'chat'>) {
    // 활동이 끝난 순간 도착한 둘만의 말이 광장에 퍼지지 않게 한다.
    if (session !== (me.session?.id ?? null)) return;
    const now = this.now();
    if (now - me.lastChat < CHAT_GAP) return this.notice(me.id, '조금만 천천히 이야기해 주세요.');
    me.lastChat = now;
    for (const id of this.audience(me)) this.send(id, { t: 'chat', from: me.id, text });
  }

  private whisper(me: Player, msg: Msg<'whisper'>) {
    const to = this.recipient(me, msg.to);
    const now = this.now();
    const result = !to ? 'gone' : now - me.lastChat < CHAT_GAP ? 'slow' : 'ok';
    // 차단 여부가 드러나지 않게 전달 여부와 상관없이 같은 답을 보낸다.
    this.send(me.id, { t: 'sent', ref: msg.ref, result });
    if (!to || result !== 'ok') return;
    me.lastChat = now;
    if (!to.muted.has(me.id)) this.send(to.id, { t: 'whisper', from: me.id, text: msg.text });
  }

  private note(me: Player, msg: Msg<'note'>) {
    const to = this.recipient(me, msg.to);
    const now = this.now();
    const result = !to ? 'gone' : now - me.lastNote < NOTE_GAP ? 'slow' : 'ok';
    // 가득 참을 알리면 차단된 사람만 성공을 보게 되므로, 가득 차도 같은 답을 보낸다.
    this.send(me.id, { t: 'sent', ref: msg.ref, result });
    if (!to || result !== 'ok') return;
    me.lastNote = now;
    // 차단해서 숨긴 쪽지는 본인이 지울 수 없으니 자리를 차지하지 않는다.
    const full = to.notes.filter((n) => !to.muted.has(n.from)).length >= MAX_NOTES;
    if (to.muted.has(me.id) || full) return;
    const note: StoredNote = { id: randomUUID(), from: me.id, name: me.name, text: msg.text, at: now };
    to.notes.push(note);
    this.send(to.id, { t: 'note', note });
  }

  /** 닉네임은 다시 쓰일 수 있어 접속마다 새로 만든 id로만 찾는다. */
  private recipient(me: Player, id: string) {
    return id === me.id ? undefined : this.players.get(id);
  }

  private emote(me: Player, msg: Msg<'emote'>) {
    const now = this.now();
    if (now - me.lastEmote < EMOTE_GAP) return;
    me.lastEmote = now;
    for (const id of this.audience(me)) this.send(id, { t: 'emote', from: me.id, emote: msg.emote });
  }

  /** 활동 중이면 파트너에게만, 광장이면 가까운 사람에게만 들린다. */
  private audience(me: Player) {
    return [...this.players.values()]
      .filter((p) =>
        me.session
          ? p.session === me.session
          : !p.session && Math.hypot(p.x - me.x, p.z - me.z) <= CHAT_RANGE,
      )
      .filter((p) => !p.muted.has(me.id))
      .map((p) => p.id);
  }

  private wait(me: Player, kind: Kind | null) {
    if (me.session) return;
    const host = kind && [...this.players.values()].find((p) => p !== me && p.waiting === kind && this.canPair(me, p));
    if (host) return this.startSession(kind, host, me);
    me.waiting = kind;
    this.publish(me);
  }

  private joinWaiting(me: Player, hostId: string) {
    const host = this.players.get(hostId);
    if (me.session || !host || host.id === me.id) return;
    if (!host.waiting || !this.canPair(me, host)) {
      return this.notice(me.id, '지금은 함께할 수 없어요.');
    }
    this.startSession(host.waiting, host, me);
  }

  private invite(me: Player, msg: Msg<'invite'>) {
    const to = this.players.get(msg.to);
    if (me.session || !to || to.id === me.id) return;
    const key = `${me.id}>${to.id}`;
    const prev = this.invites.get(key);
    if (prev && prev.expires > this.now()) return;
    // 거절이나 차단 여부는 보낸 사람에게 알리지 않는다.
    this.notice(me.id, `${to.name}님에게 물어봤어요.`);
    this.invites.set(key, { kind: msg.kind, expires: this.now() + INVITE_TTL });
    if (this.canPair(me, to)) this.send(to.id, { t: 'invite', from: me.id, kind: msg.kind });
  }

  private reply(me: Player, msg: Msg<'reply'>) {
    const key = `${msg.from}>${me.id}`;
    const invite = this.invites.get(key);
    const from = this.players.get(msg.from);
    if (!invite || !msg.accept) return;
    this.invites.delete(key);
    if (invite.expires < this.now() || !from || !this.canPair(me, from)) {
      return this.notice(me.id, '초대가 지나갔어요. 광장에서 다시 만나봐요!');
    }
    this.startSession(invite.kind, from, me);
  }

  private canPair(a: Player, b: Player) {
    return !a.session && !b.session && !a.muted.has(b.id) && !b.muted.has(a.id);
  }

  private startSession(kind: Kind, a: Player, b: Player) {
    const session: Session = {
      id: randomUUID(),
      kind,
      base: 0,
      decos: [],
      strokes: [],
      members: [a.id, b.id],
      ready: [],
      names: [a.name, b.name],
    };
    const { x, z } = STATIONS[kind];
    [a, b].forEach((p, i) => {
      Object.assign(p, { x: x + (i ? 2.3 : -2.3), z, ry: i ? -Math.PI / 2 : Math.PI / 2 });
      Object.assign(p, { session, activity: kind, waiting: null, moving: false });
      this.publish(p);
    });
    const { names: _names, ...state } = session;
    for (const id of session.members) this.send(id, { t: 'session', session: state });
  }

  private place(me: Player, msg: Msg<'place'>) {
    const s = me.session;
    const def = s && findItem(s.kind, msg.item);
    if (!s || !def) return;
    if (s.decos.length >= MAX_DECOS) return this.notice(me.id, `장식은 ${MAX_DECOS}개까지 올릴 수 있어요.`);
    let p: Vec3 = msg.p;
    if (def.mount === 'topper') {
      if (s.decos.some((d) => d.item === msg.item)) return this.notice(me.id, '꼭대기에는 이미 별이 있어요.');
      p = [0, TREE_TOP, 0];
    }
    const [x, y, z] = p;
    const len = Math.hypot(...msg.n);
    if (Math.hypot(x, z) > 1.8 || y < -0.1 || y > 4 || len < 0.5 || len > 1.5) return;
    if (def.mount === 'stand' && msg.n[1] < 0.5) return;
    const n = msg.n.map((v) => v / len) as Vec3;
    const deco: Deco = { id: randomUUID(), item: msg.item, color: msg.color, by: me.id, p, n };
    s.decos.push(deco);
    for (const id of s.members) this.send(id, { t: 'deco', deco });
    this.clearReady(s);
  }

  private remove(me: Player, decoId: string) {
    const s = me.session;
    const deco = s?.decos.find((d) => d.id === decoId);
    if (!s || !deco) return;
    if (deco.by !== me.id) return this.notice(me.id, '내가 올린 장식만 뗄 수 있어요.');
    s.decos = s.decos.filter((d) => d !== deco);
    for (const id of s.members) this.send(id, { t: 'undeco', id: decoId });
    this.clearReady(s);
  }

  private stroke(me: Player, msg: Msg<'stroke'>) {
    const s = me.session;
    if (!s || s.kind !== 'cake' || s.strokes.some((k) => k.id === msg.id)) return;
    const isText = msg.tool === 'text';
    const valid = onCake(msg.pts) && isText === (msg.text !== undefined) && (!isText || msg.pts.length === 2);
    if (!valid || s.strokes.length >= MAX_STROKES || countPoints(s) + msg.pts.length / 2 > MAX_POINTS) {
      if (valid) this.notice(me.id, '케이크가 가득 찼어요. 조금 지우고 그려주세요.');
      return this.send(me.id, { t: 'unstroke', id: msg.id });
    }
    const { t: _t, ...rest } = msg;
    const stroke: Stroke = { ...rest, by: me.id };
    s.strokes.push(stroke);
    // 그린 사람에게도 돌려보내 두 화면의 겹침 순서를 서버 순서로 맞춘다.
    for (const id of s.members) this.send(id, { t: 'stroke', stroke });
    this.clearReady(s);
  }

  private strokeMore(me: Player, msg: Msg<'strokeMore'>) {
    const s = me.session;
    const stroke = s?.strokes.find((k) => k.id === msg.id);
    if (!s || !stroke || stroke.by !== me.id || stroke.tool === 'text' || !onCake(msg.pts)) return;
    if (stroke.pts.length + msg.pts.length > MAX_STROKE_POINTS * 2 || countPoints(s) + msg.pts.length / 2 > MAX_POINTS) {
      this.notice(me.id, '케이크가 가득 찼어요. 조금 지우고 그려주세요.');
      return this.unstroke(me, msg.id);
    }
    stroke.pts.push(...msg.pts);
    for (const id of this.others(me)) this.send(id, { t: 'strokeMore', id: msg.id, pts: msg.pts });
    this.clearReady(s);
  }

  private unstroke(me: Player, strokeId: string) {
    const s = me.session;
    const stroke = s?.strokes.find((k) => k.id === strokeId);
    if (!s || !stroke || stroke.by !== me.id) return;
    s.strokes = s.strokes.filter((k) => k !== stroke);
    for (const id of s.members) this.send(id, { t: 'unstroke', id: strokeId });
    this.clearReady(s);
  }

  private ready(me: Player, on: boolean) {
    const s = me.session;
    if (!s) return;
    if (on && !s.decos.length && !s.strokes.length) return this.notice(me.id, '먼저 조금만 꾸며주세요.');
    s.ready = s.ready.filter((id) => id !== me.id);
    if (on) s.ready.push(me.id);
    if (s.ready.length < s.members.length) return this.syncMeta(s);
    this.finish(s);
  }

  private finish(s: Session) {
    const slot = this.nextSlot;
    this.nextSlot = (slot + 1) % MAX_EXHIBITS;
    const { id, kind, base, decos, strokes, names } = s;
    const work: Exhibit = { id, slot, kind, base, decos, strokes, names };
    this.exhibits = [...this.exhibits.filter((e) => e.slot !== slot), work];
    if (kind === 'cake') this.gallery = [work, ...this.gallery].slice(0, MAX_GALLERY);
    for (const memberId of s.members) this.exit(this.players.get(memberId)!, true);
    this.broadcast({ t: 'exhibits', exhibits: this.exhibits });
  }

  private leaveSession(me: Player) {
    const s = me.session;
    if (!s) return;
    s.members = s.members.filter((id) => id !== me.id);
    s.ready = [];
    this.exit(me, false);
    for (const id of s.members) {
      this.notice(id, `${me.name}님이 광장으로 돌아갔어요. 혼자 마무리해도 전시할 수 있어요.`);
    }
    this.syncMeta(s);
  }

  private exit(p: Player, finished: boolean) {
    p.session = null;
    p.activity = null;
    this.send(p.id, { t: 'sessionEnd', finished });
    this.publish(p);
  }

  private clearReady(s: Session) {
    if (!s.ready.length) return;
    s.ready = [];
    this.syncMeta(s);
  }

  private others(me: Player) {
    return me.session?.members.filter((id) => id !== me.id) ?? [];
  }

  /** 그리는 중인 획을 덮어쓰지 않도록 시작 이후에는 작품을 뺀 상태만 보낸다. */
  private syncMeta({ base, members, ready }: Session) {
    for (const id of members) this.send(id, { t: 'sessionMeta', base, members, ready });
  }

  private publish(p: Player) {
    for (const id of this.players.keys()) this.send(id, { t: 'player', player: viewFor(p, id) });
  }

  private notice(id: string, text: string) {
    this.send(id, { t: 'notice', text });
  }

  private broadcast(msg: ServerMessage) {
    for (const id of this.players.keys()) this.send(id, msg);
  }
}

const countPoints = (s: Session) => s.strokes.reduce((n, k) => n + k.pts.length / 2, 0);

function onCake(pts: number[]) {
  if (pts.length % 2) return false;
  for (let i = 0; i < pts.length; i += 2) if (Math.hypot(pts[i], pts[i + 1]) > 1.01) return false;
  return true;
}

/** 차단한 상대에게는 대기 중인 사실을 숨겨, 함께하기가 거절되며 차단이 드러나는 일을 막는다. */
function viewFor(p: Player, viewer: string): PlayerState {
  const { id, name, character, color, x, z, ry, moving, activity } = p;
  return { id, name, character, color, x, z, ry, moving, activity, waiting: p.muted.has(viewer) ? null : p.waiting };
}
