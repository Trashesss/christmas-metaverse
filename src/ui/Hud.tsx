import { useEffect, useRef, useState } from 'react';
import { KIND_EMOJI, KIND_LABEL, type Kind } from '../../shared/items';
import { stick } from '../input';
import { send } from '../net';
import { dropInvite, useStore } from '../store';
import { Chat } from './Chat';
import { Gallery } from './Gallery';
import { LookDialog } from './LookEditor';
import { NotesPanel } from './Notes';
import { People } from './People';
import { Snowfight } from './Snowfight';
import { StudioPanel } from './StudioPanel';

export function Hud() {
  const session = useStore((s) => s.session?.id ?? null);
  const gallery = useStore((s) => s.gallery);
  const editing = useStore((s) => s.editing);
  const panel = useStore((s) => s.panel);
  const inSession = !!session;
  return (
    <div className={inSession ? 'hud studio' : 'hud'}>
      {inSession ? <StudioPanel /> : <PlazaHud editing={editing} />}
      {gallery && <Gallery cakes={gallery} />}
      {editing && <LookDialog />}
      {!gallery && !editing && panel && <NotesPanel />}
      {!gallery && !editing && <Chat key={session ?? 'plaza'} session={session} placeholder={inSession ? '둘만 볼 수 있는 이야기' : '가까운 사람에게 이야기하기'} />}
    </div>
  );
}

function PlazaHud({ editing }: { editing: boolean }) {
  const playing = useStore((s) => s.scores[s.me] !== undefined);
  const near = useStore((s) => s.near);
  const invites = useStore((s) => s.invites);
  const players = useStore((s) => s.players);
  const myWait = useStore((s) => s.players[s.me]?.waiting);
  return (
    <>
      <div className="plaza" inert={editing}>
        <People />
        <button className="dress" aria-haspopup="dialog" onClick={() => useStore.setState({ editing: true })}>👕 꾸미기</button>
        {myWait ? (
          <div className="card station">
            <p>{KIND_EMOJI[myWait]} 같이 할 사람을 찾고 있어요. 둘러보셔도 괜찮아요.</p>
            <button onClick={() => send({ t: 'wait', kind: null })}>그만 찾기</button>
          </div>
        ) : (
          near && (near === 'gallery' ? <GalleryCard /> : <StationCard kind={near} />)
        )}
        {playing && <Snowfight />}
        <Joystick />
      </div>
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
