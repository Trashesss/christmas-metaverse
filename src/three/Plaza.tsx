import { Html, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CAKE_TOP, COLORS, KIND_EMOJI, KIND_LABEL, KINDS, TREE_CONES, type Kind } from '../../shared/items';
import { COLLIDERS, EXHIBIT_SLOTS, GALLERY, RUN_SPEED, SPEED, STATIONS, facing, nearestSpot, resolveMove } from '../../shared/world';
import { readMove, stopInput } from '../input';
import { positions, send } from '../net';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import { Bulbs, Glow, Snow } from './Effects';
import { itemGeometry } from './itemGeometry';
import { Model } from './Model';
import { Ground, Village } from './Village';
import { FinishedWork, WorkBase } from './Work';

export function Plaza() {
  const players = useStore((s) => s.players);
  return (
    <>
      <Atmosphere />
      <Ground />
      <Village />
      <CentralTree />
      {KINDS.map((k) => (
        <Station key={k} kind={k} />
      ))}
      <Showcase />
      <Exhibits />
      {Object.values(players).map((p) => (
        <Avatar key={p.id} player={p} />
      ))}
      <Controller />
      <Snow follow />
    </>
  );
}

function Exhibits() {
  const exhibits = useStore((s) => s.exhibits);
  return KINDS.flatMap((kind) =>
    EXHIBIT_SLOTS[kind].map((slot, i) => {
      const work = exhibits.find((e) => e.kind === kind && e.slot === i);
      return (
        <group key={`${kind}${i}`} position={[slot.x, 0, slot.z]} rotation-y={slot.ry}>
          <mesh position-y={0.4} castShadow receiveShadow>
            <cylinderGeometry args={[0.9, 1.05, 0.8, 10]} />
            <meshStandardMaterial color="#c9d8ea" flatShading />
          </mesh>
          {work && (
            <>
              <group position-y={0.8} scale={0.55}>
                <FinishedWork kind={work.kind} base={work.base} decos={work.decos} strokes={work.strokes} resolution={256} />
              </group>
              <Glow position={[0, 1.6, -0.6]} size={2.6} />
              <Html center position={slot.high ? [0, kind === 'tree' ? 3.4 : 2.1, 0] : [0, 0.4, 1.15]} zIndexRange={[5, 0]} className="tag" pointerEvents="none">
                <div className="plaque">
                  {KIND_EMOJI[work.kind]} {work.names.join(' · ')}
                </div>
              </Html>
            </>
          )}
        </group>
      );
    }),
  );
}

/** 그림자 범위가 플레이어를 따라다녀, 넓은 맵에서도 가까운 곳의 그림자가 또렷하다. */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const l = light.current!;
    scene.add(l.target);
    return () => void scene.remove(l.target);
  }, [scene]);
  useFrame(() => {
    const l = light.current;
    const p = positions.get(useStore.getState().me);
    if (!l || !p) return;
    // 1m 단위로 옮겨 그림자 가장자리가 흔들리지 않게 한다.
    const x = Math.round(p.x);
    const z = Math.round(p.z);
    l.target.position.set(x, 0, z);
    l.position.set(x + 14, 22, z + 12);
  });
  return (
    <directionalLight
      ref={light}
      position={[14, 22, 12]}
      intensity={1.5}
      color="#cfdcff"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-camera-far={70}
      shadow-bias={-0.0005}
      shadow-normalBias={0.04}
    />
  );
}

function Atmosphere() {
  return (
    <>
      <color attach="background" args={['#1a2850']} />
      <fog attach="fog" args={['#33477c', 32, 105]} />
      <Stars radius={130} depth={30} count={900} factor={5} fade speed={0.5} />
      <hemisphereLight args={['#a9c4ff', '#4a4468', 1.5]} />
      <Sun />
      <pointLight position={[0, 4, 3.5]} color="#ffc46b" intensity={60} distance={18} />
      <pointLight position={[STATIONS.cake.x, 3, STATIONS.cake.z + 1]} color="#ff9f6b" intensity={26} distance={10} />
      <pointLight position={[STATIONS.tree.x, 3, STATIONS.tree.z + 1]} color="#ffcf7a" intensity={26} distance={10} />
    </>
  );
}

