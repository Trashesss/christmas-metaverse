import { create } from 'zustand';
import type { Kind } from '../shared/items';
import type { Stroke, ToolId } from '../shared/paint';
import type { Deco, Emote, Exhibit, PlayerState, SessionState, Vec3 } from '../shared/protocol';

export interface ChatLine {
  key: number;
  name: string;
  text: string;
  mine: boolean;
}
export interface Invite {
  from: string;
  kind: Kind;
}
export type Spot = Kind | 'gallery';
export type StudioTab = 'paint' | 'topping' | 'base';
interface State {
  status: 'lobby' | 'connecting' | 'online';
  me: string;
  players: Record<string, PlayerState>;
  bubbles: Record<string, { key: number; text: string }>;
  emotes: Record<string, { key: number; emote: Emote }>;
  muted: Record<string, true>;
  chat: ChatLine[];
  toasts: { key: number; text: string }[];
  invites: Invite[];
  exhibits: Exhibit[];
  session: SessionState | null;
  partnerCursor: Vec3 | null;
  near: Spot | null;
  /** 열려 있을 때만 케이크 목록이 들어 있다. */
  gallery: Exhibit[] | null;
  tab: StudioTab;
  tool: ToolId | 'erase';
  paintColor: number;
  size: number;
  text: string;
  font: number;
  item: string;
  color: number;
  removing: boolean;
}

const initial: State = {
  status: 'lobby',
  me: '',
  players: {},
  bubbles: {},
  emotes: {},
  muted: {},
  chat: [],
  toasts: [],
  invites: [],
  exhibits: [],
  session: null,
  partnerCursor: null,
  near: null,
  gallery: null,
  tab: 'topping',
  tool: 'pen',
  paintColor: 1,
  size: 1,
  text: '',
  font: 0,
  item: '',
  color: 0,
  removing: false,
};

export const useStore = create<State>(() => initial);
const { getState: get, setState: set } = useStore;

let seq = 0;

export function resetStore() {
  set({ ...initial, toasts: get().toasts });
}

export function toast(text: string) {
  const key = ++seq;
  set((s) => ({ toasts: [...s.toasts, { key, text }].slice(-3) }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== key) })), 4000);
}

export function addChat(from: string, text: string) {
  const { me, players } = get();
  const key = ++seq;
  set((s) => ({
    chat: [...s.chat, { key, name: players[from]?.name ?? '', text, mine: from === me }].slice(-50),
    bubbles: { ...s.bubbles, [from]: { key, text } },
  }));
  setTimeout(() => set((s) => ({ bubbles: dropIf(s.bubbles, from, key) })), 6000);
}

export function addEmote(from: string, emote: Emote) {
  const key = ++seq;
  set((s) => ({ emotes: { ...s.emotes, [from]: { key, emote } } }));
  setTimeout(() => set((s) => ({ emotes: dropIf(s.emotes, from, key) })), emote === 'sit' ? 8000 : 2200);
}

function dropIf<T extends { key: number }>(map: Record<string, T>, id: string, key: number) {
  return map[id]?.key === key ? without(map, id) : map;
}

export function without<T>(map: Record<string, T>, id: string) {
  const { [id]: _removed, ...rest } = map;
  return rest;
}

export function editSession(fn: (decos: Deco[]) => Deco[]) {
  set((s) => (s.session ? { session: { ...s.session, decos: fn(s.session.decos) } } : s));
}

export function editStrokes(fn: (strokes: Stroke[]) => Stroke[]) {
  set((s) => (s.session ? { session: { ...s.session, strokes: fn(s.session.strokes) } } : s));
}

export function addInvite(invite: Invite) {
  set((s) => ({ invites: [...s.invites.filter((i) => i.from !== invite.from), invite] }));
  setTimeout(() => dropInvite(invite), 20_000);
}

export function dropInvite(invite: Invite) {
  set((s) => ({ invites: s.invites.filter((i) => i !== invite) }));
}
