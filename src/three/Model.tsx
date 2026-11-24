import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

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
  const { scene } = useGLTF(modelUrl(name));
  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      if (snow) o.material = withSnow(o.material as THREE.Material);
    });
    return copy;
  }, [scene, snow]);
  return (
    <group {...props}>
      <primitive object={object} />
    </group>
  );
}
