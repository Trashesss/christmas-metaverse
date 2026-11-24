import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CLOTH_COLORS, HAIR_COLORS, SKIN_COLORS, type Look } from '../../shared/look';

const DIR = '/assets/quaternius-modular';
export const baseUrl = (look: Look) => `${DIR}/${look.body}/base.glb`;
/** 머리카락, 상의, 하의, 신발 파일. 파일이 없는 머리(없음, 짧은 머리)는 빠진다. */
export function partUrls(look: Look) {
  const { body, hair, top, bottom, shoes } = look;
  const names = [`top-${top}`, `bottom-${bottom}`, `shoes-${shoes}`];
  if (hair !== 'bald' && hair !== 'buzz') names.push(`hair-${hair}`);
  return names.map((n) => `${DIR}/${body}/${n}.glb`);
}

/** 발목까지 덮는 신발. 안쪽 맨살이 비집고 나오지 않게 뺀다. */
const HIGH = new Set(['boots', 'farmer']);
/** 정강이가 드러나는 하의. 신발 목이 짧으면 base의 정강이를 채운다. */
const BARE = new Set(['skirt', 'shorts', 'wide', 'tiered']);

// 꼭짓점의 _tint는 rgb가 원래 색(또는 명암), a가 팔레트 칸이다. scripts/build-avatars.mjs와 순서가 같다.
const FIXED = 6;
const HAT = 7;
export function setPalette(palette: THREE.Color[], look: Look) {
  const skin = SKIN_COLORS[look.skin].color;
  const hair = HAIR_COLORS[look.hairColor].color;
  const colors = [
    skin,
    hair,
    look.hair === 'bald' ? skin : hair,
    CLOTH_COLORS[look.topColor].color,
    CLOTH_COLORS[look.bottomColor].color,
    CLOTH_COLORS[look.shoesColor].color,
    '#ffffff',
    CLOTH_COLORS[look.hatColor].color,
  ];
  colors.forEach((c, i) => palette[i].set(c));
}

/** 그늘진 쪽을 조금 밝힌다. 얼굴과 몸에 같은 값을 써야 이음매가 보이지 않는다. */
export const LIFT = 0.16;

/** 옷과 피부를 한 번에 그리고, 색은 아바타마다 가진 팔레트에서 읽는다. */
export function bodyMaterial() {
  const palette = Array.from({ length: HAT + 1 }, () => new THREE.Color());
  const material = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPalette = { value: palette };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 _tint;\nuniform vec3 uPalette[${HAT + 1}];\nvarying vec3 vTint;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = uPalette[int(_tint.a * 255.0 + 0.5)] * pow(_tint.rgb, vec3(2.2));');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTint;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vTint * ${LIFT.toFixed(2)};`);
  };
  material.customProgramCacheKey = () => 'avatar';
  return { material, palette };
}

const HAT_Y = 1.75;
const HAT_TILT = 0.07;
const HAT_PARTS = [
  { geo: () => new THREE.TorusGeometry(0.118, 0.026, 7, 18).rotateX(Math.PI / 2).scale(1, 1, 1.12), slot: FIXED, pos: [0, 0, 0], rotZ: 0 },
  { geo: () => new THREE.CylinderGeometry(0.066, 0.124, 0.12, 14).scale(1, 1, 1.12), slot: HAT, pos: [0.005, 0.06, 0], rotZ: -0.1 },
  { geo: () => new THREE.ConeGeometry(0.066, 0.13, 12), slot: HAT, pos: [0.04, 0.15, 0], rotZ: -0.5 },
  { geo: () => new THREE.SphereGeometry(0.034, 9, 7), slot: FIXED, pos: [0.076, 0.215, 0], rotZ: 0 },
] as const;

