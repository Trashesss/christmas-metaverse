import { send } from '../net';
import { startNote, startWhisper } from '../private';
import { useStore, without } from '../store';

export function People() {
  const count = useStore((s) => Object.keys(s.players).length);
  return (
    <details className="card people">
      <summary>마을 사람들 {count}명</summary>
      <PeopleList />
    </details>
  );
}

export function PeopleList() {
  const me = useStore((s) => s.me);
  const players = useStore((s) => s.players);
  const muted = useStore((s) => s.muted);
  const toggle = (id: string) => {
    const on = !muted[id];
    send({ t: 'mute', id, on });
    useStore.setState((s) => ({
      muted: on ? { ...s.muted, [id]: true as const } : without(s.muted, id),
      invites: s.invites.filter((i) => i.from !== id),
    }));
  };
  return Object.values(players).map((p) => (
    <div key={p.id} className="row person">
      <span>{p.name}{p.id === me && ' (나)'}</span>
      {p.id !== me && (
        <div
          className="acts"
          onClick={(e) => {
            // 고르고 나면 목록을 접어 입력창을 가리지 않게 한다.
            if ((e.target as HTMLElement).dataset.pick) e.currentTarget.closest('details')?.removeAttribute('open');
          }}
        >
          {!muted[p.id] && (
            <>
              <button data-pick="1" aria-label={`${p.name}님에게 귓속말`} onClick={() => startWhisper(p)}>귓속말</button>
              <button data-pick="1" aria-label={`${p.name}님에게 쪽지`} onClick={() => startNote(p)}>쪽지</button>
            </>
          )}
          <button aria-label={`${p.name}님 ${muted[p.id] ? '차단 풀기' : '차단'}`} onClick={() => toggle(p.id)}>{muted[p.id] ? '차단 풀기' : '차단'}</button>
        </div>
      )}
    </div>
  ));
}