function CentralTree() {
  const bulbs = useMemo(
    () =>
      TREE_CONES.flatMap((c) => {
        const count = Math.round(c.r * 16);
        return Array.from({ length: count }, (_, i) => {
          const t = 0.15 + ((i * 0.37) % 0.7);
          const a = (i / count) * Math.PI * 2;
          const r = c.r * (1 - t) + 0.04;
          return new THREE.Vector3(Math.cos(a) * r, c.y + c.h * t, Math.sin(a) * r);
        });
      }),
    [],
  );
  const gifts = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ a: i * 0.72, s: 2.4 + (i % 3) * 0.8, c: i % COLORS.length })), []);
  return (
    <>
      <group scale={1.9}>
        <WorkBase kind="tree" base={0} />
        <Bulbs points={bulbs} size={0.06} />
        <mesh geometry={itemGeometry('star', 1)} position-y={3.85}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
        <Glow position={[0, 4.05, 0]} size={2.2} color="#ffd166" />
      </group>
      {gifts.map((g, i) => (
        <mesh key={i} geometry={itemGeometry('gift', g.c)} position={[Math.cos(g.a) * 2.1, 0.1 * g.s, Math.sin(g.a) * 2.1]} rotation-y={i} scale={g.s} castShadow>
          <meshStandardMaterial vertexColors />
        </mesh>
      ))}
    </>
  );
}

function Station({ kind }: { kind: Kind }) {
  const { x, z } = STATIONS[kind];
  return (
    <group position={[x, 0, z]}>
      {kind === 'cake' ? (
        <>
          <Model name="table_round_A" scale={1.05} />
          <group position-y={1.05} scale={0.55}>
            <WorkBase kind="cake" base={1} />
            <mesh geometry={itemGeometry('strawberry', 0)} position-y={CAKE_TOP} scale={1.8}>
              <meshStandardMaterial vertexColors />
            </mesh>
          </group>
        </>
      ) : (
        <group scale={0.85}>
          <WorkBase kind="tree" base={0} />
        </group>
      )}
      <Html center position={[0, kind === 'cake' ? 3 : 4, 0]} zIndexRange={[5, 0]} className="tag" pointerEvents="none">
        <div className="sign">
          {KIND_EMOJI[kind]} {KIND_LABEL[kind]} 꾸미기
        </div>
      </Html>
    </group>
  );
}

/** 진열장 앞 선반에는 최근 케이크 세 개를 미리 보여준다. */
function Showcase() {
  const exhibits = useStore((s) => s.exhibits);
  const latest = useMemo(() => exhibits.filter((e) => e.kind === 'cake').slice(-3), [exhibits]);
  return (
    <group position={[GALLERY.x, 0, GALLERY.z]} rotation-y={facing(GALLERY)}>
      <Model name="building_market_yellow" snow position={[0, 0, -0.9]} scale={2.2} />
      <mesh position={[0, 0.45, 1]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.9, 1]} />
        <meshStandardMaterial color="#8a4b3c" />
      </mesh>
      <mesh position={[0, 0.93, 1]} receiveShadow>
        <boxGeometry args={[3.8, 0.08, 1.15]} />
        <meshStandardMaterial color="#fff4e2" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[(i - 1) * 1.2, 0.97, 1]} scale={0.3}>
          {latest[i] ? (
            <FinishedWork kind="cake" base={latest[i].base} decos={latest[i].decos} strokes={latest[i].strokes} resolution={256} />
          ) : (
            <WorkBase kind="cake" base={i} />
          )}
        </group>
      ))}
      <pointLight position={[0, 2.4, 2]} color="#ffcf8a" intensity={14} distance={7} />
      <Html center position={[0, 3.5, 0.8]} zIndexRange={[5, 0]} className="tag" pointerEvents="none">
        <div className="sign">🍰 케이크 진열장</div>
      </Html>
    </group>
  );
}

const TREE_HEIGHT = 7.6;
/** 걸을 수 없는 경계 바깥의 숲으로 카메라가 나가지 않게 한다. */
const CAMERA_RADIUS = 35;
const MIN_CAMERA = 2.4;

