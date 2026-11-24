import { useEffect, useRef, useState } from 'react';
import { KIND_EMOJI, KIND_LABEL, type Kind } from '../../shared/items';
import { EMOTES, type Emote } from '../../shared/protocol';
import { isTyping, stick } from '../input';
import { send } from '../net';
import { dropInvite, toast, useStore, without } from '../store';
import { Gallery } from './Gallery';
import { StudioPanel } from './StudioPanel';

export function Hud() {
  const session = useStore((s) => s.session?.id ?? null);
  const gallery = useStore((s) => s.gallery);
  const inSession = !!session;
  return (
    <div className={inSession ? 'hud studio' : 'hud'}>
      {inSession ? <StudioPanel /> : <PlazaHud />}
      {gallery && <Gallery cakes={gallery} />}
      {!gallery && <Chat key={session ?? 'plaza'} session={session} placeholder={inSession ? '둘만 볼 수 있는 이야기' : '가까운 사람에게 이야기하기'} />}
    </div>
  );
}

function PlazaHud() {
  const near = useStore((s) => s.near);
  const invites = useStore((s) => s.invites);
  const players = useStore((s) => s.players);
  const myWait = useStore((s) => s.players[s.me]?.waiting);
  return (
    <>
      <People />
      <div className="invites">
        {invites.map((i) => (
          <div className="card" key={i.from}>
            <p>
              <b>{players[i.from]?.name}</b>님이 {KIND_EMOJI[i.kind]} {KIND_LABEL[i.kind]}를 같이 꾸미자고 해요.
            </p>
            <div className="row">
              <button onClick={() => { send({ t: 'reply', from: i.from, accept: false }); dropInvite(i); }}>다음에요</button>
              <button className="primary" onClick={() => { send({ t: 'reply', from: i.from, accept: true }); dropInvite(i); }}>좋아요</button>
            </div>
          </div>
        ))}
      </div>
      {myWait ? (
        <div className="card station">
          <p>{KIND_EMOJI[myWait]} 같이 할 사람을 찾고 있어요. 둘러보셔도 괜찮아요.</p>
          <button onClick={() => send({ t: 'wait', kind: null })}>그만 찾기</button>
        </div>
      ) : (
        near && (near === 'gallery' ? <GalleryCard /> : <StationCard kind={near} />)
      )}
      <Joystick />
    </>
  );
}

function GalleryCard() {
  return (
    <div className="card station">
      <h2>🍰 케이크 진열장</h2>
      <button className="primary" onClick={() => send({ t: 'gallery' })}>
        케이크 모아보기
      </button>
    </div>
  );
}

function StationCard({ kind }: { kind: Kind }) {
  const me = useStore((s) => s.me);
  const players = useStore((s) => s.players);
  const muted = useStore((s) => s.muted);
  const others = Object.values(players).filter((p) => p.id !== me && !muted[p.id] && !p.activity);
  const hosts = others.filter((p) => p.waiting === kind);
  const free = others.filter((p) => p.waiting !== kind);
  return (
    <div className="card station">
      <h2>
        {KIND_EMOJI[kind]} {kind === 'cake' ? '레터링 케이크' : '트리'}, 같이 꾸며볼까요?
      </h2>
      {hosts.map((p) => (
        <button key={p.id} className="primary" onClick={() => send({ t: 'joinWaiting', host: p.id })}>
          {p.name}님과 함께하기
        </button>
      ))}
      <button className={hosts.length ? '' : 'primary'} onClick={() => send({ t: 'wait', kind })}>
        함께할 사람 기다리기
      </button>
      {free.length > 0 && (
        <details>
          <summary>누군가에게 물어보기</summary>
          {free.map((p) => (
            <button key={p.id} onClick={() => send({ t: 'invite', to: p.id, kind })}>
              {p.name}
            </button>
          ))}
        </details>
      )}
    </div>
  );
}

function People() {
  const me = useStore((s) => s.me);
  const players = useStore((s) => s.players);
  const muted = useStore((s) => s.muted);
  const list = Object.values(players);
  const toggle = (id: string) => {
    const on = !muted[id];
    send({ t: 'mute', id, on });
    useStore.setState((s) => ({
      muted: on ? { ...s.muted, [id]: true as const } : without(s.muted, id),
      invites: s.invites.filter((i) => i.from !== id),
    }));
  };
  return (
    <details className="card people">
      <summary>마을 사람들 {list.length}명</summary>
      {list.map((p) => (
        <div key={p.id} className="row">
          <span>{p.name}{p.id === me && ' (나)'}</span>
          {p.id !== me && <button onClick={() => toggle(p.id)}>{muted[p.id] ? '차단 풀기' : '차단'}</button>}
        </div>
      ))}
    </details>
  );
}

const EMOTE_BUTTON: Record<Emote, [string, string]> = {
  wave: ['👋', '인사'],
  cheer: ['🎉', '환호'],
  jump: ['✨', '점프'],
  sit: ['☕', '앉기'],
  laugh: ['😂', '웃음'],
  snow: ['❄️', '눈'],
};

const CHAT_GAP = 650;

function Chat({ placeholder, session }: { placeholder: string; session: string | null }) {
  const lastSent = useRef(0);
  const chat = useStore((s) => s.chat);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 최신 Chrome의 scrollTo는 Promise를 돌려주므로 값을 반환하지 않는다.
    log.current?.scrollTo(0, log.current.scrollHeight);
  }, [chat]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' || isTyping() || document.activeElement?.tagName === 'BUTTON') return;
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
          <p key={l.key} className={l.mine ? 'mine' : ''}>
            <b>{l.name}</b> {l.text}
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // 빈 채로 Enter를 누르면 다시 이동할 수 있게 입력창에서 빠져나온다.
          if (!text.trim()) return input.current?.blur();
          // 서버가 거절할 만큼 빠르면 쓴 글을 지우지 않고 남겨둔다.
          if (Date.now() - lastSent.current < CHAT_GAP) return toast('조금만 천천히 이야기해 주세요.');
          lastSent.current = Date.now();
          send({ t: 'chat', session, text: text.trim().slice(0, 120) });
          setText('');
        }}
      >
        <button type="button" aria-label="감정표현" aria-expanded={open} onClick={() => setOpen(!open)}>😊</button>
        <input
          ref={input}
          value={text}
          maxLength={120}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          placeholder={placeholder}
          aria-label="채팅"
          autoComplete="off"
        />
        <button className="primary">보내기</button>
      </form>
    </div>
  );
}

function Joystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const len = Math.max(1, Math.hypot(x, y));
    x /= len;
    y /= len;
    stick.x = x;
    stick.y = -y;
    setKnob({ x, y });
  };
  const release = (e?: React.PointerEvent) => {
    if (e && e.pointerId !== active.current) return;
    active.current = null;
    stick.x = stick.y = 0;
    setKnob({ x: 0, y: 0 });
  };
  useEffect(() => () => release(), []);
  return (
    <div
      className="joystick"
      onPointerDown={(e) => {
        if (active.current !== null) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <i style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
    </div>
  );
}
