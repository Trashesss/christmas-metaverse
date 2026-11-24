import type { ThreeElements } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { LoadBoundary, useModel } from './LoadBoundary';

const FOLDER: Record<string, string> = {
  table_round_A: 'restaurant-bits',
  bench: 'halloween-bits',
  post_lantern: 'halloween-bits',
};
export const modelUrl = (name: string) => `/assets/${FOLDER[name] ?? 'medieval-hexagon-pack'}/${name}.gltf`;

const snowy = new Map<THREE.Material, THREE.Material>();

/** 위를 향한 면을 하얗게 칠해 일반 에셋을 눈 덮인 모습으로 바꾼다. */
function withSnow(source: THREE.Material) {
  let mat = snowy.get(source);
  if (mat) return mat;
  mat = source.clone();
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowNormal;')
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvSnowNormal = mat3(modelMatrix) * objectNormal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowNormal;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), smoothstep(0.35, 0.6, normalize(vSnowNormal).y));',
      );
  };
  snowy.set(source, mat);
  return mat;
}

export function Model({ name, snow = false, ...props }: { name: string; snow?: boolean } & ThreeElements['group']) {
  const url = modelUrl(name);
  return (
    <group {...props}>
      <LoadBoundary urls={[url]} fallback={null}>
        <Loaded url={url} snow={snow} />
      </LoadBoundary>
    </group>
  );
}

function Loaded({ url, snow }: { url: string; snow: boolean }) {
  const { scene } = useModel(url);
  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      if (snow) o.material = withSnow(o.material as THREE.Material);
    });
    return copy;
  }, [scene, snow]);
  return <primitive object={object} />;
}

export interface Placement {
  x: number;
  z: number;
  ry?: number;
  s?: number;
}

/** 같은 모델을 여러 곳에 놓는다. 인스턴싱이라 모델의 메시 수만큼만 그린다. at은 바뀌지 않는 배열이어야 한다. 멀리서 보이는 것은 shadow를 꺼 그림자 패스를 아낀다. */
export function Instances({ name, snow = false, shadow = true, at }: { name: string; snow?: boolean; shadow?: boolean; at: Placement[] }) {
  const url = modelUrl(name);
  return (
    <LoadBoundary urls={[url]} fallback={null}>
      <LoadedInstances url={url} snow={snow} shadow={shadow} at={at} />
    </LoadBoundary>
  );
}

function LoadedInstances({ url, snow, shadow, at }: { url: string; snow: boolean; shadow: boolean; at: Placement[] }) {
  const { scene } = useModel(url);
  const group = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out = new THREE.Group();
    const up = new THREE.Vector3(0, 1, 0);
    const place = new THREE.Matrix4();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(o.geometry, snow ? withSnow(o.material as THREE.Material) : o.material, at.length);
      at.forEach(({ x, z, ry = 0, s = 1 }, i) => {
        place.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(up, ry), new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(i, place.multiply(o.matrixWorld));
      });
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.raycast = () => null;
      out.add(mesh);
    });
    return out;
  }, [scene, snow, shadow, at]);
  // primitive는 정리되지 않으므로 인스턴스 버퍼만 직접 비운다. 도형과 재질은 캐시가 계속 쓴다.
  useEffect(() => () => group.children.forEach((m) => (m as THREE.InstancedMesh).dispose()), [group]);
  return <primitive object={group} />;
}
