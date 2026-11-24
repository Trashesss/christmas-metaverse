import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BACKDROP, BENCHES, BUILDINGS, LAMPS, LAMP_CHAINS, PADS, PARK_TREES, PATHS, PATH_WIDTH, SNOWMEN, facing } from '../../shared/world';
import { Bulbs, Glows } from './Effects';
import { itemGeometry } from './itemGeometry';
import { Instances, modelUrl, type Placement } from './Model';

const MODELS = [...new Set([...BUILDINGS, ...BACKDROP].map((b) => b.model)), 'tree_single_A', 'trees_A_medium', 'post_lantern', 'bench'];
MODELS.forEach((m) => useGLTF.preload(modelUrl(m)));

/** 모델마다 놓을 자리들을 한 번만 묶어 인스턴스 배열이 바뀌지 않게 한다. */
function byModel<T extends { model: string }>(items: T[], place: (t: T) => Placement) {
  const out = new Map<string, Placement[]>();
  for (const t of items) out.set(t.model, [...(out.get(t.model) ?? []), place(t)]);
  return [...out];
}
const houses = byModel([...BUILDINGS, ...BACKDROP], (b) => ({ x: b.x, z: b.z, ry: facing(b), s: b.scale }));
const parkTrees = byModel(PARK_TREES, (t) => ({ x: t.x, z: t.z, ry: t.ry, s: t.scale }));
const lamps = LAMPS.map((l) => ({ x: l.x, z: l.z, ry: facing(l) }));
const benches = BENCHES.map((b) => ({ x: b.x, z: b.z, ry: facing(b) }));
const glowPoints = lamps.map((l) => new THREE.Vector3(l.x + Math.sin(l.ry), 2.4, l.z + Math.cos(l.ry)));

// 시드가 고정된 난수라 모두에게 같은 숲이 보인다. 걸을 수 없는 경계 바깥이라 충돌은 없다.
function forest() {
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const trees = Array.from({ length: 150 }, (_, i) => {
    const a = (i / 150) * Math.PI * 2 + rnd() * 0.05;
    const r = 39.5 + rnd() * 22;
    return {
      model: rnd() > 0.5 ? 'tree_single_A' : 'trees_A_medium',
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      s: 2.6 + rnd() * 1.8,
      ry: rnd() * 6,
    };
  });
  return byModel(trees, (t) => ({ x: t.x, z: t.z, ry: t.ry, s: t.s }));
}
const forestTrees = forest();

const snowmen = [0, 1, 2].map((c) => ({
  c,
  at: SNOWMEN.filter((m) => m.c === c).map((m) => ({ x: m.x, z: m.z, ry: facing(m), s: m.s })),
}));

/** 길은 한 장의 메시로 합쳐 한 번에 그린다. */
function pathGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const at = (x: number, z: number, ry: number) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, 0.02, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
  for (const line of PATHS) {
    line.forEach(([x, z], i) => {
      parts.push(new THREE.CircleGeometry(PATH_WIDTH / 2, 24).rotateX(-Math.PI / 2).applyMatrix4(at(x, z, 0)));
      if (!i) return;
      const [px, pz] = line[i - 1];
      const len = Math.hypot(x - px, z - pz);
      parts.push(new THREE.PlaneGeometry(PATH_WIDTH, len).rotateX(-Math.PI / 2).applyMatrix4(at((x + px) / 2, (z + pz) / 2, Math.atan2(x - px, z - pz))));
    });
  }
  return mergeGeometries(parts)!;
}

/** 길과 터가 겹쳐도 경계가 보이지 않게 같은 색을 쓴다. */
const STONE = '#cdbda9';

const paths = pathGeometry();

export function Ground() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[130, 48]} />
        <meshStandardMaterial color="#dfe9f8" roughness={1} />
      </mesh>
      {PADS.map((p, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[p.x, p.ice ? 0.025 : 0.012, p.z]} receiveShadow>
          {p.inner ? <ringGeometry args={[p.inner, p.r, 48]} /> : <circleGeometry args={[p.r, 48]} />}
          <meshStandardMaterial color={p.ice ? '#b9dcef' : STONE} roughness={p.ice ? 0.25 : 1} />
        </mesh>
      ))}
      <mesh geometry={paths} receiveShadow>
        <meshStandardMaterial color={STONE} roughness={1} />
      </mesh>
    </>
  );
}

const garland = LAMP_CHAINS.flatMap(({ loop, points }) => {
  const out: THREE.Vector3[] = [];
  const spans = loop ? points.length : points.length - 1;
  for (let i = 0; i < spans; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let k = 0; k < 14; k++) {
      const t = k / 14;
      out.push(new THREE.Vector3(a.x + (b.x - a.x) * t, 3.3 - Math.sin(t * Math.PI) * 0.8, a.z + (b.z - a.z) * t));
    }
  }
  return out;
});

const MOUNTAINS = Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2;
  const h = 18 + ((i * 7) % 5) * 3;
  return { x: Math.cos(a) * 82, z: Math.sin(a) * 82, h, r: 17 + (i % 3) * 3, ry: i };
});

function Mountains() {
  const ref = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const o = new THREE.Object3D();
    MOUNTAINS.forEach((m, i) => {
      o.position.set(m.x, m.h / 2 - 2, m.z);
      o.rotation.y = m.ry;
      o.scale.set(m.r, m.h, m.r);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.frustumCulled = false;
  };
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MOUNTAINS.length]} raycast={() => null}>
      <coneGeometry args={[1, 1, 6]} />
      <meshStandardMaterial color="#c3d2ee" flatShading />
    </instancedMesh>
  );
}

function Snowmen({ color, at }: { color: number; at: Placement[] }) {
  const ref = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const o = new THREE.Object3D();
    at.forEach(({ x, z, ry = 0, s = 1 }, i) => {
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      o.scale.setScalar(s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.frustumCulled = false;
  };
  return (
    <instancedMesh ref={ref} args={[itemGeometry('snowman', color), undefined, at.length]} castShadow raycast={() => null}>
      <meshStandardMaterial vertexColors />
    </instancedMesh>
  );
}

export function Village() {
  return (
    <>
      <Mountains />
      {houses.map(([name, at]) => (
        <Instances key={name} name={name} snow at={at} />
      ))}
      {parkTrees.map(([name, at]) => (
        <Instances key={name} name={name} snow at={at} />
      ))}
      {forestTrees.map(([name, at]) => (
        <Instances key={`forest${name}`} name={name} snow shadow={false} at={at} />
      ))}
      <Instances name="post_lantern" at={lamps} />
      <Glows points={glowPoints} />
      <Bulbs points={garland} />
      <Instances name="bench" at={benches} />
      {snowmen.map(({ c, at }) => (
        <Snowmen key={c} color={c} at={at} />
      ))}
    </>
  );
}
