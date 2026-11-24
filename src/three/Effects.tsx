import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
const dot = dotTexture();

/** follow를 주면 카메라가 보는 쪽 area 안에서만 내려 넓은 맵에서도 눈 수가 늘지 않는다. */
export function Snow({ count = 700, area = 44, height = 16, follow = false }) {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a.set([(Math.random() - 0.5) * area, Math.random() * height, (Math.random() - 0.5) * area], i * 3);
    }
    return a;
  }, [count, area, height]);
  useFrame(({ clock, camera }, dt) => {
    const attr = ref.current?.geometry.attributes.position;
    if (!attr) return;
    const a = attr.array as Float32Array;
    const t = clock.elapsedTime;
    const step = Math.min(dt, 0.1);
    // 카메라 앞쪽 10m를 중심으로 삼아 보이는 곳에 눈이 몰리게 한다.
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const cx = camera.position.x + forward.x * 10;
    const cz = camera.position.z + forward.z * 10;
    const half = area / 2;
    for (let i = 0; i < count; i++) {
      a[i * 3] += Math.sin(t + i) * step * 0.3;
      a[i * 3 + 1] -= step * (0.8 + (i % 5) * 0.15);
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] = height;
      if (follow) {
        // 중심에서 멀어진 눈은 반대편으로 되돌려 영역 안에 머물게 한다.
        a[i * 3] = cx + THREE.MathUtils.euclideanModulo(a[i * 3] - cx + half, area) - half;
        a[i * 3 + 2] = cz + THREE.MathUtils.euclideanModulo(a[i * 3 + 2] - cz + half, area) - half;
      }
    }
    attr.needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data, 3]} />
      </bufferGeometry>
      <pointsMaterial map={dot} size={0.2} transparent depthWrite={false} color="#ffffff" opacity={0.9} />
    </points>
  );
}

export function Glow({ position, color = '#ffb75e', size = 2, onTop = false }: { position: [number, number, number]; color?: string; size?: number; onTop?: boolean }) {
  return (
    <sprite position={position} scale={size} raycast={() => null}>
      <spriteMaterial map={dot} color={color} transparent opacity={0.4} depthWrite={false} depthTest={!onTop} fog={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

/** 여러 군데의 빛무리를 한 번에 그린다. */
export function Glows({ points, size = 2, color = '#ffb75e' }: { points: THREE.Vector3[]; size?: number; color?: string }) {
  const positions = useMemo(() => new Float32Array(points.flatMap((p) => p.toArray())), [points]);
  return (
    <points frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={dot} size={size} color={color} transparent opacity={0.4} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

const BULB_COLORS = ['#ff6b5e', '#ffd166', '#6ee7a8', '#7cc4ff', '#ff9ecb'].map((c) => new THREE.Color(c));

/** 점들을 전구로 그린다. 전체가 한 번의 드로우콜이다. */
export function Bulbs({ points, size = 0.09 }: { points: THREE.Vector3[]; size?: number }) {
  const ref = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const m = new THREE.Matrix4();
    points.forEach((p, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(p));
      mesh.setColorAt(i, BULB_COLORS[i % BULB_COLORS.length]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
  };
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} raycast={() => null}>
      <sphereGeometry args={[size, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
