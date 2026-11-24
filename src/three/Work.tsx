import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BASES, CAKE_TIERS, TREE_CONES, type Kind } from '../../shared/items';
import type { Stroke } from '../../shared/paint';
import type { Deco } from '../../shared/protocol';
import { CakePaint } from './CakePaint';
import { mergeDecos } from './itemGeometry';

const noRaycast = () => null;

export interface SurfaceHandlers {
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: () => void;
}

export function WorkBase({ kind, base, ...handlers }: { kind: Kind; base: number } & SurfaceHandlers) {
  const { color, accent } = BASES[kind][base];
  return kind === 'cake' ? (
    <group>
      {CAKE_TIERS.map((t) => (
        <group key={t.y} position-y={t.y}>
          <mesh position-y={t.h / 2} castShadow receiveShadow {...handlers}>
            <cylinderGeometry args={[t.r, t.r, t.h, 40]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
          <Drips r={t.r} y={t.h} color={accent} />
        </group>
      ))}
    </group>
  ) : (
    <group>
      <mesh position-y={0.25} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.5, 8]} />
        <meshStandardMaterial color="#7a4e30" flatShading />
      </mesh>
      {TREE_CONES.map((c) => (
        <group key={c.y} position-y={c.y}>
          <mesh position-y={c.h / 2} castShadow receiveShadow {...handlers}>
            <coneGeometry args={[c.r, c.h, 12]} />
            <meshStandardMaterial color={color} flatShading roughness={0.9} />
          </mesh>
          <SnowRim r={c.r} color={accent} />
        </group>
      ))}
    </group>
  );
}

function Ring({ count, geometry, color, at }: { count: number; geometry: React.ReactNode; color: string; at: (i: number, m: THREE.Object3D) => void }) {
  const ref = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      at(i, o);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} raycast={noRaycast} castShadow>
      {geometry}
      <meshStandardMaterial color={color} roughness={0.7} />
    </instancedMesh>
  );
}

function Drips({ r, y, color }: { r: number; y: number; color: string }) {
  const count = Math.round(r * 24);
  return (
    <Ring
      count={count}
      color={color}
      geometry={<sphereGeometry args={[0.12, 12, 8]} />}
      at={(i, o) => {
        const a = (i / count) * Math.PI * 2;
        o.position.set(Math.cos(a) * r, y - 0.06, Math.sin(a) * r);
        o.scale.set(1.15, 0.8 + ((i * 2) % 3) * 0.3, 0.75);
        o.rotation.y = Math.PI / 2 - a;
      }}
    />
  );
}

function SnowRim({ r, color }: { r: number; color: string }) {
  const count = Math.round(r * 12);
  return (
    <Ring
      count={count}
      color={color}
      geometry={<icosahedronGeometry args={[0.12, 0]} />}
      at={(i, o) => {
        const a = (i / count) * Math.PI * 2;
        o.position.set(Math.cos(a) * (r - 0.06), 0.02, Math.sin(a) * (r - 0.06));
        o.scale.set(1, 0.6 + (i % 2) * 0.35, 1);
      }}
    />
  );
}

export function FinishedWork({ kind, base, decos, strokes, resolution }: { kind: Kind; base: number; decos: Deco[]; strokes: Stroke[]; resolution?: number }) {
  const geometry = useMemo(() => mergeDecos(kind, decos), [kind, decos]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return (
    <>
      <WorkBase kind={kind} base={base} />
      {kind === 'cake' && <CakePaint strokes={strokes} resolution={resolution} />}
      {geometry && (
        <mesh geometry={geometry} castShadow>
          <meshStandardMaterial vertexColors roughness={0.5} />
        </mesh>
      )}
    </>
  );
}
