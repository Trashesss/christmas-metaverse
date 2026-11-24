import { KINDS, type Kind } from './items';

export const PLAZA_RADIUS = 30;
export const STATION_RANGE = 4;
export const GALLERY_RANGE = 5;
/** 눈싸움장. 이 안에 있는 사람끼리만 눈을 던지고 맞는다. */
export const ARENA = { x: 15.5, z: 15.5, r: 7 };
export const CHAT_RANGE = 12;
/** 전시대는 종류마다 이만큼씩 따로 둔다. */
export const MAX_EXHIBITS = 6;
export const SPEED = 5;
export const RUN_SPEED = 8;

type Point = { x: number; z: number };
const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (deg: number, r: number): Point => ({ x: Math.cos(rad(deg)) * r, z: Math.sin(rad(deg)) * r });
/** 가운데 트리를 바라보는 방향 */
export const facing = ({ x, z }: Point) => Math.atan2(-x, -z);

// 마을은 가운데 트리를 중심으로, 서쪽에 케이크 구역, 동쪽에 트리 구역, 남쪽에 입구가 있다.
export const SPAWN = { x: 0, z: 17 };
export const spawnPoint = (t = Math.random()) => {
  const a = t * Math.PI;
  return { x: SPAWN.x + Math.cos(a) * 3, z: SPAWN.z + Math.sin(a) * 3 };
};

export const STATIONS: Record<Kind, Point> = {
  cake: { x: -15.5, z: -4 },
  tree: { x: 15.5, z: -4 },
};
/** 케이크 진열장은 케이크 만드는 자리 바로 옆이다. */
export const GALLERY = { x: -15.5, z: 4 };

const ZONES: Record<Kind, Point & { from: number; to: number }> = {
  cake: { x: -16, z: 0, from: 125, to: 235 },
  tree: { x: 16, z: 0, from: -55, to: 55 },
};
const ZONE_RADIUS = 8.5;

/** 전시대: 만드는 자리를 감싸는 호를 따라 종류별로 배치하고 안쪽을 바라본다. 가운데에서 바깥으로 차례로 채운다. */
/** high: 이웃한 전시대와 이름표가 겹치지 않게 번갈아 높이 단다. */
export const EXHIBIT_SLOTS: Record<Kind, (Point & { ry: number; high: boolean })[]> = Object.fromEntries(
  KINDS.map((k) => {
    const { x: cx, z: cz, from, to } = ZONES[k];
    const middle = (MAX_EXHIBITS - 1) / 2;
    const slots = Array.from({ length: MAX_EXHIBITS }, (_, i) => i)
      .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))
      .map((i) => {
        const a = rad(from + ((to - from) * i) / (MAX_EXHIBITS - 1));
        const p = { x: cx + Math.cos(a) * ZONE_RADIUS, z: cz + Math.sin(a) * ZONE_RADIUS };
        return { ...p, ry: Math.atan2(cx - p.x, cz - p.z), high: i % 2 === 1 };
      });
    return [k, slots];
  }),
) as Record<Kind, (Point & { ry: number; high: boolean })[]>;

/** 활동을 시작할 때 두 사람이 서는 자리 */
export const workSpots = (kind: Kind): [Point, Point] => {
  const { x, z } = STATIONS[kind];
  return [
    { x: x - 2.3, z },
    { x: x + 2.3, z },
  ];
};

export type Spot = Kind | 'gallery';
const SPOTS: [Spot, Point, number][] = [
  ...KINDS.map((k): [Spot, Point, number] => [k, STATIONS[k], STATION_RANGE]),
  ['gallery', GALLERY, GALLERY_RANGE],
];
/** 범위 안의 가장 가까운 자리. 지금 자리는 조금 넉넉히 쳐서 경계에서 깜빡이지 않게 한다. */
export function nearestSpot(x: number, z: number, current: Spot | null = null): Spot | null {
  let found: Spot | null = null;
  let best = Infinity;
  for (const [spot, p, range] of SPOTS) {
    const d = Math.hypot(x - p.x, z - p.z) - (spot === current ? 0.8 : 0);
    if (d < range && d < best) [found, best] = [spot, d];
  }
  return found;
}

