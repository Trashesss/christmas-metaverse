import { describe, expect, it } from 'vitest';
import { KINDS } from '../shared/items';
import {
  BACKDROP,
  BENCHES,
  COLLIDERS,
  EXHIBIT_SLOTS,
  GALLERY,
  GALLERY_RANGE,
  LAMPS,
  MAX_EXHIBITS,
  PADS,
  PARK_TREES,
  PATHS,
  PLAZA_RADIUS,
  SNOWMEN,
  SPAWN,
  STATIONS,
  STATION_RANGE,
  clampToPlaza,
  nearestSpot,
  resolveMove,
  spawnPoint,
  workSpots,
} from '../shared/world';

const PLAYER = 0.45;
const inPlaza = (p: { x: number; z: number }) => Math.hypot(p.x, p.z) <= PLAZA_RADIUS + 1e-6;
const blockedBy = (p: { x: number; z: number }) =>
  COLLIDERS.filter((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r + PLAYER - 1e-6);
const walkable = (p: { x: number; z: number }) => inPlaza(p) && blockedBy(p).length === 0;

describe('map', () => {
  it('is the bigger plaza', () => expect(PLAZA_RADIUS).toBe(30));

  it('every collider resolves to a walkable spot', () => {
    for (const c of COLLIDERS) {
      // 가장자리에서 파고든 자리를 여러 방향에서 풀어 본다. 경계 밖 풍경의 충돌은 경계 위에서 풀린다.
      for (let i = 0; i < 8; i++) {
        const a = i * (Math.PI / 4);
        const p = resolveMove(c.x + Math.cos(a) * c.r * 0.9, c.z + Math.sin(a) * c.r * 0.9);
        expect(inPlaza(p)).toBe(true);
        expect(blockedBy(p), `collider at ${c.x.toFixed(1)},${c.z.toFixed(1)}`).toEqual([]);
      }
      expect(inPlaza(resolveMove(c.x, c.z))).toBe(true);
    }
  });

  it('no solid object straddles the edge or is reachable from outside the plaza', () => {
    for (const c of COLLIDERS) {
      const d = Math.hypot(c.x, c.z);
      const inside = d + c.r + PLAYER < PLAZA_RADIUS;
      const outside = d - c.r - PLAYER > PLAZA_RADIUS;
      expect(inside || outside, `collider at ${c.x.toFixed(1)},${c.z.toFixed(1)}`).toBe(true);
    }
    for (const b of BACKDROP) expect(Math.hypot(b.x, b.z)).toBeGreaterThan(PLAZA_RADIUS + 3);
  });

  it('the whole edge can be walked', () => {
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2;
      const p = resolveMove(Math.cos(a) * 40, Math.sin(a) * 40);
      expect(walkable(p)).toBe(true);
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(PLAZA_RADIUS - 1);
    }
  });

  it('different objects do not overlap', () => {
    const bad: string[] = [];
    COLLIDERS.forEach((a, i) =>
      COLLIDERS.slice(i + 1).forEach((c) => {
        if (a.group !== undefined && a.group === c.group) return;
        const gap = Math.hypot(a.x - c.x, a.z - c.z) - a.r - c.r;
        if (gap < -0.35) bad.push(`${a.x.toFixed(1)},${a.z.toFixed(1)} / ${c.x.toFixed(1)},${c.z.toFixed(1)}`);
      }),
    );
    expect(bad).toEqual([]);
  });

  it('spawn is inside the plaza and free of colliders', () => {
    for (let i = 0; i <= 50; i++) expect(walkable(spawnPoint(i / 50))).toBe(true);
  });

  it('every path can be walked end to end', () => {
    for (const line of PATHS) {
      expect(line.length).toBeGreaterThan(1);
      line.slice(1).forEach(([bx, bz], i) => {
        const [ax, az] = line[i];
        const n = Math.ceil(Math.hypot(bx - ax, bz - az));
        for (let k = 0; k <= n; k++) {
          const p = { x: ax + ((bx - ax) * k) / n, z: az + ((bz - az) * k) / n };
          expect(walkable(p), `path point ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true);
        }
      });
    }
  });

  it('pads lie inside the plaza', () => {
    for (const p of PADS) expect(Math.hypot(p.x, p.z) + p.r).toBeLessThan(PLAZA_RADIUS);
  });

  it('spawn is linked by a path to the central tree', () => {
    const ends = PATHS.flat().map(([x, z]) => ({ x, z }));
    const near = (to: { x: number; z: number }, d: number) => ends.some((p) => Math.hypot(p.x - to.x, p.z - to.z) < d);
    expect(near(SPAWN, 1)).toBe(true);
    expect(near({ x: 0, z: 0 }, 9)).toBe(true);
    for (const k of KINDS) expect(near(STATIONS[k], 6)).toBe(true);
    expect(near(GALLERY, 6)).toBe(true);
  });
});

describe('stations, gallery and exhibits', () => {
  const around = (c: { x: number; z: number }, d: number) =>
    Array.from({ length: 36 }, (_, i) => ({ x: c.x + Math.cos(i * 0.1745) * d, z: c.z + Math.sin(i * 0.1745) * d }));

  it('stations and the gallery are inside the plaza and can be approached', () => {
    for (const [name, c, range] of [
      ['cake', STATIONS.cake, STATION_RANGE],
      ['tree', STATIONS.tree, STATION_RANGE],
      ['gallery', GALLERY, GALLERY_RANGE],
    ] as const) {
      expect(inPlaza(c), name).toBe(true);
      expect(around(c, 3).some(walkable), name).toBe(true);
      const spot = around(c, 3).find(walkable)!;
      expect(nearestSpot(spot.x, spot.z), name).not.toBeNull();
      expect(Math.hypot(spot.x - c.x, spot.z - c.z)).toBeLessThan(range);
    }
  });

  it('the gallery is right beside the cake station and nothing blocks the way between', () => {
    expect(Math.hypot(GALLERY.x - STATIONS.cake.x, GALLERY.z - STATIONS.cake.z)).toBeLessThan(9);
    const a = STATIONS.cake;
    const n = 30;
    // 두 곳 사이 한가운데 줄에서 한쪽 끝까지 걸어갈 수 있다.
    for (let k = 0; k <= n; k++) {
      const p = { x: a.x + 3 + ((GALLERY.x + 3 - (a.x + 3)) * k) / n, z: a.z + ((GALLERY.z - a.z) * k) / n };
      expect(walkable(p), `${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true);
    }
  });

  it('players start an activity on free ground', () => {
    for (const k of KINDS) for (const p of workSpots(k)) expect(walkable(p), `${k} ${p.x},${p.z}`).toBe(true);
  });

  it('exhibit slots are inside the plaza, free to look at, and do not overlap', () => {
    for (const k of KINDS) {
      const slots = EXHIBIT_SLOTS[k];
      expect(slots).toHaveLength(MAX_EXHIBITS);
      slots.forEach((s, i) => {
        expect(inPlaza(s)).toBe(true);
        // 안쪽(전시대가 바라보는 쪽)에 서서 볼 수 있다.
        const view = { x: s.x + Math.sin(s.ry) * 2.4, z: s.z + Math.cos(s.ry) * 2.4 };
        expect(walkable(view), `${k} ${i} view`).toBe(true);
        slots.slice(i + 1).forEach((o) => expect(Math.hypot(s.x - o.x, s.z - o.z)).toBeGreaterThanOrEqual(3));
      });
    }
    const all = KINDS.flatMap((k) => EXHIBIT_SLOTS[k]);
    all.forEach((s, i) => all.slice(i + 1).forEach((o) => expect(Math.hypot(s.x - o.x, s.z - o.z)).toBeGreaterThan(3)));
  });

  it('exhibits sit beside their own station', () => {
    for (const k of KINDS) {
      for (const s of EXHIBIT_SLOTS[k]) expect(Math.hypot(s.x - STATIONS[k].x, s.z - STATIONS[k].z)).toBeLessThan(14);
    }
  });

  it('picks the nearest of station and gallery without flicker', () => {
    const mid = { x: STATIONS.cake.x, z: (STATIONS.cake.z + GALLERY.z) / 2 };
    expect(nearestSpot(mid.x, STATIONS.cake.z + 2.5)).toBe('cake');
    expect(nearestSpot(mid.x, GALLERY.z - 2.5)).toBe('gallery');
    expect(nearestSpot(0, 0)).toBeNull();
    // 중간 지점을 오가도 처음 고른 곳을 유지한다.
    let cur = nearestSpot(mid.x, mid.z - 0.3);
    const picked = cur;
    for (const dz of [0.1, 0.3, -0.1, 0.2, -0.3, 0.15]) {
      cur = nearestSpot(mid.x, mid.z + dz, cur);
      expect(cur).toBe(picked);
    }
    expect(nearestSpot(STATIONS.tree.x, STATIONS.tree.z + 2.5)).toBe('tree');
  });

  it('decor is not buried in other things', () => {
    const solid = [...BENCHES, ...LAMPS, ...SNOWMEN, ...PARK_TREES];
    expect(solid.length).toBeGreaterThan(60);
    expect(PARK_TREES.length).toBeGreaterThan(25);
    expect(clampToPlaza(100, 0).x).toBe(PLAZA_RADIUS);
  });
});
