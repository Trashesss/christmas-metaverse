import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, findItem, type Kind } from '../../shared/items';
import type { Deco } from '../../shared/protocol';

type P3 = [number, number, number];

/** 색을 정점에 구워 두면 장식 하나가 메시 하나, 전시 작품 전체도 메시 하나가 된다. */
function part(geo: THREE.BufferGeometry, color: string, pos: P3 = [0, 0, 0], rot: P3 = [0, 0, 0], scale: P3 = [1, 1, 1], glow = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale),
    ),
  );
  const c = new THREE.Color(color).multiplyScalar(glow);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

const sphere = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cyl = (a: number, b: number, h: number, n = 10) => new THREE.CylinderGeometry(a, b, h, n);
const cone = (r: number, h: number, n = 10) => new THREE.ConeGeometry(r, h, n);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

function starGeometry(r: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 + Math.PI / 2;
    const d = i % 2 ? r * 0.48 : r;
    shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * d, Math.sin(a) * d);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: r * 0.3, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
}

function cane(color: string) {
  const parts: THREE.BufferGeometry[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const c = i % 2 ? '#fff8f0' : color;
    if (i < 8) parts.push(part(cyl(0.045, 0.045, 0.045, 8), c, [0, 0.022 + i * 0.045, 0]));
    else {
      const a = ((i - 8 + 0.5) / 6) * Math.PI;
      parts.push(part(cyl(0.045, 0.045, 0.065, 8), c, [0.11 - Math.cos(a) * 0.11, 0.36 + Math.sin(a) * 0.11, 0], [0, 0, -a]));
    }
  }
  return parts;
}

