import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  BODIES,
  BODY_LABEL,
  CLOTH_COLORS,
  EYES,
  EYE_COLORS,
  FACES,
  HAIR_COLORS,
  LIPS,
  LIP_COLORS,
  PARTS,
  SKIN_COLORS,
  randomLook,
  type Body,
  type Look,
  type Option,
} from '../../shared/look';
import { loadLooks, withLook, type Looks } from '../look';
import { send } from '../net';
import { useStore } from '../store';
import { AvatarModel } from '../three/Avatar';
import { Snow } from '../three/Effects';

/** 남/여마다 고른 모습을 따로 기억한다. */
export function useLooks(init: () => Looks) {
  const [state, setState] = useState(init);
  const look = state.looks[state.body];
  const setLook = (next: Look) => setState((s) => withLook(s, next));
  const setBody = (body: Body) => setState((s) => ({ ...s, body }));
  return { state, look, setLook, setBody };
}

const TABS = [
  { id: 'face', label: '얼굴' },
  { id: 'hair', label: '머리' },
  { id: 'eyes', label: '눈' },
  { id: 'lips', label: '입술' },
  { id: 'clothes', label: '옷' },
  { id: 'hat', label: '모자' },
] as const;
export type LookTab = (typeof TABS)[number]['id'];

const VIEW: Record<LookTab, { y: number; dist: number }> = {
  face: { y: 1.3, dist: 1.55 },
  hair: { y: 1.22, dist: 1.45 },
  eyes: { y: 1.2, dist: 1.1 },
  lips: { y: 1.16, dist: 1.1 },
  clothes: { y: 0.82, dist: 3.15 },
  hat: { y: 1.33, dist: 1.65 },
};

function View({ tab }: { tab: LookTab }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const { y, dist } = VIEW[tab];
    const k = 1 - Math.exp(-7 * dt);
    const offset = camera.position.clone().sub(c.target);
    offset.setLength(offset.length() + (dist - offset.length()) * k);
    c.target.y += (y - c.target.y) * k;
    camera.position.copy(c.target).add(offset);
    c.update();
  });
  return <OrbitControls ref={controls} target={[0, VIEW.face.y, 0]} enableZoom={false} enablePan={false} minPolarAngle={1.2} maxPolarAngle={1.62} />;
}

export function LookPreview({ look, tab }: { look: Look; tab: LookTab }) {
  return (
    <div className="preview">
      <Canvas shadows="percentage" camera={{ position: [0, 1.5, 1.5], fov: 34, near: 0.05 }}>
        <hemisphereLight args={['#c9d8ff', '#6b5a68', 2]} />
        <directionalLight position={[3, 5, 4]} intensity={2} color="#ffe6c4" castShadow />
        <Suspense fallback={null}>
          {/* 머리를 고르는 동안에는 모자를 벗겨 보여준다. */}
          <AvatarModel look={tab === 'hair' ? { ...look, hat: false } : look} clip="Idle" faceSize={512} />
        </Suspense>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[0.6, 40]} />
          <meshStandardMaterial color="#e6eefb" />
        </mesh>
        <Snow count={120} area={7} height={5} />
        <View tab={tab} />
      </Canvas>
    </div>
  );
}

interface ControlProps {
  look: Look;
  setLook: (look: Look) => void;
  setBody: (body: Body) => void;
  tab: LookTab;
  setTab: (tab: LookTab) => void;
}

