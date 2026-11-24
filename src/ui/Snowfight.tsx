import { useEffect } from 'react';
import { isTyping } from '../input';
import { throwAhead } from '../snow';
import { useStore } from '../store';

export function Snowfight() {
  const me = useStore((s) => s.me);
  const players = useStore((s) => s.players);
  const scores = useStore((s) => s.scores);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping() || e.target !== document.body) return;
      e.preventDefault();
      throwAhead();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const rows = Object.entries(scores)
    .filter(([id]) => players[id])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <>
      <div className="scores" role="status" aria-label="눈싸움 점수">
        <b>☃️ 눈싸움</b>
        {rows.map(([id, n]) => (
          <span key={id} className={id === me ? 'mine' : ''}>
            {players[id].name} <i>{n}</i>
          </span>
        ))}
        <small>화면을 누르거나 스페이스바로 던져요</small>
      </div>
      {/* 버튼에 초점이 남으면 스페이스바가 두 번 눌리므로 초점을 받지 않게 한다. */}
      <button className="throw" aria-label="눈 던지기" onPointerDown={(e) => { e.preventDefault(); throwAhead(); }} onClick={(e) => e.detail === 0 && throwAhead()}>
        ❄️
      </button>
    </>
  );
}
