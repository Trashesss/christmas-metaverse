import type { ServerMessage } from '../shared/protocol';
import { addWhisper, toast, useStore, without, type Peer } from './store';

const { getState: get, setState: set } = useStore;

interface Pending {
  kind: 'whisper' | 'note';
  to: Peer;
  text: string;
}
const pending = new Map<number, Pending>();
let seq = 0;

export const clearPending = () => pending.clear();

/** 서버 응답이 올 때까지 쓴 글을 기억해 두고, 거절되면 되돌린다. */
export function track(p: Pending) {
  pending.set(++seq, p);
  return seq;
}

export function settle({ ref, result }: Extract<ServerMessage, { t: 'sent' }>) {
  const p = pending.get(ref);
  if (!p) return;
  pending.delete(ref);
  const { kind, to, text } = p;
  const error = result === 'ok' ? '' : result === 'slow' ? '조금만 천천히 보내주세요. 쓴 글은 그대로 있어요.' : `${to.name}님이 마을을 떠나 보내지 못했어요.`;
  const viewing = get().noteTo?.id === to.id;
  if (kind === 'whisper') {
    if (!error) return addWhisper(to, text, true);
    set((s) => {
      const typed = s.whisperDrafts[to.id];
      return { whisperDrafts: { ...s.whisperDrafts, [to.id]: typed ? `${text} ${typed}` : text } };
    });
    return toast(error);
  }
  set((s) => ({
    noteSending: false,
    ...(s.noteTo?.id === to.id && { noteError: error }),
    ...(!error && {
      noteDrafts: without(s.noteDrafts, to.id),
      noteTo: s.noteTo?.id === to.id ? null : s.noteTo,
    }),
  }));
  if (error && !viewing) toast(error);
  if (!error) toast(`${to.name}님에게 쪽지를 보냈어요.`);
}

export function startWhisper(to: Peer) {
  // 같은 사람을 다시 골라도 입력창에 초점이 가도록 새 객체를 넣는다.
  set({ whisper: { id: to.id, name: to.name }, panel: null });
}

export function startNote(to: Peer) {
  set({ noteTo: { id: to.id, name: to.name }, noteError: '', panel: get().panel ?? 'inbox' });
}

/** 보낼 수 없는 이유. 보낼 수 있으면 null. */
export function useBlockedReason(to: Peer | null) {
  return useStore((s) => {
    if (!to) return null;
    if (!s.players[to.id]) return `${to.name}님이 마을을 떠나 보낼 수 없어요.`;
    return s.muted[to.id] ? `${to.name}님을 차단해서 보낼 수 없어요.` : null;
  });
}