// 땅바닥: 눈 위에 깔린 돌길 터와 길, 얼음 연못
export interface Pad {
  x: number;
  z: number;
  r: number;
  /** 있으면 가운데가 비는 고리 */
  inner?: number;
  ice?: boolean;
}
export const PADS: Pad[] = [
  { x: 0, z: 0, r: 8.2, inner: 4.2 },
  { ...ZONES.cake, r: 10 },
  { ...ZONES.tree, r: 10 },
  { x: SPAWN.x, z: SPAWN.z, r: 4.2 },
  { x: 0, z: -20, r: 5 },
  { x: -10, z: -13, r: 4, ice: true },
  { x: 10, z: -13, r: 4 },
  { x: ARENA.x, z: ARENA.z, r: ARENA.r },
];
export const PATH_WIDTH = 3.2;
export const PATHS: [number, number][][] = [
  [[0, 17], [0, 8]],
  [[-8, 0], [-16, 0]],
  [[8, 0], [16, 0]],
  [[0, 17], [-9, 12], [-12, 8], [-11, 0]],
  [[0, 17], [9, 12], [12, 8], [11, 0]],
  [[0, -8], [0, -20]],
  [[0, -13.5], [-10, -13]],
  [[0, -13.5], [10, -13]],
  [[6, 6], [12, 12]],
  [[-6, 6], [-14, 14]],
];

// 건물: 집들은 길가에 서 있고, 바깥 고리는 걸어갈 수 없는 경계 너머 풍경이다.
export interface Building {
  model: string;
  x: number;
  z: number;
  scale: number;
}
/** 모델 크기의 절반(너비, 깊이). 모델 좌표 기준이라 scale을 곱해 쓴다. */
const HALF: Record<string, [number, number]> = {
  building_home_A_red: [0.4, 0.43],
  building_home_A_yellow: [0.4, 0.43],
  building_home_B_blue: [0.44, 0.55],
  building_home_B_green: [0.44, 0.55],
  building_market_yellow: [0.9, 0.66],
  building_tavern_red: [0.59, 0.67],
  building_church_blue: [0.51, 0.58],
};
export const BUILDING_HEIGHT: Record<string, number> = {
  building_home_A_red: 0.93,
  building_home_A_yellow: 0.93,
  building_home_B_blue: 1.28,
  building_home_B_green: 1.28,
  building_market_yellow: 0.98,
  building_tavern_red: 1.4,
  building_church_blue: 1.65,
};
const b = (model: string, deg: number, r: number, scale = 4.5): Building => ({ model, ...polar(deg, r), scale });
export const BUILDINGS: Building[] = [
  b('building_home_B_green', 72, 26),
  b('building_home_A_yellow', 108, 26),
  b('building_home_B_blue', 125, 23),
  b('building_home_A_red', 145, 25),
  b('building_tavern_red', 215, 24),
  b('building_home_B_green', 237, 24),
  b('building_home_A_yellow', 250, 26),
  b('building_church_blue', 270, 25.5, 5),
  b('building_home_B_blue', 290, 26),
  b('building_home_A_red', 303, 24),
  b('building_home_B_green', 325, 24),
];
const HOUSES = ['building_home_A_red', 'building_home_B_green', 'building_home_B_blue', 'building_home_A_yellow'];
/** 경계 바깥을 빙 두른 집들 */
export const BACKDROP: Building[] = Array.from({ length: 24 }, (_, i) =>
  b(i % 6 === 3 ? 'building_tavern_red' : HOUSES[i % HOUSES.length], i * 15 + (i % 2) * 4, 34 + (i % 3) * 0.6),
);

