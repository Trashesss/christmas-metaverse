import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { ballAt, stopped } from '../../shared/snowball';
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
