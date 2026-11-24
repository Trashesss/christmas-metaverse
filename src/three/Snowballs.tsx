import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { ballAt, stopped } from '../../shared/snowball';
import { ARENA, FORTS, FORT_HEIGHT } from '../../shared/world';
import { MAX_SPLATS, balls, splats } from '../snow';

const MAX_BALLS = 60;
const PIECES = 8;
const SPLAT_SECONDS = 0.55;
const dummy = new THREE.Object3D();

/** 날아가는 눈덩이와 부서진 눈가루 */
export function Snowballs() {
  const ballMesh = useRef<THREE.InstancedMesh>(null);
  const pieceMesh = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const now = performance.now();
    const b = ballMesh.current;
    const s = pieceMesh.current;
    if (!b || !s) return;
    let n = 0;
    for (const [id, ball] of balls) {
      const p = ballAt(ball, (now - ball.at) / 1000);
      // 서버 소식이 늦어도 바닥을 뚫고 가지 않는다.
      if (stopped(p)) {
        if (now - ball.at > 3000) balls.delete(id);
        continue;
      }
      if (n >= MAX_BALLS) break;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.17);
      dummy.updateMatrix();
      b.setMatrixAt(n++, dummy.matrix);
    }
    b.count = n;
    b.instanceMatrix.needsUpdate = true;

    while (splats.length && now - splats[0].at > SPLAT_SECONDS * 1000) splats.shift();
    n = 0;
    for (const sp of splats.slice(-MAX_SPLATS)) {
      const t = (now - sp.at) / 1000;
      for (let i = 0; i < PIECES; i++) {
        const a = (i / PIECES) * Math.PI * 2 + sp.at;
        const v = 1.2 + (i % 3) * 0.6;
        dummy.position.set(sp.x + Math.cos(a) * v * t, Math.max(0.03, sp.y + (1.4 + (i % 2)) * t - 5 * t * t), sp.z + Math.sin(a) * v * t);
        dummy.scale.setScalar(0.09 * (1 - t / SPLAT_SECONDS));
        dummy.updateMatrix();
        s.setMatrixAt(n++, dummy.matrix);
      }
    }
    s.count = n;
    s.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={ballMesh} args={[undefined, undefined, MAX_BALLS]} frustumCulled={false} castShadow raycast={() => null}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </instancedMesh>
      <instancedMesh ref={pieceMesh} args={[undefined, undefined, MAX_SPLATS * PIECES]} frustumCulled={false} raycast={() => null}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </instancedMesh>
    </>
  );
}

const BLOCKS = FORTS.flatMap((f) =>
  [0, 1].flatMap((row) =>
    (row ? [-0.45, 0.45] : [-0.9, 0, 0.9]).map((lx) => ({
      x: f.x + lx * Math.cos(f.ry),
      y: FORT_HEIGHT * (0.25 + row * 0.5),
      z: f.z - lx * Math.sin(f.ry),
      ry: f.ry,
    })),
  ),
);
const RIM = Array.from({ length: 44 }, (_, i) => {
  const a = (i / 44) * Math.PI * 2;
  return { x: ARENA.x + Math.cos(a) * ARENA.r, z: ARENA.z + Math.sin(a) * ARENA.r, s: 0.16 + (i % 3) * 0.05 };
});

function fill(count: number, set: (i: number, o: THREE.Object3D) => void) {
  return (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      set(i, o);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  };
}
const fillBlocks = fill(BLOCKS.length, (i, o) => {
  const b = BLOCKS[i];
  o.position.set(b.x, b.y, b.z);
  o.rotation.y = b.ry;
});
const fillRim = fill(RIM.length, (i, o) => {
  const r = RIM[i];
  o.position.set(r.x, 0.03, r.z);
  o.scale.set(r.s, r.s * 0.8, r.s);
});

/** 눈싸움장: 다져진 눈밭, 낮은 눈 둔덕 경계, 숨을 수 있는 눈 요새 */
export function Arena() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[ARENA.x, 0.03, ARENA.z]} receiveShadow raycast={() => null}>
        <circleGeometry args={[ARENA.r, 48]} />
        <meshStandardMaterial color="#eef5ff" roughness={1} />
      </mesh>
      <instancedMesh ref={fillRim} args={[undefined, undefined, RIM.length]} raycast={() => null}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </instancedMesh>
      <instancedMesh ref={fillBlocks} args={[undefined, undefined, BLOCKS.length]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[0.86, FORT_HEIGHT / 2 - 0.03, 0.75]} />
        <meshStandardMaterial color="#d8e8fb" flatShading />
      </instancedMesh>
      <Html center position={[ARENA.x, 3, ARENA.z]} zIndexRange={[5, 0]} className="tag" pointerEvents="none">
        <div className="sign">☃️ 눈싸움장</div>
      </Html>
    </>
  );
}