// 가로등: 같은 묶음끼리 꽃전구를 잇는다.
export const LAMP_CHAINS: { loop: boolean; points: Point[] }[] = [
  { loop: true, points: [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((d) => polar(d, 10.5)) },
  { loop: false, points: [{ x: -4.8, z: 11 }, { x: -4.8, z: 15.5 }] },
  { loop: false, points: [{ x: 4.8, z: 11 }, { x: 4.8, z: 15.5 }] },
];
/** 전시대 뒤편에서 구역을 비추는 가로등 */
const zoneLamps = (k: Kind, sign: number): Point[] => {
  const { x, z } = ZONES[k];
  return [158, 180, 202]
    .map((d) => (sign < 0 ? d : 180 - d))
    .map((d) => ({ x: x + Math.cos(rad(d)) * 10.4, z: z + Math.sin(rad(d)) * 10.4 }));
};
export const LAMPS: Point[] = [
  ...LAMP_CHAINS.flatMap((c) => c.points),
  ...zoneLamps('cake', -1),
  ...zoneLamps('tree', 1),
  { x: -4, z: -17 },
  { x: 4, z: -17 },
  { x: -7, z: -9.5 },
  { x: 7, z: -9.5 },
  { x: -12.5, z: 10.5 },
];

export const BENCHES: Point[] = [
  ...[45, 135, 225, 315].map((d) => polar(d, 7)),
  { x: -11, z: -3.6 },
  { x: 11, z: -3.6 },
  { x: -4, z: -19 },
  { x: 4, z: -19 },
  { x: -10, z: -8.2 },
  { x: -14, z: -13 },
  { x: 15, z: -10.5 },
];

/** c: 눈사람 몸 색 번호 */
export const SNOWMEN: (Point & { s: number; c: number })[] = [
  { x: -8, z: 16.5, s: 2.8, c: 0 },
  { x: 8, z: 16.5, s: 2.8, c: 1 },
  { x: 15.5, z: 4, s: 3.4, c: 0 },
  { x: 8.2, z: -14.8, s: 2.6, c: 2 },
  { x: 11.2, z: -11.2, s: 3.2, c: 0 },
  { x: 12.6, z: -14.4, s: 2.4, c: 1 },
  { x: 9.6, z: -17.2, s: 2.2, c: 2 },
];

// 충돌: 걸어서 닿을 수 있는 단단한 물건은 모두 원이다. h가 있으면 카메라도 비켜간다.
export interface Collider extends Point {
  r: number;
  h?: number;
  /** 같은 건물을 이루는 원끼리는 겹쳐도 된다. */
  group?: number;
}

/** 로컬 좌표(lx, lz)를 월드로. ry는 y축 회전 */
const local = (base: Point, ry: number, lx: number, lz: number): Point => ({
  x: base.x + lx * Math.cos(ry) + lz * Math.sin(ry),
  z: base.z - lx * Math.sin(ry) + lz * Math.cos(ry),
});

/** 건물 발자국을 긴 쪽으로 이어 붙인 원들로 덮는다. */
export function buildingColliders(bd: Building, group: number): Collider[] {
  const [w, d] = HALF[bd.model].map((v) => v * bd.scale);
  const r = Math.min(w, d) * 1.05;
  const alongZ = d >= w;
  const span = 2 * (Math.max(w, d) - Math.min(w, d));
  const n = Math.ceil(span / r) + 1;
  const ry = facing(bd);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
    const { x, z } = alongZ ? local(bd, ry, 0, t) : local(bd, ry, t, 0);
    return { x, z, r, h: BUILDING_HEIGHT[bd.model] * bd.scale, group };
  });
}

// 눈 요새: 눈덩이가 가장 높이 뜰 때(약 1.53)보다 높아 뒤에 숨으면 맞지 않는다. 카메라는 막지 않는다.
export const FORT_HEIGHT = 1.55;
export const FORTS: (Point & { ry: number })[] = [0, 1, 2, 3, 4].map((i) => {
  const a = rad(i * 72 + 45);
  return { x: ARENA.x + Math.cos(a) * 4, z: ARENA.z + Math.sin(a) * 4, ry: Math.PI / 2 - a };
});
export const FORTS_COLLIDERS: Collider[] = FORTS.flatMap((f, i) =>
  [-0.85, 0, 0.85].map((lx) => ({ ...local(f, f.ry, lx, 0), r: 0.5, group: 200 + i })),
);

const galleryColliders = (): Collider[] => {
  const ry = facing(GALLERY);
  return [
    ...[-1.3, -0.65, 0, 0.65, 1.3].map((lx) => ({ ...local(GALLERY, ry, lx, 1), r: 0.8, group: 100 })),
    ...[-0.9, 0.9].map((lx) => ({ ...local(GALLERY, ry, lx, -1), r: 1.3, h: 3.3, group: 100 })),
  ];
};

