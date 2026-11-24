import { ITEMS } from '../shared/items';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { clearPending, settle } from './private';
import { addChat, addEmote, addInvite, addWhisper, editSession, editStrokes, resetStore, toast, useStore, without } from './store';

const { getState: get, setState: set } = useStore;

/** 매 프레임 바뀌는 값이라 React 상태 밖에 둔다. */
export const positions = new Map<string, { x: number; z: number; ry: number; moving: boolean }>();

let ws: WebSocket | null = null;

export function connect(profile: Omit<Extract<ClientMessage, { t: 'join' }>, 't'>) {
  set({ status: 'connecting', joinError: null });
  // 닉네임만 거절된 연결은 살아 있으니 다시 쓴다.
  if (ws?.readyState === WebSocket.OPEN) return send({ t: 'join', ...profile });
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws = socket;
  socket.onopen = () => send({ t: 'join', ...profile });
  socket.onmessage = (e) => receive(JSON.parse(e.data));
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
    // 닉네임을 고치는 동안 끊기면 다음 시도에서 새로 잇는다.
    if (get().status === 'lobby') return;
    clearPending();
    positions.clear();
    resetStore();
    toast('마을과 연결이 끊겼어요. 다시 들어와 주세요.');
  };
}

export function send(msg: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function receive(msg: ServerMessage) {
  switch (msg.t) {
    case 'joinRejected':
      return set({ status: 'lobby', joinError: msg.reason });
    case 'welcome':
      for (const p of msg.players) positions.set(p.id, { ...p });
      return set({
        status: 'online',
        me: msg.id,
        exhibits: msg.exhibits,
        players: Object.fromEntries(msg.players.map((p) => [p.id, p])),
      });
    case 'player': {
      const { player } = msg;
      const known = positions.get(player.id);
      // 내 위치는 활동을 시작할 때만 서버 값을 따른다.
      if (!known || player.id !== get().me || player.activity) positions.set(player.id, { ...player });
      return set((s) => ({ players: { ...s.players, [player.id]: player } }));
    }
    case 'gone':
      positions.delete(msg.id);
      return set((s) => ({
        players: without(s.players, msg.id),
        muted: without(s.muted, msg.id),
        bubbles: without(s.bubbles, msg.id),
        emotes: without(s.emotes, msg.id),
        invites: s.invites.filter((i) => i.from !== msg.id),
        // 보고 있던 글은 복사할 수 있게 남긴다.
        ...(s.whisper?.id !== msg.id && { whisperDrafts: without(s.whisperDrafts, msg.id) }),
        ...(s.noteTo?.id !== msg.id && { noteDrafts: without(s.noteDrafts, msg.id) }),
        notes: s.muted[msg.id] ? s.notes.filter((n) => n.from !== msg.id) : s.notes,
      }));
    case 'moves':
      for (const [id, x, z, ry, moving] of msg.moves) {
        if (id !== get().me) positions.set(id, { x, z, ry, moving });
      }
      return;
    case 'chat':
      return addChat(msg.from, msg.text);
    case 'whisper': {
      const { players, muted, panel, gallery } = get();
      const from = players[msg.from];
      if (!from || muted[msg.from]) return;
      if (panel || gallery) toast(`${from.name}님의 귓속말이 왔어요.`);
      return addWhisper(from, msg.text, false);
    }
    case 'note':
      return set((s) => ({ notes: [{ ...msg.note, read: false }, ...s.notes] }));
    case 'noteDeleted':
      return set((s) => ({ notes: s.notes.filter((n) => n.id !== msg.id) }));
    case 'sent':
      return settle(msg);
    case 'emote':
      return addEmote(msg.from, msg.emote);
    case 'invite':
      return addInvite({ from: msg.from, kind: msg.kind });
    case 'session':
      return set((s) => ({
        session: msg.session,
        tab: msg.session.kind === 'cake' ? 'paint' : 'topping',
        item: ITEMS[msg.session.kind][0].id,
        removing: false,
        partnerCursor: null,
        chat: s.chat.filter((l) => l.whisper),
        invites: [],
        near: null,
        gallery: null,
        text: '',
      }));
    case 'sessionMeta': {
      const { t: _t, ...meta } = msg;
      return set((s) => ({
        session: s.session && { ...s.session, ...meta },
        ...(meta.members.length < 2 && { partnerCursor: null }),
      }));
    }
    case 'stroke':
      // 내가 먼저 그려둔 획이면 이미 더 그린 점을 유지한 채 순서만 서버에 맞춘다.
      return editStrokes((list) => {
        const mine = list.find((s) => s.id === msg.stroke.id);
        return [...list.filter((s) => s !== mine), mine ?? msg.stroke];
      });
    case 'strokeMore':
      return editStrokes((list) => list.map((s) => (s.id === msg.id ? { ...s, pts: [...s.pts, ...msg.pts] } : s)));
    case 'unstroke':
      return editStrokes((list) => list.filter((s) => s.id !== msg.id));
    case 'gallery':
      return set((s) => (s.session ? s : { gallery: msg.cakes }));
    case 'deco':
      return editSession((decos) => [...decos, msg.deco]);
    case 'undeco':
      return editSession((decos) => decos.filter((d) => d.id !== msg.id));
    case 'cursor':
      return set({ partnerCursor: msg.p });
    case 'sessionEnd':
      set((s) => ({ session: null, partnerCursor: null, chat: s.chat.filter((l) => l.whisper) }));
      if (msg.finished) toast('완성했어요! 광장 북쪽에 전시되었어요.');
      return;
    case 'exhibits':
      return set({ exhibits: msg.exhibits });
    case 'notice':
      return toast(msg.text);
  }
}
