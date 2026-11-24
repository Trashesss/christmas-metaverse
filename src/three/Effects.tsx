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

export function Snow({ count = 700, area = 44, height = 16 }) {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a.set([(Math.random() - 0.5) * area, Math.random() * height, (Math.random() - 0.5) * area], i * 3);
    }
    return a;
  }, [count, area, height]);
  useFrame(({ clock }, dt) => {
    const attr = ref.current?.geometry.attributes.position;
    if (!attr) return;
    const a = attr.array as Float32Array;
    const t = clock.elapsedTime;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      a[i * 3] += Math.sin(t + i) * step * 0.3;
      a[i * 3 + 1] -= step * (0.8 + (i % 5) * 0.15);
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] = height;
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