const FIXED: Collider[] = [
  { x: 0, z: 0, r: 2.6 },
  { ...STATIONS.cake, r: 1.7 },
  { ...STATIONS.tree, r: 1.5 },
  ...galleryColliders(),
  ...FORTS_COLLIDERS,
  ...BENCHES.map((p) => ({ ...p, r: 0.8 })),
  ...LAMPS.map((p) => ({ ...p, r: 0.3 })),
  ...SNOWMEN.map((p) => ({ x: p.x, z: p.z, r: 0.32 * p.s })),
  ...KINDS.flatMap((k) => EXHIBIT_SLOTS[k].map((s) => ({ x: s.x, z: s.z, r: 1.1 }))),
  ...[...BUILDINGS, ...BACKDROP].flatMap((bd, i) => buildingColliders(bd, i + 1)),
];

// 공원 나무: 시드가 고정된 난수로, 길과 터와 다른 물건을 피해 빈 곳에 심는다.
function distToSegment(px: number, pz: number, [ax, az]: number[], [bx, bz]: number[]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
const nearPath = (x: number, z: number, pad: number) =>
  PATHS.some((line) => line.slice(1).some((q, i) => distToSegment(x, z, line[i], q) < PATH_WIDTH / 2 + pad));

export interface Tree {
  model: string;
  x: number;
  z: number;
  scale: number;
  ry: number;
}
const treeRadius = (model: string, scale: number) => (model === 'tree_single_A' ? 0.26 : 0.55) * scale;
export const PARK_TREES: Tree[] = (() => {
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out: Tree[] = [];
  for (let tries = 0; tries < 8000 && out.length < 50; tries++) {
    const p = polar(rnd() * 360, 9 + rnd() * 19.5);
    const scale = 2.4 + rnd() * 1.6;
    const model = rnd() > 0.5 ? 'tree_single_A' : 'trees_A_medium';
    const r = treeRadius(model, scale);
    const clear = (c: Point & { r: number }) => Math.hypot(p.x - c.x, p.z - c.z) > c.r + r + 0.9;
    const onPad = PADS.some((pad) => Math.hypot(p.x - pad.x, p.z - pad.z) < pad.r + r + 1);
    // 남쪽 입구 뒤는 처음 보이는 시야라 비워 둔다.
    const entrance = Math.abs(p.x) < 8 && p.z > 10;
    if (onPad || entrance || nearPath(p.x, p.z, r + 0.8) || Math.hypot(p.x, p.z) + r + 1.5 > PLAZA_RADIUS) continue;
    if (!FIXED.every(clear) || !out.every((o) => clear({ x: o.x, z: o.z, r: treeRadius(o.model, o.scale) }))) continue;
    out.push({ model, ...p, scale, ry: rnd() * 6 });
  }
  return out;
})();

export const COLLIDERS: Collider[] = [
  ...FIXED,
  // 가는 나무는 잠깐 가릴 뿐이라 카메라를 막지 않는다.
  ...PARK_TREES.map((t) => ({ x: t.x, z: t.z, r: treeRadius(t.model, t.scale), ...(t.model !== 'tree_single_A' && { h: 3 + t.scale }) })),
];

export function resolveMove(x: number, z: number, radius = 0.45) {
  // 붙어 있는 원들 사이로 밀려 들어가지 않도록 몇 번 되풀이한다.
  for (let pass = 0; pass < 8; pass++) {
    for (const c of COLLIDERS) {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min) {
        const k = d > 1e-4 ? min / d : 0;
        x = c.x + (k ? dx * k : min);
        z = c.z + dz * k;
      }
    }
    ({ x, z } = clampToPlaza(x, z));
  }
  return { x, z };
}

export function clampToPlaza(x: number, z: number) {
  const d = Math.hypot(x, z);
  if (d <= PLAZA_RADIUS) return { x, z };
  return { x: (x / d) * PLAZA_RADIUS, z: (z / d) * PLAZA_RADIUS };
}
