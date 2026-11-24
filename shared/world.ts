import type { Kind } from './items';

export const PLAZA_RADIUS = 19;
export const STATION_RANGE = 4;
export const GALLERY = { x: 10.5, z: 11 };
export const GALLERY_RANGE = 5;
export const CHAT_RANGE = 12;
export const MAX_EXHIBITS = 6;

export const STATIONS: Record<Kind, { x: number; z: number }> = {
  cake: { x: -8, z: 3 },
  tree: { x: 8, z: 3 },
};

/** 전시대: 광장 북쪽 호를 따라 배치 */
export const EXHIBIT_SLOTS = Array.from({ length: MAX_EXHIBITS }, (_, i) => {
  const a = Math.PI * (1.18 + (0.64 * i) / (MAX_EXHIBITS - 1));
  return { x: Math.cos(a) * 12, z: Math.sin(a) * 12 };
});

export interface Building {
  model: string;
  angle: number;
  r: number;
  scale: number;
}
const b = (model: string, deg: number, r = 21.5, scale = 4.5): Building => ({
  model,
  angle: (deg * Math.PI) / 180,
  r,
  scale,
});
export const BUILDINGS: Building[] = [
  b('building_home_A_red', 5),
  b('building_home_B_green', 30),
  b('building_market_yellow', 55, 20.5, 3.4),
  b('building_home_B_blue', 125),
  b('building_home_A_yellow', 150),
  b('building_tavern_red', 178),
  b('building_home_B_green', 205),
  b('building_home_A_red', 230),
  b('building_church_blue', 270, 22.5, 5),
  b('building_home_A_yellow', 310),
  b('building_home_B_blue', 335),
];

export const BENCHES = [45, 135, 225, 315].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a) * 7.4, z: Math.sin(a) * 7.4 };
});

export const COLLIDERS = [
  { x: 0, z: 0, r: 2.6 },
  { x: STATIONS.cake.x, z: STATIONS.cake.z, r: 1.7 },
  { x: STATIONS.tree.x, z: STATIONS.tree.z, r: 1.5 },
  { ...GALLERY, r: 2.2 },
  ...BENCHES.map((s) => ({ ...s, r: 0.8 })),
  ...EXHIBIT_SLOTS.map((s) => ({ ...s, r: 1.1 })),
];

export function resolveMove(x: number, z: number, radius = 0.45) {
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
  return clampToPlaza(x, z);
}

export function clampToPlaza(x: number, z: number) {
  const d = Math.hypot(x, z);
  if (d <= PLAZA_RADIUS) return { x, z };
  return { x: (x / d) * PLAZA_RADIUS, z: (z / d) * PLAZA_RADIUS };
}
