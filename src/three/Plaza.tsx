import { Html, Stars, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CAKE_TOP, COLORS, KIND_EMOJI, KIND_LABEL, KINDS, TREE_CONES, type Kind } from '../../shared/items';
import { BENCHES, BUILDINGS, GALLERY, GALLERY_RANGE, EXHIBIT_SLOTS, STATIONS, STATION_RANGE, resolveMove } from '../../shared/world';
import { readMove, stopInput } from '../input';
import { positions, send } from '../net';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import { Bulbs, Glow, Snow } from './Effects';
import { itemGeometry } from './itemGeometry';
import { Model, modelUrl } from './Model';
import { FinishedWork, WorkBase } from './Work';

[...new Set(BUILDINGS.map((b) => b.model)), 'table_round_A', 'post_lantern', 'bench'].forEach((m) => useGLTF.preload(modelUrl(m)));

const SPEED = 5;

export function Plaza() {
  const players = useStore((s) => s.players);
  const exhibits = useStore((s) => s.exhibits);
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
      {EXHIBIT_SLOTS.map((slot, i) => {
        const work = exhibits.find((e) => e.slot === i);
        return (
          <group key={i} position={[slot.x, 0, slot.z]} rotation-y={Math.atan2(-slot.x, -slot.z)}>
            <mesh position-y={0.4} castShadow receiveShadow>
              <cylinderGeometry args={[0.9, 1.05, 0.8, 10]} />
              <meshStandardMaterial color="#c9d8ea" flatShading />
            </mesh>
            {work && (
              <>
                <group position-y={0.8} scale={0.5}>
                  <FinishedWork kind={work.kind} base={work.base} decos={work.decos} strokes={work.strokes} />
                </group>
                <Glow position={[0, 1.6, -0.6]} size={2.6} />
                <Html center position={[0, 0.4, 1.15]} zIndexRange={[5, 0]} className="tag" pointerEvents="none">
                  <div className="plaque">
                    {KIND_EMOJI[work.kind]} {work.names.join(' · ')}
                  </div>
                </Html>
              </>
            )}
          </group>
        );
      })}
      {Object.values(players).map((p) => (
        <Avatar key={p.id} player={p} />
      ))}
      <Controller />
      <Snow />
    </>
  );
}

function Atmosphere() {
  return (
    <>
      <color attach="background" args={['#1a2850']} />
      <fog attach="fog" args={['#33477c', 24, 62]} />
      <Stars radius={80} depth={20} count={900} factor={4} fade speed={0.5} />
      <hemisphereLight args={['#a9c4ff', '#4a4468', 1.5]} />
      <directionalLight
        position={[14, 22, 12]}
        intensity={1.5}
        color="#cfdcff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <pointLight position={[0, 4, 3.5]} color="#ffc46b" intensity={60} distance={16} />
      <pointLight position={[STATIONS.cake.x, 3, STATIONS.cake.z + 1]} color="#ff9f6b" intensity={26} distance={9} />
      <pointLight position={[STATIONS.tree.x, 3, STATIONS.tree.z + 1]} color="#ffcf7a" intensity={26} distance={9} />
    </>
  );
}

