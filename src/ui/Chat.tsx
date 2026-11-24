import { useEffect, useRef, useState } from 'react';
import { parseWhisper } from '../../shared/names';
import { EMOTES, MAX_CHAT, type Emote } from '../../shared/protocol';
import { isTyping } from '../input';
import { send } from '../net';
import { startWhisper, track, useBlockedReason } from '../private';
import { toast, useStore, type Peer } from '../store';
import { NotesButton } from './Notes';

const EMOTE_BUTTON: Record<Emote, [string, string]> = {
  wave: ['👋', '인사'],
  cheer: ['🎉', '환호'],
  jump: ['✨', '점프'],
  sit: ['☕', '앉기'],
  laugh: ['😂', '웃음'],
  snow: ['❄️', '눈'],
};

const CHAT_GAP = 650;
// 활동을 오가며 다시 만들어져도 서버와 같은 간격을 지킨다.
let lastSent = 0;

export function Chat({ placeholder, session }: { placeholder: string; session: string | null }) {
  const chat = useStore((s) => s.chat);
  const whisper = useStore((s) => s.whisper);
  const drafts = useStore((s) => s.whisperDrafts);
  const blocked = useBlockedReason(whisper);
  // 귓속말 초안은 사람마다 따로 두어 공개 채팅 입력과 섞이지 않게 한다.
  const [publicText, setPublicText] = useState('');
  const text = whisper ? drafts[whisper.id] ?? '' : publicText;
  const setText = (value: string) => (whisper ? setDraft(whisper, value) : setPublicText(value));
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 최신 Chrome의 scrollTo는 Promise를 돌려주므로 값을 반환하지 않는다.
    log.current?.scrollTo(0, log.current.scrollHeight);
  }, [chat]);
  // 활동을 오가며 다시 만들어질 때는 초점을 빼앗지 않는다.
  const shown = useRef(whisper);
  useEffect(() => {
    if (whisper && whisper !== shown.current) input.current?.focus();
    shown.current = whisper;
  }, [whisper]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' || isTyping() || document.activeElement?.closest('button, summary, .notes')) return;
      e.preventDefault();
      input.current?.focus();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="chat">
      <div className="log" ref={log} aria-live="polite">
        {chat.map((l) => (
          <p key={l.key} className={`${l.mine ? 'mine' : ''} ${l.whisper ? 'whisper' : ''}`}>
            <b>{l.whisper ? `🤫 ${l.name}${l.mine ? '님에게 귓속말' : '님의 귓속말'}` : l.name}</b> {l.text}
            {l.whisper && !l.mine && (
              <button aria-label={`${l.name}님에게 귓속말로 답장`} onClick={() => startWhisper(l.whisper!)}>답장</button>
            )}
          </p>
        ))}
      </div>
      {open && (
        <div className="emotes">
          {EMOTES.map((e) => (
            <button key={e} aria-label={EMOTE_BUTTON[e][1]} title={EMOTE_BUTTON[e][1]} onClick={() => send({ t: 'emote', emote: e })}>
              {EMOTE_BUTTON[e][0]}
            </button>
          ))}
        </div>
      )}
      {whisper && (
        <div className={blocked ? 'whisper-bar blocked' : 'whisper-bar'} role="status">
          <span>{blocked ?? `🤫 ${whisper.name}님에게 귓속말`}</span>
          <button type="button" onClick={() => useStore.setState({ whisper: null })}>그만하기</button>
        </div>
      )}
      <form
        className={whisper ? 'whispering' : ''}
        onSubmit={(e) => {
          e.preventDefault();
          // 빈 채로 Enter를 누르면 다시 이동할 수 있게 입력창에서 빠져나온다.
          if (!text.trim()) return input.current?.blur();
          const { players, me, muted } = useStore.getState();
          const command = parseWhisper(text, Object.values(players).filter((p) => p.id !== me));
          if (command && 'error' in command) return toast(command.error);
          const to = command?.to ?? whisper;
          const body = command ? command.body : text.trim();
          if (to && !players[to.id]) return toast(`${to.name}님이 마을을 떠나 보낼 수 없어요.`);
          if (to && muted[to.id]) return toast(`${to.name}님을 차단해서 보낼 수 없어요.`);
          if (body.length > MAX_CHAT) return toast(`${MAX_CHAT}자까지 보낼 수 있어요.`);
          // 서버가 거절할 만큼 빠르면 쓴 글을 지우지 않고 남겨둔다.
          if (body && Date.now() - lastSent < CHAT_GAP) return toast('조금만 천천히 이야기해 주세요.');
          setText('');
          if (command) startWhisper(command.to);
          if (!body) return;
          lastSent = Date.now();
          if (to) send({ t: 'whisper', ref: track({ kind: 'whisper', to, text: body }), to: to.id, text: body });
          else send({ t: 'chat', session, text: body });
        }}
      >
        <button type="button" aria-label="감정표현" aria-expanded={open} onClick={() => setOpen(!open)}>😊</button>
        <NotesButton />
        <input
          key={whisper?.id ?? 'public'}
          ref={input}
          value={text}
          maxLength={MAX_CHAT}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          placeholder={whisper ? '이 사람만 볼 수 있어요' : placeholder}
          aria-label={whisper ? `${whisper.name}님에게 귓속말` : '채팅'}
          autoComplete="off"
        />
        <button className="primary">보내기</button>
      </form>
    </div>
  );
}

function setDraft(to: Peer, value: string) {
  useStore.setState((s) => ({ whisperDrafts: { ...s.whisperDrafts, [to.id]: value } }));
}
