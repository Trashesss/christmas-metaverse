import { useEffect, useRef, useState } from 'react';
import { MAX_NOTE, MAX_NOTES } from '../../shared/protocol';
import { send } from '../net';
import { startNote, track, useBlockedReason } from '../private';
import { useStore, type Note, type Peer } from '../store';
import { PeopleList } from './People';

const visible = (notes: Note[], muted: Record<string, true>) => notes.filter((n) => !muted[n.from]);

export function NotesButton() {
  const notes = useStore((s) => s.notes);
  const muted = useStore((s) => s.muted);
  const open = useStore((s) => !!s.panel);
  const unread = visible(notes, muted).filter((n) => !n.read).length;
  return (
    <button
      type="button"
      className="notes-button"
      aria-label={unread ? `쪽지와 사람들, 새 쪽지 ${unread}개` : '쪽지와 사람들'}
      aria-expanded={open}
      onClick={() => useStore.setState({ panel: open ? null : 'inbox', noteTo: null })}
    >
      💌{unread > 0 && <b className="badge">{unread}</b>}
    </button>
  );
}

function close() {
  useStore.setState({ panel: null });
  document.querySelector<HTMLElement>('.notes-button')?.focus();
}

export function NotesPanel() {
  const panel = useStore((s) => s.panel);
  const noteTo = useStore((s) => s.noteTo);
  const root = useRef<HTMLElement>(null);
  // 화면을 바꾸거나 보내기를 마치면 사라진 버튼 대신 패널에 초점을 둔다.
  useEffect(() => {
    if (!noteTo && !root.current?.contains(document.activeElement)) root.current?.focus();
  }, [noteTo, panel]);
  return (
    <section
      className="card notes"
      role="dialog"
      aria-label="쪽지와 사람들"
      ref={root}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.nativeEvent.isComposing) close();
      }}
    >
      <header className="row">
        {noteTo ? (
          <>
            <h2>{noteTo.name}님에게 쪽지</h2>
            <button onClick={() => useStore.setState({ noteTo: null })}>뒤로</button>
          </>
        ) : (
          <div className="tabs">
            <button aria-pressed={panel === 'inbox'} onClick={() => useStore.setState({ panel: 'inbox' })}>쪽지함</button>
            <button aria-pressed={panel === 'people'} onClick={() => useStore.setState({ panel: 'people' })}>사람들</button>
          </div>
        )}
        <button onClick={close}>닫기</button>
      </header>
      {noteTo ? <Compose key={noteTo.id} to={noteTo} /> : panel === 'people' ? <PeopleList /> : <Inbox onDelete={() => root.current?.focus()} />}
    </section>
  );
}

function Inbox({ onDelete }: { onDelete: () => void }) {
  const all = useStore((s) => s.notes);
  const muted = useStore((s) => s.muted);
  const players = useStore((s) => s.players);
  const [open, setOpen] = useState('');
  const notes = visible(all, muted);
  const toggle = (id: string) => {
    setOpen(open === id ? '' : id);
    useStore.setState((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  };
  return (
    <>
      {notes.length >= MAX_NOTES && <p className="error">쪽지함이 가득 찼어요. 지워야 새 쪽지를 받을 수 있어요.</p>}
      {!notes.length && <p>받은 쪽지가 없어요. 사람들에서 골라 먼저 남겨보세요.</p>}
      <ul>
        {notes.map((n) => (
          <li key={n.id} className={n.read ? '' : 'unread'}>
            <button className="head" aria-expanded={open === n.id} onClick={() => toggle(n.id)}>
              <span>{!n.read && <i>새 쪽지 </i>}<b>{n.name}</b></span>
              <time>{new Date(n.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time>
              {open !== n.id && <span className="peek">{n.text}</span>}
            </button>
            {open === n.id && (
              <>
                <p className="body">{n.text}</p>
                <div className="row">
                  <button disabled={!players[n.from]} onClick={() => startNote({ id: n.from, name: n.name })}>
                    {players[n.from] ? '답장' : '떠난 사람이에요'}
                  </button>
                  <button
                    onClick={() => {
                      send({ t: 'deleteNote', id: n.id });
                      onDelete();
                    }}
                  >
                    지우기
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Compose({ to }: { to: Peer }) {
  const text = useStore((s) => s.noteDrafts[to.id] ?? '');
  const sending = useStore((s) => s.noteSending);
  const error = useStore((s) => s.noteError);
  const blocked = useBlockedReason(to);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  const problem = blocked ?? error;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const body = text.trim();
        if (!body || blocked || sending) return;
        // 한글 조합 중에는 maxLength를 넘길 수 있고, 넘긴 쪽지에는 서버가 답하지 않는다.
        if (body.length > MAX_NOTE) return useStore.setState({ noteError: `${MAX_NOTE}자까지 보낼 수 있어요.` });
        useStore.setState({ noteSending: true, noteError: '' });
        send({ t: 'note', ref: track({ kind: 'note', to, text: body }), to: to.id, text: body });
      }}
    >
      <textarea
        ref={field}
        value={text}
        rows={4}
        maxLength={MAX_NOTE}
        readOnly={sending}
        aria-label={`${to.name}님에게 쪽지 내용`}
        aria-describedby="note-help"
        placeholder="나중에 읽을 수 있게 남겨요"
        onChange={(e) => useStore.setState((s) => ({ noteDrafts: { ...s.noteDrafts, [to.id]: e.target.value } }))}
      />
      <p id="note-help" className="help">{text.length}/{MAX_NOTE} · 상대가 나가거나 쪽지함이 가득 차면 전해지지 않아요.</p>
      {problem && <p className="error" role="alert">{problem}</p>}
      <button className="primary" disabled={!text.trim() || !!blocked || sending}>{sending ? '보내는 중…' : '쪽지 보내기'}</button>
    </form>
  );
}
