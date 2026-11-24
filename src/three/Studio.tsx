import { OrbitControls } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { findItem, TREE_TOP, type Kind } from '../../shared/items';
import type { Deco, SessionState, Vec3 } from '../../shared/protocol';
import { send } from '../net';
import { toast, useStore } from '../store';
import { Avatar } from './Avatar';
import { CakePaint } from './CakePaint';
import { Glow, Snow } from './Effects';
import { decoTransform, itemGeometry } from './itemGeometry';
import { PaintSurface } from './PaintSurface';
import { Model } from './Model';
import { WorkBase } from './Work';

const CURSOR_GAP = 80;
const DRAG_LIMIT = 6;
const WORK_Y = { cake: 1.05, tree: 0 };
const round = (v: number) => Math.round(v * 1000) / 1000;

interface Spot {
  p: Vec3;
  n: Vec3;
}

export function Studio({ session }: { session: SessionState }) {
  const players = useStore((s) => s.players);
  const { kind, members } = session;
  const work = useRef<THREE.Group>(null);
  const lastCursor = useRef(0);
  const [hover, setHover] = useState<Spot | null>(null);
  const tab = useStore((s) => s.tab);
  const painting = tab === 'paint' && kind === 'cake';
  const item = useStore((s) => s.item);
  const color = useStore((s) => s.color);
  const removing = useStore((s) => s.removing);
  const partnerCursor = useStore((s) => s.partnerCursor);

  const camera = useThree((s) => s.camera);
  const portrait = useThree((s) => s.size.width < s.size.height);
  useLayoutEffect(() => {
    setHover(null);
    if (painting) {
      camera.position.set(0, portrait ? 9.2 : 7, portrait ? 4.6 : 3);
      camera.lookAt(0, 1.6, portrait ? 1.6 : 0.4);
    } else camera.position.set(0, 3.6, portrait ? 10.5 : 7.8);
  }, [camera, painting, portrait]);

  const spotOf = (e: ThreeEvent<MouseEvent>): Spot | null => {
    if (!work.current || !e.face) return null;
    const p = work.current.worldToLocal(e.point.clone());
    // 작업물 그룹은 이동만 하므로 메시 법선을 그대로 쓸 수 있다.
    return { p: p.toArray().map(round) as Vec3, n: e.face.normal.toArray().map(round) as Vec3 };
  };
  const shareCursor = (point: THREE.Vector3 | null) => {
    if (!point) return send({ t: 'cursor', p: null });
    if (!work.current || performance.now() - lastCursor.current < CURSOR_GAP) return;
    lastCursor.current = performance.now();
    send({ t: 'cursor', p: work.current.worldToLocal(point.clone()).toArray().map(round) as Vec3 });
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse') setHover(spotOf(e));
    shareCursor(e.point);
  };
  const onPointerOut = () => {
    setHover(null);
    send({ t: 'cursor', p: null });
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > DRAG_LIMIT || removing || tab === 'base') return;
    const spot = spotOf(e);
    if (!spot) return;
    if (findItem(kind, item)?.mount === 'stand' && spot.n[1] < 0.5) return toast('이 장식은 윗면에 세워주세요.');
    send({ t: 'place', item, color, ...spot });
  };

  return (
    <>
      <color attach="background" args={['#26345f']} />
      <fog attach="fog" args={['#33477c', 16, 42]} />
      <hemisphereLight args={['#c9d8ff', '#6b5a68', 1.6]} />
      <directionalLight position={[5, 9, 6]} intensity={1.8} color="#fff0dc" castShadow shadow-mapSize={[1024, 1024]} shadow-normalBias={0.03} />
      <pointLight position={[-3, 3, 3]} color="#ffb066" intensity={22} distance={10} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[40, 40]} />
        <meshStandardMaterial color="#dfe9f8" />
      </mesh>
      <Backdrop />
      {kind === 'cake' && <Model name="table_round_A" scale={[1.3, 1.05, 1.3]} />}
      <group ref={work} position-y={WORK_Y[kind]}>
        <WorkBase kind={kind} base={session.base} {...(!painting && { onClick, onPointerMove, onPointerOut })} />
        {kind === 'cake' && <CakePaint strokes={session.strokes} resolution={1024} />}
        {painting && <PaintSurface onCursor={shareCursor} />}
        {session.decos.map((d) => (
          <DecoMesh key={d.id} kind={kind} deco={d} removing={removing && tab === 'topping'} />
        ))}
        {hover && !removing && tab === 'topping' && <Ghost kind={kind} item={item} color={color} spot={hover} />}
        {partnerCursor && <Glow position={partnerCursor} size={0.7} onTop color="#8fd3ff" />}
      </group>
      {members.map(
        (id, i) =>
          players[id] && <Avatar key={id} player={players[id]} pose={poseAt(i, portrait)} />,
      )}
      <Snow count={250} area={22} height={10} />
      {!painting && <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, (kind === 'cake' ? 1.5 : 1.9) - (portrait ? 0.9 : 0), 0]}
        minDistance={4}
        maxDistance={13}
        minPolarAngle={0.25}
        maxPolarAngle={1.5}
      />}
    </>
  );
}

/** 세로 화면에서는 아래쪽 팔레트를 피해 작품을 위로 올리고 둘을 안쪽에 세운다. */
const poseAt = (i: number, portrait: boolean) => {
  const x = portrait ? 1.9 : 2.5;
  return i ? { x, z: 0.9, ry: -0.8 } : { x: -x, z: 0.9, ry: 0.8 };
};

function DecoMesh({ kind, deco, removing }: { kind: Kind; deco: Deco; removing: boolean }) {
  const { position, quaternion } = useMemo(() => decoTransform(kind, deco), [kind, deco]);
  const mine = useStore((s) => s.me === deco.by);
  return (
    <mesh
      geometry={itemGeometry(deco.item, deco.color)}
      position={position}
      quaternion={quaternion}
      castShadow
      raycast={removing ? THREE.Mesh.prototype.raycast : () => null}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta <= DRAG_LIMIT) send({ t: 'remove', id: deco.id });
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.5} transparent={removing && !mine} opacity={removing && !mine ? 0.45 : 1} />
    </mesh>
  );
}

function Ghost({ kind, item, color, spot }: { kind: Kind; item: string; color: number; spot: Spot }) {
  const mount = findItem(kind, item)?.mount;
  if (!mount || (mount === 'stand' && spot.n[1] < 0.5)) return null;
  const p: Vec3 = mount === 'topper' ? [0, TREE_TOP, 0] : spot.p;
  const { position, quaternion } = decoTransform(kind, { item, p, n: spot.n });
  return (
    <mesh geometry={itemGeometry(item, color)} position={position} quaternion={quaternion} raycast={() => null}>
      <meshStandardMaterial vertexColors transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

function Backdrop() {
  return (
    <>
      <Model name="building_home_A_red" snow position={[-7, 0, -9]} rotation-y={0.5} scale={4.5} />
      <Model name="building_home_B_green" snow position={[0.5, 0, -11]} scale={4.5} />
      <Model name="building_tavern_red" snow position={[8, 0, -9]} rotation-y={-0.6} scale={4} />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return <Model key={i} name="tree_single_A" snow position={[Math.cos(a) * 15, 0, Math.sin(a) * 15]} rotation-y={i} scale={3 + (i % 3)} />;
      })}
    </>
  );
}