export function LookControls({ look, setLook, setBody, tab, setTab }: ControlProps) {
  // 부품 이름은 몸마다 다른 유니언이라 고른 값은 서버와 저장소에서 스키마로 다시 확인한다.
  const set = (patch: Partial<Record<keyof Look, string | number | boolean>>) => setLook({ ...look, ...patch } as Look);
  const parts = PARTS[look.body];
  const tabs = useRef<HTMLDivElement>(null);
  const choose = (key: 'face' | 'hair' | 'eyes' | 'lips' | 'top' | 'bottom' | 'shoes', label: string, list: readonly Option[]) => (
    <fieldset>
      <legend>{label}</legend>
      <div className="chips">
        {list.map((o) => (
          <button type="button" key={o.id} aria-pressed={look[key] === o.id} onClick={() => set({ [key]: o.id })}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
  const paint = (key: 'skin' | `${'hair' | 'eye' | 'lip' | 'top' | 'bottom' | 'shoes' | 'hat'}Color`, label: string, list: readonly { label: string; color: string }[]) => (
    <fieldset>
      <legend>
        {label} <em>{list[look[key]].label}</em>
      </legend>
      <div className="swatches">
        {list.map((c, i) => (
          <button
            type="button"
            key={c.color}
            title={c.label}
            aria-label={c.label}
            aria-pressed={i === look[key]}
            style={{ background: c.color }}
            onClick={() => set({ [key]: i })}
          />
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className="look">
      <div className="row">
        <fieldset>
          <legend className="sr-only">남/여</legend>
          <div className="choices">
            {BODIES.map((b) => (
              <button type="button" key={b} aria-pressed={b === look.body} onClick={() => setBody(b)}>
                {BODY_LABEL[b]}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={() => setLook(randomLook(look.body))}>🎲 랜덤</button>
      </div>
      <div
        className="look-tabs"
        role="tablist"
        aria-label="꾸밀 곳"
        ref={tabs}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          const i = (TABS.findIndex((t) => t.id === tab) + step + TABS.length) % TABS.length;
          setTab(TABS[i].id);
          (tabs.current?.children[i] as HTMLElement).focus();
        }}
      >
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={t.id === tab}
            aria-controls="look-panel"
            tabIndex={t.id === tab ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="look-panel" id="look-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab}>
        {tab === 'face' && (
          <>
            {paint('skin', '피부색', SKIN_COLORS)}
            {choose('face', '얼굴형', FACES)}
          </>
        )}
        {tab === 'hair' && (
          <>
            {choose('hair', '머리 모양', parts.hair)}
            {paint('hairColor', '머리색', HAIR_COLORS)}
          </>
        )}
        {tab === 'eyes' && (
          <>
            {choose('eyes', '눈 모양', EYES)}
            {paint('eyeColor', '눈동자색', EYE_COLORS)}
          </>
        )}
        {tab === 'lips' && (
          <>
            {choose('lips', '입술 모양', LIPS)}
            {paint('lipColor', '입술색', LIP_COLORS)}
          </>
        )}
        {tab === 'clothes' && (
          <>
            {choose('top', '상의', parts.top)}
            {paint('topColor', '상의 색', CLOTH_COLORS)}
            {choose('bottom', '하의', parts.bottom)}
            {paint('bottomColor', '하의 색', CLOTH_COLORS)}
            {choose('shoes', '신발', parts.shoes)}
            {paint('shoesColor', '신발 색', CLOTH_COLORS)}
          </>
        )}
        {tab === 'hat' && (
          <>
            <fieldset>
              <legend>산타 모자</legend>
              <div className="chips">
                <button type="button" aria-pressed={look.hat} onClick={() => set({ hat: true })}>쓰기</button>
                <button type="button" aria-pressed={!look.hat} onClick={() => set({ hat: false })}>벗기</button>
              </div>
            </fieldset>
            {look.hat && paint('hatColor', '모자 색', CLOTH_COLORS)}
          </>
        )}
      </div>
    </div>
  );
}

const close = () => useStore.setState({ editing: false });

/** 지금 광장에 보이는 모습에서 시작한다. */
function currentLooks() {
  const { players, me } = useStore.getState();
  const look = players[me]?.look;
  return look ? withLook(loadLooks(), look) : loadLooks();
}

/** 광장에서 여는 꾸미기 화면. 적용하기 전에는 다른 사람에게 보이지 않는다. */
export function LookDialog() {
  const root = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<LookTab>('face');
  const { look, setLook, setBody } = useLooks(currentLooks);
  useEffect(() => {
    root.current?.focus();
    return () => document.querySelector<HTMLElement>('.dress')?.focus();
  }, []);
  return (
    <section
      className="dressing"
      role="dialog"
      aria-modal="true"
      aria-label="모습 꾸미기"
      ref={root}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <LookPreview look={look} tab={tab} />
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          send({ t: 'look', look });
          close();
        }}
      >
        <LookControls look={look} setLook={setLook} setBody={setBody} tab={tab} setTab={setTab} />
        <footer>
          <button type="button" onClick={close}>취소</button>
          <button className="primary">이 모습으로</button>
        </footer>
      </form>
    </section>
  );
}
