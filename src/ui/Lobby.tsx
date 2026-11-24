import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../../shared/items';
import { loadLooks, saveLooks } from '../look';
import { connect } from '../net';
import { useStore } from '../store';
import { LookControls, LookPreview, useLooks, type LookTab } from './LookEditor';

const JOIN_ERROR = {
  taken: '이미 쓰고 있는 닉네임이에요. 다른 닉네임을 적어주세요.',
  invalid: '보이는 글자가 있는 닉네임을 적어주세요.',
};

export function Lobby() {
  const connecting = useStore((s) => s.status === 'connecting');
  const joinError = useStore((s) => s.joinError);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (joinError) nameInput.current?.focus();
  }, [joinError]);
  const [name, setName] = useState('');
  const [tab, setTab] = useState<LookTab>('face');
  const { state, look, setLook, setBody } = useLooks(loadLooks);
  useEffect(() => saveLooks(state), [state]);
  return (
    <main className="dressing">
      <LookPreview look={look} tab={tab} />
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !connecting) connect({ name: name.trim().slice(0, 12), look });
        }}
      >
        <header>
          <h1>눈 내리는 마을</h1>
          <p>산책하고, 이야기하고, 케이크와 트리를 같이 꾸며요.</p>
        </header>
        <LookControls look={look} setLook={setLook} setBody={setBody} tab={tab} setTab={setTab} />
        <footer>
          {joinError && <p id="name-error" className="error" role="alert">{JOIN_ERROR[joinError]}</p>}
          <label>
            <span>닉네임</span>
            <input
              ref={nameInput}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                useStore.setState({ joinError: null });
              }}
              maxLength={12}
              placeholder="닉네임 12자까지"
              autoComplete="off"
              aria-invalid={!!joinError}
              aria-describedby={joinError ? 'name-error' : undefined}
            />
          </label>
          <button className="primary" disabled={!name.trim() || connecting}>
            {connecting ? '들어가는 중…' : '마을로 들어가기'}
          </button>
        </footer>
      </form>
    </main>
  );
}

const COLOR_LABEL = ['빨강', '금색', '초록', '파랑', '보라', '크림'];

export function Swatches({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="swatches">
      {COLORS.map((c, i) => (
        <button type="button" key={c} aria-label={COLOR_LABEL[i]} aria-pressed={i === value} style={{ background: c }} onClick={() => onChange(i)} />
      ))}
    </div>
  );
}