const hats = new Map<string, THREE.BufferGeometry>();
/** 산타 모자는 머리 뼈에 붙은 살처럼 몸에 합쳐 따로 그리지 않는다. */
function hatGeometry(body: string, head: number) {
  let hat = hats.get(body);
  if (hat) return hat;
  const pieces = HAT_PARTS.map(({ geo, slot, pos, rotZ }) => {
    const g = geo().rotateZ(rotZ).translate(pos[0], pos[1], pos[2]).rotateX(-HAT_TILT).translate(0, HAT_Y, 0.04);
    const n = g.attributes.position.count;
    const normal = g.attributes.normal;
    g.deleteAttribute('normal').deleteAttribute('uv');
    g.setAttribute('_normal', new THREE.BufferAttribute(Int8Array.from({ length: n * 4 }, (_, i) => (i % 4 < 3 ? normal.array[((i / 4) | 0) * 3 + (i % 4)] * 127 : 0)), 4, true));
    const fill = (v: number[]) => new Uint8Array(Array.from({ length: n }, () => v).flat());
    g.setAttribute('skinIndex', new THREE.BufferAttribute(fill([head, 0, 0, 0]), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(fill([255, 0, 0, 0]), 4, true));
    g.setAttribute('_tint', new THREE.BufferAttribute(fill([255, 255, 255, slot]), 4, true));
    return g;
  });
  hat = mergeGeometries(pieces)!;
  hats.set(body, hat);
  return hat;
}

/** 모자 안에 들어갈 머리카락을 눌러 모자를 뚫지 않게 한다. */
function underHat(source: THREE.BufferGeometry) {
  const g = source.clone();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const z = p.getZ(i) - 0.04;
    const brim = HAT_Y - 0.008 + z * HAT_TILT;
    const r = Math.hypot(p.getX(i), z / 1.12);
    // 모자 아래로 내려갈수록 원래 모양을 되찾는다.
    const limit = y < brim ? 0.124 + Math.max(0, brim - 0.03 - y) : 0.104;
    const k = Math.min(1, limit / r);
    p.setXYZ(i, p.getX(i) * k, y < brim ? y : brim + Math.min(0.03, (y - brim) * 0.3), z * k + 0.04);
  }
  return g;
}

/** 정렬을 맞추려고 네 칸으로 저장한 법선을 three가 읽는 이름으로 바꾼다. */
export function withNormal(g: THREE.BufferGeometry) {
  if (g.attributes._normal) g.setAttribute('normal', g.attributes._normal).deleteAttribute('_normal');
  return g;
}

const meshOf = (scene: THREE.Object3D, name: string) => (scene.getObjectByName(name) as THREE.Mesh | undefined)?.geometry;

/** 모히칸은 모자를 쓰면 짧은 머리만 남는다. */
function hairGeometry(look: Look, hair: THREE.BufferGeometry) {
  if (!look.hat) return hair;
  return look.hair === 'mohawk' ? undefined : underHat(hair);
}

/** 고른 부품을 한 메시로 합친다. 돌려준 도형은 쓴 쪽에서 dispose한다. */
export function buildBody(look: Look, base: THREE.Object3D, parts: THREE.Object3D[], headBone: number) {
  const [top, bottom, shoes, hair] = parts;
  const bare = BARE.has(look.bottom) && look.body === 'female';
  const shaft = meshOf(shoes, 'shaft');
  const list = [
    meshOf(base, 'head'),
    meshOf(top, 'main'),
    meshOf(bottom, 'main'),
    meshOf(shoes, 'main'),
    HIGH.has(look.shoes) ? undefined : meshOf(bottom, 'ankle'),
    bare ? (shaft ?? meshOf(base, 'shin')) : undefined,
    hair && hairGeometry(look, meshOf(hair, 'main')!),
    look.hat ? hatGeometry(look.body, headBone) : undefined,
  ].filter((g) => !!g);
  return withNormal(mergeGeometries(list)!);
}

/** 얼굴형은 머리 뼈의 비율로 만든다. 몸에 비해 머리를 키워 표정이 멀리서도 보인다. */
export const HEAD_SCALE: Record<Look['face'], [number, number, number]> = {
  basic: [1.3, 1.3, 1.3],
  round: [1.42, 1.27, 1.36],
  slim: [1.2, 1.36, 1.26],
};