/** 모든 장식은 원점이 접점이고 +Y가 위쪽이다. */
const BUILD: Record<string, (color: string) => THREE.BufferGeometry[]> = {
  strawberry: () => [
    part(cone(0.15, 0.28), '#e0343f', [0, 0.14, 0]),
    part(sphere(0.15), '#e0343f', [0, 0.05, 0], [0, 0, 0], [1, 0.6, 1]),
    part(cone(0.1, 0.05, 5), '#58a945', [0, 0.28, 0]),
  ],
  cream: (c) => [
    part(sphere(0.17), c, [0, 0.06, 0], [0, 0, 0], [1, 0.6, 1]),
    part(sphere(0.125), c, [0, 0.15, 0], [0, 0, 0], [1, 0.65, 1]),
    part(cone(0.085, 0.18), c, [0, 0.27, 0]),
  ],
  candle: (c) => [
    part(cyl(0.055, 0.055, 0.42), c, [0, 0.21, 0]),
    part(cyl(0.058, 0.058, 0.05), '#fff8f0', [0, 0.14, 0]),
    part(cyl(0.058, 0.058, 0.05), '#fff8f0', [0, 0.3, 0]),
    part(cyl(0.01, 0.01, 0.06, 5), '#40302a', [0, 0.45, 0]),
    part(sphere(0.06, 8, 6), '#ffb43b', [0, 0.53, 0], [0, 0, 0], [0.8, 1.5, 0.8], 3),
  ],
  cookie: () => [
    part(sphere(0.12), '#b87338', [0, 0.44, 0], [0, 0, 0], [1, 1, 0.45]),
    part(sphere(0.13), '#b87338', [0, 0.24, 0], [0, 0, 0], [1, 1.2, 0.42]),
    part(cyl(0.055, 0.055, 0.36), '#b87338', [0, 0.28, 0], [0, 0, Math.PI / 2]),
    part(cyl(0.06, 0.06, 0.2), '#b87338', [-0.08, 0.1, 0], [0, 0, -0.35]),
    part(cyl(0.06, 0.06, 0.2), '#b87338', [0.08, 0.1, 0], [0, 0, 0.35]),
    ...[0.2, 0.3].map((y) => part(sphere(0.024, 6, 5), '#e5484d', [0, y, 0.06])),
    ...[-0.045, 0.045].map((x) => part(sphere(0.018, 6, 5), '#fff8f0', [x, 0.46, 0.05])),
  ],
  snowman: (c) => [
    part(sphere(0.17), '#ffffff', [0, 0.14, 0]),
    part(sphere(0.12), '#ffffff', [0, 0.38, 0]),
    part(new THREE.TorusGeometry(0.1, 0.035, 6, 12), c, [0, 0.29, 0], [Math.PI / 2, 0, 0]),
    part(cone(0.025, 0.12, 6), '#f08a3c', [0, 0.38, 0.15], [Math.PI / 2, 0, 0]),
    ...[-0.045, 0.045].map((x) => part(sphere(0.017, 6, 5), '#2b2b33', [x, 0.42, 0.105])),
    part(cyl(0.08, 0.08, 0.1), '#2b2b33', [0, 0.53, 0]),
    part(cyl(0.12, 0.12, 0.02), '#2b2b33', [0, 0.48, 0]),
  ],
  cane,
  choco: (c) => [part(sphere(0.1), c, [0, 0.07, 0])],
  minitree: () => [
    part(cyl(0.04, 0.05, 0.1), '#7a4e30', [0, 0.05, 0]),
    part(cone(0.2, 0.28, 8), '#2f7d55', [0, 0.22, 0]),
    part(cone(0.15, 0.24, 8), '#358a5f', [0, 0.37, 0]),
    part(cone(0.1, 0.2, 8), '#f2f8ff', [0, 0.51, 0]),
  ],
  ball: (c) => [
    part(sphere(0.13, 14, 10), c, [0, -0.1, 0]),
    part(cyl(0.035, 0.035, 0.05, 8), '#f5cf6b', [0, 0.04, 0]),
  ],
  bulb: (c) => [
    part(sphere(0.085, 10, 8), c, [0, -0.07, 0], [0, 0, 0], [1, 1.3, 1], 2.6),
    part(cyl(0.04, 0.04, 0.06, 8), '#33503f', [0, 0.05, 0]),
  ],
  bell: () => [
    part(sphere(0.1), '#f5c04a', [0, 0, 0]),
    part(cyl(0.1, 0.16, 0.16, 12), '#f5c04a', [0, -0.08, 0]),
    part(sphere(0.045, 8, 6), '#b9822b', [0, -0.18, 0]),
  ],
  ribbon: (c) => [
    part(sphere(0.12), c, [-0.12, 0, 0], [0, 0, 0.35], [1, 0.65, 0.4]),
    part(sphere(0.12), c, [0.12, 0, 0], [0, 0, -0.35], [1, 0.65, 0.4]),
    part(sphere(0.06), c, [0, 0, 0.03]),
    part(box(0.07, 0.24, 0.03), c, [-0.07, -0.14, 0], [0, 0, -0.4]),
    part(box(0.07, 0.24, 0.03), c, [0.07, -0.14, 0], [0, 0, 0.4]),
  ],
  gift: (c) => [
    part(box(0.24, 0.2, 0.24), c, [0, 0, 0]),
    part(box(0.25, 0.205, 0.05), '#fff3d6', [0, 0, 0]),
    part(box(0.05, 0.205, 0.25), '#fff3d6', [0, 0, 0]),
    part(sphere(0.05), '#fff3d6', [-0.05, 0.13, 0]),
    part(sphere(0.05), '#fff3d6', [0.05, 0.13, 0]),
  ],
  star: (c) => [part(starGeometry(0.34), c, [0, 0.2, -0.05], [0, 0, 0], [1, 1, 1], 1.8)],
};

const cache = new Map<string, THREE.BufferGeometry>();

export function itemGeometry(item: string, color: number) {
  const key = `${item}:${color}`;
  let g = cache.get(key);
  if (!g) {
    g = mergeGeometries(BUILD[item](COLORS[color]))!;
    cache.set(key, g);
  }
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

export function decoTransform(kind: Kind, d: Pick<Deco, 'item' | 'p' | 'n'>) {
  const mount = findItem(kind, d.item)!.mount;
  const n = new THREE.Vector3(...d.n);
  const position = new THREE.Vector3(...d.p);
  const quaternion = new THREE.Quaternion();
  if (mount === 'normal') quaternion.setFromUnitVectors(UP, n);
  if (mount === 'hang') {
    quaternion.setFromAxisAngle(UP, Math.atan2(n.x, n.z));
    position.addScaledVector(n, 0.1);
  }
  return { position, quaternion };
}

export function mergeDecos(kind: Kind, decos: Deco[]) {
  if (!decos.length) return null;
  const one = new THREE.Vector3(1, 1, 1);
  return mergeGeometries(
    decos.map((d) => {
      const { position, quaternion } = decoTransform(kind, d);
      return itemGeometry(d.item, d.color).clone().applyMatrix4(new THREE.Matrix4().compose(position, quaternion, one));
    }),
  );
}
