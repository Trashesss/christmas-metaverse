import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import { BASES, PAINT_RADIUS, CAKE_TIERS, findItem } from '../../shared/items';
import type { Exhibit } from '../../shared/protocol';
import { useStore } from '../store';
import { drawPaint, loadFonts } from '../three/drawPaint';
import { Snow } from '../three/Effects';
import { Model } from '../three/Model';
import { FinishedWork } from '../three/Work';

const close = () => useStore.setState({ gallery: null });

export function Gallery({ cakes }: { cakes: Exhibit[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const step = (d: number) => setIndex((i) => (i === null ? i : (i + d + cakes.length) % cakes.length));
  useEffect(() => panel.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') index === null ? close() : setIndex(null);
      if (e.code === 'ArrowLeft') step(-1);
      if (e.code === 'ArrowRight') step(1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  const cake = index === null ? null : cakes[index];
  return (
    <section className="gallery" role="dialog" aria-label="케이크 진열장" ref={panel} tabIndex={-1}>
      <header>
        <button onClick={cake ? () => setIndex(null) : close}>{cake ? '목록으로' : '광장으로'}</button>
        <h2>{cake ? cake.names.join(' · ') : `케이크 진열장 ${cakes.length}`}</h2>
        <span className="pager">
          {cake && (
            <>
              <button aria-label="이전 케이크" onClick={() => step(-1)}>‹</button>
              <button aria-label="다음 케이크" onClick={() => step(1)}>›</button>
            </>
          )}
        </span>
      </header>
      {cake ? (
        <div className="view">
          <Canvas shadows="percentage" camera={{ position: innerWidth < innerHeight ? [0, 7.2, 6] : [0, 5.2, 4.4], fov: innerWidth < innerHeight ? 60 : 42 }}>
            <hemisphereLight args={['#dfe6ff', '#8a7a80', 1.8]} />
            <directionalLight position={[4, 8, 3]} intensity={1.8} color="#fff0dc" castShadow shadow-normalBias={0.03} />
            <Suspense fallback={null}>
              <Model name="table_round_A" scale={[1.3, 1.05, 1.3]} />
              <group position-y={1.05} key={cake.id}>
                <FinishedWork kind="cake" base={cake.base} decos={cake.decos} strokes={cake.strokes} resolution={1024} />
              </group>
            </Suspense>
            <Snow count={120} area={12} height={8} />
            <OrbitControls target={[0, 1.2, 0]} enablePan={false} autoRotate autoRotateSpeed={0.8} minDistance={3} maxDistance={11} maxPolarAngle={1.5} />
          </Canvas>
        </div>
      ) : cakes.length ? (
        <ul>
          {cakes.map((c, i) => (
            <li key={c.id}>
              <button onClick={() => setIndex(i)}>
                <Thumbnail cake={c} />
                {c.names.join(' · ')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">아직 완성된 케이크가 없어요. 첫 케이크를 꾸며보세요!</p>
      )}
    </section>
  );
}

const SIZE = 240;

function Thumbnail({ cake }: { cake: Exhibit }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const draw = () => ref.current && paint(ref.current.getContext('2d')!, cake);
    draw();
    void loadFonts(cake.strokes).then((hasText) => live && hasText && draw());
    return () => {
      live = false;
    };
  }, [cake]);
  return <canvas ref={ref} width={SIZE} height={SIZE} />;
}

function paint(ctx: CanvasRenderingContext2D, cake: Exhibit) {
  const { color, accent } = BASES.cake[cake.base];
  const c = SIZE / 2;
  const scale = (c - 8) / CAKE_TIERS[0].r;
  const inner = PAINT_RADIUS * scale;
  const layer = document.createElement('canvas');
  layer.width = layer.height = Math.round(inner * 2);
  drawPaint(layer.getContext('2d')!, layer.width, cake.strokes, true);
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = accent;
  ctx.strokeStyle = '#0000001f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c, c, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(layer, c - inner, c - inner);
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  for (const d of cake.decos) ctx.fillText(findItem('cake', d.item)?.emoji ?? '', c + d.p[0] * scale, c + d.p[2] * scale);
}