/** 카메라가 중앙 트리나 건물, 나무 속에 들어가지 않는 거리까지 당긴다. */
function clearDistance(t: THREE.Vector3, yaw: number, pitch: number, dist: number) {
  for (let d = 1; d < dist; d += 0.25) {
    const y = t.y + Math.sin(pitch) * d;
    const x = t.x + Math.sin(yaw) * Math.cos(pitch) * d;
    const z = t.z + Math.cos(yaw) * Math.cos(pitch) * d;
    const inTree = Math.hypot(x, z) < 3.4 * (1 - y / TREE_HEIGHT);
    const inside = COLLIDERS.some((c) => c.h !== undefined && y < c.h + 0.3 && Math.hypot(x - c.x, z - c.z) < c.r + 0.5);
    if (inTree || inside || Math.hypot(x, z) > CAMERA_RADIUS) return Math.max(1, d - 0.4);
  }
  return dist;
}

function Controller() {
  const { camera, gl } = useThree();
  const view = useRef({ yaw: 0, pitch: 0.42, dist: 9.5 });
  const sent = useRef({ at: 0, x: 0, z: 0, ry: 0, moving: false });
  const target = useRef<THREE.Vector3 | null>(null);
  const shown = useRef(9.5);

  useEffect(() => {
    const el = gl.domElement;
    let drag: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      drag ??= { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      view.current.yaw -= (e.clientX - drag.x) * 0.006;
      view.current.pitch = THREE.MathUtils.clamp(view.current.pitch + (e.clientY - drag.y) * 0.004, 0.12, 1.1);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) drag = null;
    };
    const wheel = (e: WheelEvent) => {
      view.current.dist = THREE.MathUtils.clamp(view.current.dist + e.deltaY * 0.01, 4, 15);
    };
    el.addEventListener('pointerdown', down);
    // 탭이 숨으면 프레임이 멈추므로 멈춤 신호를 바로 보낸다.
    const hide = () => {
      const p = positions.get(useStore.getState().me);
      if (!document.hidden || !p) return;
      stopInput();
      p.moving = false;
      sent.current = { at: 0, ...p };
      send({ t: 'move', x: p.x, z: p.z, ry: p.ry, moving: false });
    };
    document.addEventListener('visibilitychange', hide);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', hide);
      el.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const { me, near, gallery } = useStore.getState();
    const p = positions.get(me);
    if (!p) return;
    const dt = Math.min(rawDt, 0.1);
    const { yaw, pitch, dist } = view.current;
    const input = gallery ? { x: 0, y: 0, run: false } : readMove();
    const speed = Math.hypot(input.x, input.y);
    p.moving = speed > 0.15;
    if (p.moving) {
      const dx = input.x * Math.cos(yaw) - input.y * Math.sin(yaw);
      const dz = -input.x * Math.sin(yaw) - input.y * Math.cos(yaw);
      const pace = input.run ? RUN_SPEED : SPEED;
      Object.assign(p, resolveMove(p.x + dx * pace * dt, p.z + dz * pace * dt));
      p.ry = Math.atan2(dx, dz);
    }

    const s = sent.current;
    const now = performance.now();
    const changed = s.x !== p.x || s.z !== p.z || s.ry !== p.ry || s.moving !== p.moving;
    if (changed && (now - s.at > 66 || s.moving !== p.moving)) {
      sent.current = { at: now, ...p };
      send({ t: 'move', x: p.x, z: p.z, ry: p.ry, moving: p.moving });
    }

    const found = nearestSpot(p.x, p.z, near);
    if (found !== near) useStore.setState({ near: found });

    const t = (target.current ??= new THREE.Vector3(p.x, 1.3, p.z));
    t.x = THREE.MathUtils.damp(t.x, p.x, 10, dt);
    t.z = THREE.MathUtils.damp(t.z, p.z, 10, dt);
    // 막히면 빠르게 당기고, 트이면 천천히 물러나 화면이 튀지 않게 한다.
    const want = Math.max(MIN_CAMERA, clearDistance(t, yaw, pitch, dist));
    shown.current = THREE.MathUtils.damp(shown.current, want, want < shown.current ? 18 : 4, dt);
    const d = shown.current;
    // 벽에 가까워질수록 어깨 너머로 조금 더 내려다본다.
    const tilt = pitch + Math.max(0, MIN_CAMERA + 1 - d) * 0.15;
    camera.position.set(
      t.x + Math.sin(yaw) * Math.cos(tilt) * d,
      t.y + Math.sin(tilt) * d,
      t.z + Math.cos(yaw) * Math.cos(tilt) * d,
    );
    camera.lookAt(t);
  });
  return null;
}
