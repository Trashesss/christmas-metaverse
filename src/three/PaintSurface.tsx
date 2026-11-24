import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CAKE_TOP, PAINT_RADIUS } from '../../shared/items';
import { MAX_CHUNK, MAX_STROKE_POINTS, SIZES, TEXT_SIZES, type Stroke } from '../../shared/paint';
import { send } from '../net';
import { editStrokes, toast, useStore } from '../store';

const MIN_STEP = 0.014;
const FLUSH_GAP = 50;
const round = (v: number) => Math.round(v * 1000) / 1000;
// http로 접속한 휴대폰에는 crypto.randomUUID가 없다.
const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** 그리기 모드에서 케이크 윗면의 포인터 입력을 획으로 바꾼다. */
export function PaintSurface({ onCursor }: { onCursor: (p: THREE.Vector3 | null) => void }) {
  const draw = useRef<{ pointer: number; id: string; count: number; x: number; z: number; paused: boolean; pending: number[]; sentAt: number } | null>(null);
  const erasing = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => {
      flush();
      draw.current = erasing.current = null;
    };
    const end = (e: PointerEvent) => {
      if (erasing.current === e.pointerId) erasing.current = null;
      if (draw.current?.pointer !== e.pointerId) return;
      flush();
      draw.current = null;
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
      removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
      stop();
      onCursor(null);
    };
  }, []);

  const flush = () => {
    const d = draw.current;
    if (!d?.pending.length) return;
    send({ t: 'strokeMore', id: d.id, pts: d.pending });
    d.pending = [];
    d.sentAt = performance.now();
  };

  const locate = (e: ThreeEvent<PointerEvent>) => {
    const p = e.eventObject.worldToLocal(e.point.clone());
    // 원판은 눕혀 놓았으므로 지역 좌표의 -y가 케이크의 +z이다.
    return { x: round(p.x / PAINT_RADIUS), z: round(-p.y / PAINT_RADIUS) };
  };

  const begin = (pointer: number, pts: number[]) => {
    const { tool, paintColor: color, size, me } = useStore.getState();
    if (tool === 'erase') return;
    const id = newId();
    draw.current = { pointer, id, count: pts.length / 2, x: pts.at(-2)!, z: pts.at(-1)!, paused: false, pending: [], sentAt: performance.now() };
    editStrokes((list) => [...list, { id, by: me, tool, color, size, pts }]);
    send({ t: 'stroke', id, tool, color, size, pts });
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (draw.current || (e.pointerType === 'mouse' && (e.button !== 0 || e.ctrlKey))) return;
    const { x, z } = locate(e);
    if (Math.hypot(x, z) > 1) return;
    const s = useStore.getState();
    if (s.tool === 'erase') {
      erasing.current = e.pointerId;
      return eraseAt(x, z);
    }
    if (s.tool !== 'text') return begin(e.pointerId, [x, z]);
    const text = s.text.trim();
    if (!text) return toast('아래에 글자를 먼저 적어주세요.');
    const stroke = { id: newId(), tool: s.tool, color: s.paintColor, size: s.size, pts: [x, z], text, font: s.font };
    editStrokes((list) => [...list, { ...stroke, by: s.me }]);
    send({ t: 'stroke', ...stroke });
  };

  /** 원 밖으로 나갔다 돌아오면 이어 긋지 않고 새 획으로 시작한다. */
  const pause = (e: ThreeEvent<PointerEvent>) => {
    if (draw.current?.pointer !== e.pointerId) return;
    flush();
    draw.current.paused = true;
  };
  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    pause(e);
    onCursor(null);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onCursor(e.point);
    const { x, z } = locate(e);
    // 창 밖에서 손을 떼 pointerup을 놓친 경우
    if (e.buttons === 0) {
      flush();
      draw.current = erasing.current = null;
      return;
    }
    if (Math.hypot(x, z) > 1) return pause(e);
    if (erasing.current === e.pointerId) return eraseAt(x, z);
    const d = draw.current;
    if (d?.paused && d.pointer === e.pointerId) return begin(e.pointerId, [x, z]);
    if (!d || d.pointer !== e.pointerId || Math.hypot(x - d.x, z - d.z) < MIN_STEP) return;
    // 서버가 거절해 사라진 획은 더 그리지 않는다.
    if (!useStore.getState().session?.strokes.some((s) => s.id === d.id)) {
      draw.current = null;
      return;
    }
    if (d.count >= MAX_STROKE_POINTS) {
      flush();
      return begin(e.pointerId, [d.x, d.z, x, z]);
    }
    Object.assign(d, { x, z, count: d.count + 1 });
    d.pending.push(x, z);
    editStrokes((list) => list.map((s) => (s.id === d.id ? { ...s, pts: [...s.pts, x, z] } : s)));
    if (performance.now() - d.sentAt > FLUSH_GAP || d.pending.length >= MAX_CHUNK * 2) flush();
  };

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={CAKE_TOP + 0.01} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerOut={onPointerOut}>
      <circleGeometry args={[PAINT_RADIUS, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function eraseAt(x: number, z: number) {
  const { session, me } = useStore.getState();
  const hit = session?.strokes.findLast((s) => s.by === me && touches(s, x, z));
  if (!hit) return;
  editStrokes((list) => list.filter((s) => s !== hit));
  send({ t: 'unstroke', id: hit.id });
}

function touches(s: Stroke, x: number, z: number) {
  if (s.tool === 'text') {
    const h = TEXT_SIZES[s.size];
    const halfW = Math.min(0.87, (s.text!.length * h) / 2);
    return Math.abs(x - s.pts[0]) < halfW && Math.abs(z - s.pts[1]) < h / 2;
  }
  const reach = SIZES[s.size] * REACH[s.tool] + 0.03;
  const { pts } = s;
  for (let i = 0; i < pts.length; i += 2) {
    const j = Math.min(i + 2, pts.length - 2);
    const dx = pts[j] - pts[i];
    const dz = pts[j + 1] - pts[i + 1];
    const len2 = dx * dx + dz * dz;
    const t = len2 ? THREE.MathUtils.clamp(((x - pts[i]) * dx + (z - pts[i + 1]) * dz) / len2, 0, 1) : 0;
    if (Math.hypot(x - pts[i] - dx * t, z - pts[i + 1] - dz * t) < reach) return true;
  }
  return false;
}

/** 재료가 중심선에서 퍼지는 정도(굵기 배수) */
const REACH: Record<Stroke['tool'], number> = { pen: 0.5, text: 0, cream: 1.25, jam: 1.2, sprinkle: 2.2, glitter: 2.2, powder: 3 };
