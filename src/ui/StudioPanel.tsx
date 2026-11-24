import { useState } from 'react';
import { BASES, ITEMS, KIND_EMOJI, KIND_LABEL, MAX_DECOS, findItem, type Kind } from '../../shared/items';
import { FONTS, MAX_TEXT, PAINT_COLORS, TOOLS } from '../../shared/paint';
import { send } from '../net';
import { editStrokes, useStore, type StudioTab } from '../store';
import { Swatches } from './Lobby';

export function StudioPanel() {
  const session = useStore((s) => s.session);
  const me = useStore((s) => s.me);
  const tab = useStore((s) => s.tab);
  const [leaving, setLeaving] = useState(false);
  if (!session) return null;
  const { kind, decos, members, ready, base } = session;
  const iAmReady = ready.includes(me);
  const partnerReady = ready.some((id) => id !== me);
  const tabs: [StudioTab, string][] =
    kind === 'cake'
      ? [['paint', '그리기'], ['topping', '토핑'], ['base', '시트']]
      : [['topping', '장식'], ['base', '나무']];
  return (
    <>
      <header className="studio-top">
        <button onClick={() => setLeaving(true)}>나가기</button>
        <span>
          {KIND_EMOJI[kind]} {KIND_LABEL[kind]} {decos.length}/{MAX_DECOS}
        </span>
        <button className={iAmReady ? '' : 'primary'} onClick={() => send({ t: 'ready', on: !iAmReady })}>
          {iAmReady ? '더 꾸밀래요' : members.length < 2 ? '완성하기' : partnerReady ? '나도 완성!' : '완성할까요?'}
        </button>
      </header>
      {(iAmReady || partnerReady) && (
        <p className="hint">{iAmReady ? '상대방도 완성을 누르면 광장에 전시돼요.' : '상대방은 완성 준비가 됐어요.'}</p>
      )}
      {leaving && (
        <div className="card confirm" role="alertdialog" aria-label="나가기 확인">
          <p>광장으로 돌아갈까요?</p>
          <div className="row">
            <button onClick={() => setLeaving(false)}>계속 꾸미기</button>
            <button className="primary" onClick={() => send({ t: 'leaveSession' })}>돌아가기</button>
          </div>
        </div>
      )}
      <section className="palette card">
        <div className="tabs">
          {tabs.map(([id, label]) => (
            <button key={id} aria-pressed={tab === id} onClick={() => useStore.setState({ tab: id })}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'paint' && <PaintTools />}
        {tab === 'topping' && <Toppings kind={kind} />}
        {tab === 'base' && (
          <div className="bases">
            {BASES[kind].map((b, i) => (
              <button key={b.label} aria-pressed={i === base} onClick={() => send({ t: 'base', base: i })}>
                {b.label}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

const SIZE_LABEL = ['가늘게', '보통', '굵게'];
const COLOR_LABEL = ['초코', '빨강', '분홍', '주황', '노랑', '초록', '파랑', '보라', '캐러멜', '민트', '하양', '남색'];

function undo() {
  const { session, me } = useStore.getState();
  const last = session?.strokes.findLast((s) => s.by === me);
  if (!last) return;
  editStrokes((list) => list.filter((s) => s !== last));
  send({ t: 'unstroke', id: last.id });
}

function PaintTools() {
  const tool = useStore((s) => s.tool);
  const color = useStore((s) => s.paintColor);
  const size = useStore((s) => s.size);
  const text = useStore((s) => s.text);
  const font = useStore((s) => s.font);
  return (
    <>
      <div className="items">
        {TOOLS.map((t) => (
          <button key={t.id} aria-pressed={t.id === tool} onClick={() => useStore.setState({ tool: t.id })}>
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
        <button aria-pressed={tool === 'erase'} onClick={() => useStore.setState({ tool: 'erase' })}>
          <span>🧽</span>지우개
        </button>
        <button onClick={undo}>
          <span>↩️</span>되돌리기
        </button>
      </div>
      <div className="options">
        {tool === 'text' && (
          <div className="lettering">
            <input
              value={text}
              maxLength={MAX_TEXT}
              placeholder="적고 케이크를 눌러요"
              aria-label="케이크에 쓸 글자"
              autoComplete="off"
              onChange={(e) => useStore.setState({ text: e.target.value.slice(0, MAX_TEXT) })}
            />
            {FONTS.map((f, i) => (
              <button key={f.family} aria-pressed={i === font} style={{ fontFamily: f.family }} onClick={() => useStore.setState({ font: i })}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        {tool !== 'erase' && (
          <>
            <div className="paints">
              {PAINT_COLORS.map((c, i) => (
                <button key={c} aria-label={COLOR_LABEL[i]} aria-pressed={i === color} style={{ background: c }} onClick={() => useStore.setState({ paintColor: i })} />
              ))}
            </div>
            <div className="bases">
              {SIZE_LABEL.map((label, i) => (
                <button key={label} aria-pressed={i === size} onClick={() => useStore.setState({ size: i })}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Toppings({ kind }: { kind: Kind }) {
  const item = useStore((s) => s.item);
  const color = useStore((s) => s.color);
  const removing = useStore((s) => s.removing);
  return (
    <>
      <div className="items">
        {ITEMS[kind].map((i) => (
          <button
            key={i.id}
            aria-pressed={!removing && i.id === item}
            onClick={() => useStore.setState({ item: i.id, removing: false })}
          >
            <span>{i.emoji}</span>
            {i.label}
          </button>
        ))}
        <button aria-pressed={removing} onClick={() => useStore.setState({ removing: !removing })}>
          <span>🧤</span>떼어내기
        </button>
      </div>
      {!removing && findItem(kind, item)?.tint && (
        <div className="options">
          <Swatches value={color} onChange={(c) => useStore.setState({ color: c })} />
        </div>
      )}
    </>
  );
}