function Ground() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[70, 48]} />
        <meshStandardMaterial color="#dfe9f8" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.015} receiveShadow>
        <ringGeometry args={[3.4, 6.4, 48]} />
        <meshStandardMaterial color="#b8a89c" roughness={1} />
      </mesh>
      {KINDS.map((k) => (
        <mesh key={k} rotation-x={-Math.PI / 2} position={[STATIONS[k].x, 0.012, STATIONS[k].z]} receiveShadow>
          <circleGeometry args={[3, 32]} />
          <meshStandardMaterial color="#b8a89c" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

// 시드가 고정된 난수라 모두에게 같은 숲이 보인다.
function scatter() {
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 46 }, (_, i) => {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.1;
    const r = 25 + rnd() * 10;
    return {
      name: rnd() > 0.5 ? 'tree_single_A' : 'trees_A_medium',
      position: [Math.cos(a) * r, 0, Math.sin(a) * r] as [number, number, number],
      scale: 2.6 + rnd() * 1.8,
      ry: rnd() * 6,
    };
  });
}

function Village() {
  const trees = useMemo(scatter, []);
  const lamps = useMemo(
    () => [20, 70, 110, 160, 215, 250, 290, 325].map((d) => ({ x: Math.cos((d * Math.PI) / 180) * 16.5, z: Math.sin((d * Math.PI) / 180) * 16.5 })),
    [],
  );
  const garland = useMemo(() => {
    const out: THREE.Vector3[] = [];
    lamps.forEach((a, i) => {
      const b = lamps[(i + 1) % lamps.length];
      for (let k = 0; k < 14; k++) {
        const t = k / 14;
        out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, 3.3 - Math.sin(t * Math.PI) * 0.8, a.z + (b.z - a.z) * t));
      }
    });
    return out;
  }, [lamps]);
  return (
    <>
      {BUILDINGS.map((b, i) => {
        const x = Math.cos(b.angle) * b.r;
        const z = Math.sin(b.angle) * b.r;
        return <Model key={i} name={b.model} snow position={[x, 0, z]} rotation-y={Math.atan2(-x, -z)} scale={b.scale} />;
      })}
      {trees.map((t, i) => (
        <Model key={i} name={t.name} snow position={t.position} rotation-y={t.ry} scale={t.scale} />
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const h = 11 + ((i * 7) % 5) * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 52, h / 2 - 1, Math.sin(a) * 52]} rotation-y={i}>
            <coneGeometry args={[12 + (i % 3) * 2, h, 6]} />
            <meshStandardMaterial color="#c3d2ee" flatShading />
          </mesh>
        );
      })}
      {lamps.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]} rotation-y={Math.atan2(-l.x, -l.z)}>
          <Model name="post_lantern" />
          <Glow position={[0, 2.4, 1]} />
        </group>
      ))}
      <Bulbs points={garland} />
      {BENCHES.map((b) => (
        <Model key={`${b.x}:${b.z}`} name="bench" position={[b.x, 0, b.z]} rotation-y={Math.atan2(-b.x, -b.z)} />
      ))}
      {[12, 100, 190].map((d, i) => {
        const a = (d * Math.PI) / 180;
        return (
          <mesh
            key={d}
            geometry={itemGeometry('snowman', i)}
            position={[Math.cos(a) * 13.5, 0, Math.sin(a) * 13.5]}
            rotation-y={Math.atan2(-Math.cos(a), -Math.sin(a))}
            scale={2.8}
            castShadow
          >
            <meshStandardMaterial vertexColors />
          </mesh>
        );
      })}
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
    <group position={[GALLERY.x, 0, GALLERY.z]} rotation-y={Math.atan2(-GALLERY.x, -GALLERY.z)}>
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
      <Html center position={[0, 2.9, 0.8]} zIndexRange={[5, 0]} className="tag" pointerEvents="none">
        <div className="sign">🍰 케이크 진열장</div>
      </Html>
    </group>
  );
}

const TREE_HEIGHT = 7.6;

/** 카메라가 중앙 트리 속에 들어가지 않는 거리까지 당긴다. */
function clearDistance(t: THREE.Vector3, yaw: number, pitch: number, dist: number) {
  for (let d = 1; d < dist; d += 0.25) {
    const y = t.y + Math.sin(pitch) * d;
    const r = Math.hypot(t.x + Math.sin(yaw) * Math.cos(pitch) * d, t.z + Math.cos(yaw) * Math.cos(pitch) * d);
    if (r < 3.4 * (1 - y / TREE_HEIGHT)) return Math.max(1, d - 0.4);
  }
  return dist;
}

function Controller() {
  const { camera, gl } = useThree();
  const view = useRef({ yaw: 0, pitch: 0.42, dist: 9.5 });
  const sent = useRef({ at: 0, x: 0, z: 0, ry: 0, moving: false });
  const target = useRef<THREE.Vector3 | null>(null);

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
    const input = gallery ? { x: 0, y: 0 } : readMove();
    const speed = Math.hypot(input.x, input.y);
    p.moving = speed > 0.15;
    if (p.moving) {
      const dx = input.x * Math.cos(yaw) - input.y * Math.sin(yaw);
      const dz = -input.x * Math.sin(yaw) - input.y * Math.cos(yaw);
      Object.assign(p, resolveMove(p.x + dx * SPEED * dt, p.z + dz * SPEED * dt));
      p.ry = Math.atan2(dx, dz);
    }

    const s = sent.current;
    const now = performance.now();
    const changed = s.x !== p.x || s.z !== p.z || s.ry !== p.ry || s.moving !== p.moving;
    if (changed && (now - s.at > 66 || s.moving !== p.moving)) {
      sent.current = { at: now, ...p };
      send({ t: 'move', x: p.x, z: p.z, ry: p.ry, moving: p.moving });
    }

    const within = (s: { x: number; z: number }, range = STATION_RANGE) => Math.hypot(p.x - s.x, p.z - s.z) < range;
    const found = KINDS.find((k) => within(STATIONS[k])) ?? (within(GALLERY, GALLERY_RANGE) ? 'gallery' : null);
    if (found !== near) useStore.setState({ near: found });

    const t = (target.current ??= new THREE.Vector3(p.x, 1.3, p.z));
    t.x = THREE.MathUtils.damp(t.x, p.x, 10, dt);
    t.z = THREE.MathUtils.damp(t.z, p.z, 10, dt);
    const d = clearDistance(t, yaw, pitch, dist);
    camera.position.set(
      t.x + Math.sin(yaw) * Math.cos(pitch) * d,
      t.y + Math.sin(pitch) * d,
      t.z + Math.cos(yaw) * Math.cos(pitch) * d,
    );
    camera.lookAt(t);
  });
  return null;
}
