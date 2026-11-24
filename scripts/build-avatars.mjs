// Quaternius Ultimate Modular Men/Women(CC0)에서 아바타 부품을 뽑아 public/assets/quaternius-modular/에 쓴다.
// 사용법: node scripts/build-avatars.mjs <원본 폴더>
// 원본 폴더: https://quaternius.com 의 두 팩을 GLB로 받은 Male-*.glb, Female-*.glb (파일 이름은 아래 PARTS와 같다)
import { mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Accessor, Document, NodeIO, VertexLayout } from '@gltf-transform/core';
import * as THREE from 'three';

const SRC = process.argv[2];
if (!SRC) throw new Error('원본 폴더를 적어주세요.');
const OUT = fileURLToPath(new URL('../public/assets/quaternius-modular', import.meta.url));
const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);

// 꼭짓점마다 색을 고르는 칸. src/three/avatarParts.ts의 팔레트 순서와 같다.
const SKIN = 0, HAIR = 1, CAP = 2, TOP = 3, BOTTOM = 4, SHOES = 5, FIXED = 6;
const SLOT = { hair: HAIR, top: TOP, bottom: BOTTOM, shoes: SHOES };

/**
 * src: 원본 파일. tint: 고른 색으로 칠할 재질(숫자는 명암). 없는 재질은 원래 색.
 * omit: 버릴 재질. keep: 남길 덩어리 조건. bare·ankle·legs: 맨다리 처리.
 * hem: 이 높이 아래 옷자락을 벌리거나 오므려 하의와 엇갈리지 않게 한다.
 */
const PARTS = {
  male: {
    hair: {
      swept: { src: 'Casual_Hoodie', tint: { Hair: 1 } },
      side: { src: 'Suit', tint: { Hair: 1 } },
      spiky: { src: 'Beach', tint: { Hair: 1 } },
      tied: { src: 'Casual_2', tint: { Hair: 1 } },
      mohawk: { src: 'Punk', tint: { Red: 1 }, keep: (b) => b.max.y > 1.75 },
      layered: { src: 'Adventurer', tint: { Hair: 1 }, keep: (b) => b.max.y > 1.74 },
    },
    top: {
      tee: { src: 'Casual_2', tint: { LightBrown: 1 } },
      hoodie: { src: 'Casual_Hoodie', tint: { Purple: 1 } },
      suit: { src: 'Suit', tint: { Suit: 1 } },
      tank: { src: 'Beach', tint: { LightBrown: 1 } },
      overall: { src: 'Farmer', tint: { Brown: 1 } },
      vest: { src: 'Punk', tint: { Black: 1 } },
      shirt: { src: 'Adventurer', tint: { Green: 1, LightGreen: 0.7 } },
      worker: { src: 'Worker', tint: { Worker_Vest: 1 } },
    },
    bottom: {
      jeans: { src: 'Casual_2', tint: { LightBlue: 1 } },
      slacks: { src: 'Suit', tint: { Suit: 1 } },
      shorts: { src: 'Casual_Hoodie', tint: { LightBlue: 1 }, ankle: true },
      sporty: { src: 'Beach', tint: { Red_Dark: 1 }, ankle: true },
      cargo: { src: 'Adventurer', tint: { Brown: 1, Brown2: 0.65 } },
      baggy: { src: 'Farmer', tint: { LightBlue: 1 } },
      ripped: { src: 'Punk', tint: { LightBlue: 1 } },
    },
    shoes: {
      sneakers: { src: 'Casual_2', tint: { Red_Dark: 1 } },
      runners: { src: 'Casual_Hoodie', tint: { Purple: 1 } },
      dress: { src: 'Suit', tint: { Black: 1 } },
      boots: { src: 'Adventurer', tint: { Grey: 1 } },
      farmer: { src: 'Farmer', tint: { Brown: 1, Brown2: 0.65 } },
      sandals: { src: 'Beach', tint: { Red_Dark: 1 } },
    },
  },
  female: {
    hair: {
      bob: { src: 'Casual', tint: { Hair_Blond: 1 } },
      tied: { src: 'Formal', tint: { Red: 1 } },
      short: { src: 'SciFi', tint: { Hair_Black: 1, Blue: 0.7 } },
      straight: { src: 'Soldier', tint: { Hair_Brown: 1 } },
      mohawk: { src: 'Punk', tint: { Pink: 1 }, keep: (b) => b.max.y > 1.75 },
    },
    top: {
      tee: { src: 'Casual', tint: { White: 1 }, hem: [1.16, 0.94] },
      sleeveless: { src: 'Formal', tint: { LimeGreen: 1 } },
      suit: { src: 'Suit', tint: { Black: 1 } },
      tunic: { src: 'Witch', tint: { Purple: 1 } },
      leather: { src: 'Medieval', tint: { DarkBrown: 1, LightBrown: 0.7 }, omit: ['Metal'], hem: [1.17, 1.1] },
      layered: { src: 'Adventurer', tint: { LightGreen: 1, Green: 0.7 }, keep: (b) => b.min.z > -0.1 },
      worker: { src: 'Worker', tint: { Worker_Vest: 1 } },
    },
    bottom: {
      slim: { src: 'Casual', tint: { Orange: 1 } },
      slacks: { src: 'Suit', tint: { Black: 1 } },
      cargo: { src: 'Worker', tint: { Brown_02: 1, Brown2: 0.65 } },
      skirt: { src: 'Formal', tint: { LimeGreen: 1 }, bare: true },
      shorts: { src: 'Adventurer', tint: { Brown_02: 1, Brown2: 0.65 }, omit: ['Skin', 'LightGreen', 'Gold', 'White'], legs: true, keep: (b) => b.max.y < 1.14, bare: true },
      wide: { src: 'Medieval', tint: { Black: 1 }, bare: true },
      tiered: { src: 'Witch', tint: { Purple: 1 }, bare: true },
    },
    shoes: {
      loafers: { src: 'Casual', tint: { Grey: 1 } },
      flats: { src: 'Formal', tint: { Red: 1 } },
      boots: { src: 'Adventurer', tint: { Brown_02: 1, Brown2: 0.65 }, tall: true },
      ankle: { src: 'Medieval', tint: { DarkBrown: 1, LightBrown: 0.7 }, tall: true },
      long: { src: 'Witch', tint: { Brown2: 1 }, tall: true },
      platform: { src: 'Punk', tint: { Black: 1, Grey: 0.5 }, tall: true },
    },
  },
};
const GENDERS = {
  male: { prefix: 'Male', base: 'Punk', cap: 'Red_Dark', eyeY: 1.697 },
  female: { prefix: 'Female', base: 'Adventurer', cap: 'Hair_Brown', eyeY: 1.691 },
};
const NODE = { hair: /_Head$/, top: /_Body$/, bottom: /_(Legs|Pants)$/, shoes: /_Feet$/ };
const SHIN = 0.425;
const ANKLE = 0.19;
const SHAFT = 0.2;

const cache = new Map();
async function source(gender, name) {
  const file = join(SRC, `${GENDERS[gender].prefix}-${name}.glb`);
  if (!cache.has(file)) cache.set(file, await io.read(file));
  return cache.get(file);
}

/** 이음매 없이 이어진 삼각형 덩어리마다 경계 상자를 구한다. */
function components(pos, idx) {
  const ids = new Map();
  const parent = [];
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const at = (i) => {
    const k = [0, 1, 2].map((j) => pos[i * 3 + j].toFixed(4)).join();
    if (!ids.has(k)) ids.set(k, parent.push(parent.length) - 1);
    return ids.get(k);
  };
  const vert = Array.from({ length: pos.length / 3 }, (_, i) => at(i));
  for (let i = 0; i < idx.length; i += 3) for (const j of [1, 2]) parent[find(vert[idx[i + j]])] = find(vert[idx[i]]);
  const boxes = new Map();
  vert.forEach((v, i) => {
    const r = find(v);
    if (!boxes.has(r)) boxes.set(r, new THREE.Box3());
    boxes.get(r).expandByPoint(new THREE.Vector3(...pos.subarray(i * 3, i * 3 + 3)));
  });
  return (i) => boxes.get(find(vert[i]));
}

const HEAD = [0, 1.7, 0.06];
const toSrgb = (v) => Math.round(255 * Math.min(1, Math.pow(v, 1 / 2.2)));

/** 눈썹은 얼굴에 그리므로 이마 앞의 작은 덩어리를 뺀다. */
const notBrow = (b) => b.max.y > 1.73 || b.min.z < 0.1;

/** 재질별 삼각형을 { slot, color, 세 꼭짓점 } 목록으로 펼친다. */
function triangles(doc, nodeName, slot, { tint = {}, omit = [], keep } = {}) {
  const out = [];
  const node = doc.getRoot().listNodes().find((n) => n.getMesh() && nodeName.test(n.getName()));
  for (const prim of node.getMesh().listPrimitives()) {
    const mat = prim.getMaterial();
    const name = mat.getName();
    if (omit.includes(name)) continue;
    const skin = /^Skin/.test(name);
    if (slot === HAIR && !(name in tint)) continue;
    const shade = tint[name];
    const s = skin ? SKIN : shade ? slot : FIXED;
    const color = skin ? [255, 255, 255] : shade ? Array(3).fill(toSrgb(Math.pow(Math.min(1, shade), 2.2))) : mat.getBaseColorFactor().slice(0, 3).map((v) => toSrgb(v * 1.5));
    const pos = prim.getAttribute('POSITION').getArray();
    const normal = prim.getAttribute('NORMAL');
    const joints = prim.getAttribute('JOINTS_0').getArray();
    const weights = prim.getAttribute('WEIGHTS_0');
    const idx = prim.getIndices().getArray();
    const filter = keep ?? (slot === HAIR ? notBrow : undefined);
    const boxOf = filter && components(pos, idx);
    for (let i = 0; i < idx.length; i += 3) {
      if (filter && !skin && !filter(boxOf(idx[i]))) continue;
      const v = [0, 1, 2].map((j) => {
        const k = idx[i + j];
        const p = [...pos.subarray(k * 3, k * 3 + 3)];
        // 머리 덮개와 겹쳐 깜빡이지 않게 머리카락을 조금 부풀린다.
        return { p: slot === HAIR ? p.map((x, c) => HEAD[c] + (x - HEAD[c]) * 1.025) : p, n: normal.getElement(k, []).map((x) => Math.round(x * 127)), j: [...joints.subarray(k * 4, k * 4 + 4)], w: weights.getElement(k, []) };
      });
      out.push({ slot: s, color, v });
    }
  }
  return out;
}

/** 삼각형을 높이 y에서 자른다. side가 1이면 위쪽, -1이면 아래쪽을 남긴다. */
function clip(t, y, side) {
  const out = [];
  t.v.forEach((a, i) => {
    const b = t.v[(i + 1) % 3];
    const [da, db] = [(a.p[1] - y) * side, (b.p[1] - y) * side];
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const k = da / (da - db);
      out.push({ ...(Math.abs(da) < Math.abs(db) ? a : b), p: a.p.map((x, j) => x + (b.p[j] - x) * k), n: a.n.map((x, j) => Math.round(x + (b.n[j] - x) * k)) });
    }
  });
  return out.slice(2).map((_, i) => ({ ...t, v: [out[0], out[i + 1], out[i + 2]] }));
}

const centerY = (t) => (t.v[0].p[1] + t.v[1].p[1] + t.v[2].p[1]) / 3;

const FACE_CENTER = [0, 1.66, 0.03];
const ramp = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

/** 코를 낮추고 살결의 법선을 이어 붙인다. 얼굴은 공에 가까운 법선을 섞어 그늘이 각지지 않게 한다. */
function soften(tris) {
  const skin = tris.filter((t) => t.slot === SKIN || t.slot === CAP);
  const key = (p) => p.map((x) => x.toFixed(4)).join();
  for (const v of new Set(skin.flatMap((t) => t.v))) {
    const [x, y, z] = v.p;
    if (Math.abs(x) < 0.02 && y > 1.6 && y < 1.73 && z > 0.157) v.p = [x, y, 0.157 + (z - 0.157) * 0.5];
  }
  const sums = new Map();
  for (const t of skin) {
    const [a, b, c] = t.v.map((v) => new THREE.Vector3(...v.p));
    const n = b.sub(a).cross(c.sub(a));
    for (const v of t.v) sums.set(key(v.p), (sums.get(key(v.p)) ?? new THREE.Vector3()).add(n));
  }
  for (const t of skin) {
    for (const v of t.v) {
      const [x, y, z] = v.p;
      const n = sums.get(key(v.p)).clone().normalize();
      // 목의 이음매는 어느 부품에서나 같은 방향을 보게 한다.
      const neck = Math.abs(x) < 0.1 ? ramp(1.48, 1.5, y) * (1 - ramp(1.55, 1.58, y)) : 0;
      n.lerp(new THREE.Vector3(x, 0, z - 0.04).normalize(), neck).normalize();
      const round = new THREE.Vector3(x - FACE_CENTER[0], (y - FACE_CENTER[1]) * 0.8, z - FACE_CENTER[2]).normalize();
      n.lerp(round, ramp(1.56, 1.6, y) * 0.75).normalize();
      v.n = n.toArray().map((k) => Math.round(k * 127));
    }
  }
  return tris;
}

/** 색, 법선, 뼈대 정보가 같은 꼭짓점을 합쳐 한 덩어리로 만든다. */
function weld(tris) {
  const map = new Map();
  const data = { position: [], normal: [], joints: [], weights: [], tint: [] };
  const index = [];
  for (const t of tris) {
    const ids = t.v.map(({ p, n, j, w }) => {
      const sum = w.reduce((a, b) => a + b, 0);
      const bytes = w.map((x) => Math.round((x / sum) * 255));
      bytes[bytes.indexOf(Math.max(...bytes))] += 255 - bytes.reduce((a, b) => a + b, 0);
      const bones = j.map((b, i) => (bytes[i] ? b : 0));
      const key = [p.map((x) => x.toFixed(5)), n, t.slot, t.color, bones, bytes].join();
      if (!map.has(key)) {
        map.set(key, data.position.push(...p) / 3 - 1);
        data.normal.push(...n, 0);
        data.joints.push(...bones);
        data.weights.push(...bytes);
        data.tint.push(...t.color, t.slot);
      }
      return map.get(key);
    });
    if (new Set(ids).size === 3) index.push(...ids);
  }
  return { ...data, index };
}

function addMesh(doc, name, tris, uv) {
  const buffer = doc.getRoot().listBuffers()[0];
  const g = weld(tris);
  const acc = (type, array, normalized = false) => doc.createAccessor().setType(type).setArray(array).setNormalized(normalized).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', acc(Accessor.Type.VEC3, new Float32Array(g.position)))
    .setAttribute('_NORMAL', acc(Accessor.Type.VEC4, new Int8Array(g.normal), true))
    .setAttribute('JOINTS_0', acc(Accessor.Type.VEC4, new Uint8Array(g.joints)))
    .setAttribute('WEIGHTS_0', acc(Accessor.Type.VEC4, new Uint8Array(g.weights), true))
    .setAttribute('_TINT', acc(Accessor.Type.VEC4, new Uint8Array(g.tint), true))
    .setIndices(acc(Accessor.Type.SCALAR, new Uint16Array(g.index)));
  if (uv) prim.setAttribute('TEXCOORD_0', acc(Accessor.Type.VEC2, new Float32Array(uv(g.position))));
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
}

async function writePart(gender, file, nodes) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene();
  for (const [name, tris] of nodes) if (tris.length) scene.addChild(addMesh(doc, name, tris));
  await io.write(join(OUT, gender, file), doc);
}

const AXIS_Z = 0.07;
function scaleHem(p, k) {
  p[0] *= k;
  p[2] = AXIS_Z + (p[2] - AXIS_Z) * k;
}

async function bareLegs(gender) {
  const legs = triangles(await source(gender, 'Formal'), NODE.bottom, BOTTOM).filter((t) => t.slot === SKIN);
  for (const v of legs.flatMap((t) => t.v)) if (v.p[1] > 0.74) v.p[1] += 0.05;
  return soften(legs);
}

async function buildParts(gender) {
  for (const [kind, list] of Object.entries(PARTS[gender])) {
    for (const [id, spec] of Object.entries(list)) {
      let tris = triangles(await source(gender, spec.src), NODE[kind], SLOT[kind], spec);
      let shaft = [];
      // 맨다리는 신발 목에 가려질 부분을 떼어 두었다가, 신발에 맞춰 다시 붙인다.
      let ankle = [];
      // 원본은 긴 양말에 맞춰 잘려 있어 치마 쪽 다리를 쓰고, 바지 안으로 조금 늘인다.
      soften(tris);
      if (spec.legs) tris.push(...(await bareLegs(gender)));
      if (spec.bare) tris = tris.flatMap((t) => (t.slot === SKIN ? clip(t, SHIN, 1) : t));
      if (spec.ankle) {
        ankle = tris.filter((t) => t.slot === SKIN).flatMap((t) => clip(t, ANKLE, -1));
        tris = tris.flatMap((t) => (t.slot === SKIN ? clip(t, ANKLE, 1) : t));
      }
      if (spec.hem) for (const t of tris) if (t.slot !== SKIN) for (const v of t.v) if (v.p[1] < spec.hem[0] && Math.abs(v.p[0]) < 0.25) scaleHem(v.p, spec.hem[1]);
      if (spec.tall) {
        shaft = tris.filter((t) => centerY(t) >= SHAFT);
        tris = tris.filter((t) => centerY(t) < SHAFT);
      }
      await writePart(gender, `${kind}-${id}.glb`, [['main', tris], ['shaft', shaft], ['ankle', ankle]]);
    }
  }
}

/** 얼굴을 그릴 면. 눈썹, 눈, 입이 올라가는 앞면만 머리에서 떼어 낸다. */
function isFace(t) {
  const [a, b, c] = t.v.map((v) => new THREE.Vector3(...v.p));
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const y = centerY(t);
  return t.slot === SKIN && n.z > 0.25 && y > 1.56 && y < 1.78 && (a.z + b.z + c.z) / 3 > 0.07;
}

/** 긴 턱을 줄여 두 몸의 얼굴 비율을 비슷하게 맞춘다. */
function shortenChin(head) {
  for (const { p } of new Set(head.flatMap((t) => t.v))) {
    const k = ramp(0.04, 0.1, p[2]) * ramp(1.54, 1.57, p[1]);
    if (p[1] < 1.66) p[1] = 1.66 - (1.66 - p[1]) * (1 - 0.2 * k);
  }
}

/** 머리 덮개 테두리를 가장 가까운 피부 꼭짓점에 붙여, 머리카락 없는 머리에 턱이 지지 않게 한다. */
function flatten(head) {
  const skin = head.filter((t) => t.slot === SKIN).flatMap((t) => t.v);
  for (const v of head.filter((t) => t.slot === CAP).flatMap((t) => t.v)) {
    const near = skin.reduce((a, b) => (dist(b.p, v.p) < dist(a.p, v.p) ? b : a));
    if (dist(near.p, v.p) < 0.009) v.p = near.p;
  }
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function buildBase(gender) {
  const { base, cap } = GENDERS[gender];
  const src = await source(gender, base);
  const head = triangles(src, /_Head$/, CAP, { tint: { [cap]: 1 }, keep: notBrow }).filter((t) => t.slot === SKIN || t.slot === CAP);
  if (gender === 'male') shortenChin(head);
  flatten(head);
  soften(head);
  // 같은 성별이면 뼈대 초기 자세가 모두 같아야 부품을 섞을 수 있다.
  const skinOf = (doc) => doc.getRoot().listSkins()[0];
  const ibm = skinOf(src).getInverseBindMatrices().getArray();
  for (const f of readdirSync(SRC).filter((x) => x.startsWith(`${GENDERS[gender].prefix}-`) && x.endsWith('.glb'))) {
    const other = skinOf(await source(gender, f.slice(GENDERS[gender].prefix.length + 1, -4))).getInverseBindMatrices().getArray();
    if (ibm.some((v, i) => Math.abs(v - other[i]) > 1e-4)) throw new Error(`${f}: 뼈대 초기 자세가 다릅니다.`);
  }
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const nodes = new Map();
  const copy = (n) => {
    const c = doc.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale());
    nodes.set(n.getName(), c);
    for (const k of n.listChildren()) if (!k.getMesh()) c.addChild(copy(k));
    return c;
  };
  const armature = src.getRoot().listNodes().find((n) => n.getName() === 'CharacterArmature');
  scene.addChild(copy(armature));
  const skin = doc.createSkin().setInverseBindMatrices(
    doc.createAccessor().setType(Accessor.Type.MAT4).setArray(new Float32Array(ibm)).setBuffer(buffer),
  );
  for (const j of skinOf(src).listJoints()) skin.addJoint(nodes.get(j.getName()));
  // 눈 높이를 기준으로 가로세로 0.22인 정사각형을 얼굴 그림 한 장에 맞춘다.
  const { eyeY } = GENDERS[gender];
  const faceUv = (p) => Array.from({ length: p.length / 3 }, (_, i) => [(p[i * 3] + 0.11) / 0.22, (eyeY + 0.08 - p[i * 3 + 1]) / 0.22]).flat();
  for (const [name, tris] of [['head', head.filter((t) => !isFace(t))], ['face', head.filter(isFace)]]) {
    scene.addChild(addMesh(doc, name, tris, name === 'face' && faceUv).setSkin(skin));
  }
  if (gender === 'female') {
    const legs = (await bareLegs(gender)).flatMap((t) => clip(t, SHIN, -1));
    scene.addChild(addMesh(doc, 'shin', legs));
  }
  for (const clip of clips(src)) writeClip(doc, buffer, nodes, clip);
  await io.write(join(OUT, gender, 'base.glb'), doc);
}

// ---- 동작 ----

function readClip(src, name) {
  const anim = src.getRoot().listAnimations().find((a) => a.getName() === name);
  return anim.listChannels().map((c) => ({
    node: c.getTargetNode().getName(),
    path: c.getTargetPath(),
    times: [...c.getSampler().getInput().getArray()],
    values: [...c.getSampler().getOutput().getArray()],
  }));
}

/** 선형 보간으로 되살릴 수 있는 키를 버린다. */
function thin({ times, values, ...rest }) {
  const k = values.length / times.length;
  const keep = [0];
  for (let i = 1; i < times.length - 1; i++) {
    const a = keep.at(-1);
    let ok = true;
    for (let m = a + 1; m <= i && ok; m++) {
      const t = (times[m] - times[a]) / (times[i + 1] - times[a]);
      for (let j = 0; j < k; j++) {
        const v = values[a * k + j] * (1 - t) + values[(i + 1) * k + j] * t;
        if (Math.abs(v - values[m * k + j]) > 0.0012) ok = false;
      }
    }
    if (!ok) keep.push(i);
  }
  if (times.length > 1) keep.push(times.length - 1);
  const flat = keep.every((i) => values.slice(0, k).every((v, j) => Math.abs(v - values[i * k + j]) < 0.0012));
  const used = flat ? [0] : keep;
  return { ...rest, times: used.map((i) => times[i]), values: used.flatMap((i) => values.slice(i * k, i * k + k)) };
}

function clips(src) {
  const take = (name, as) => ({ name: as, tracks: readClip(src, name).filter((t) => t.path !== 'scale' && !/^PT/.test(t.node)) });
  const idle = take('Idle_Neutral', 'Idle');
  const rig = new Rig(src, idle);
  return [idle, take('Run', 'Run'), rig.bake('Wave', 1.8, wave), rig.bake('Cheer', 1.6, cheer), rig.bake('Jump', 1.1, jump), rig.bake('Sit', 2.4, sit)];
}

/** 원본에 없는 동작을 선 자세에서 두 관절 IK로 만든다. */
class Rig {
  constructor(src, idle) {
    this.bones = new Map();
    const add = (n) => {
      const b = new THREE.Object3D();
      b.name = n.getName();
      b.position.fromArray(n.getTranslation());
      b.quaternion.fromArray(n.getRotation());
      b.scale.fromArray(n.getScale());
      this.bones.set(b.name, b);
      for (const k of n.listChildren()) if (!k.getMesh()) b.add(add(k));
      return b;
    };
    this.root = add(src.getRoot().listNodes().find((n) => n.getName() === 'CharacterArmature'));
    this.idle = idle;
    this.reset();
    this.hip = this.pos('Body');
    for (const s of 'LR') {
      // 발 뼈는 다리와 이어져 있지 않아, 정강이에서 본 위치를 기억해 함께 옮긴다.
      const shin = this.bones.get(`LowerLeg.${s}`);
      const foot = this.bones.get(`Foot.${s}`);
      this[s] = {
        ankle: foot.getWorldPosition(new THREE.Vector3()),
        local: shin.worldToLocal(foot.getWorldPosition(new THREE.Vector3())),
        quat: foot.getWorldQuaternion(new THREE.Quaternion()),
      };
    }
  }
  reset() {
    for (const t of this.idle.tracks) {
      const b = this.bones.get(t.node);
      if (t.path === 'rotation') b.quaternion.fromArray(t.values);
      else b.position.fromArray(t.values);
    }
    this.root.updateMatrixWorld(true);
  }
  pos(name) {
    return this.bones.get(name).getWorldPosition(new THREE.Vector3());
  }
  setWorldQuat(b, q) {
    b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    b.updateMatrixWorld(true);
  }
  /** 뼈가 from에서 본 방향을 dir로 돌린다. */
  aim(bone, end, dir) {
    const b = this.bones.get(bone);
    const cur = end.clone().sub(this.pos(bone)).normalize();
    const turn = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
    this.setWorldQuat(b, turn.multiply(b.getWorldQuaternion(new THREE.Quaternion())));
  }
  turn(bone, x, y = 0, z = 0) {
    const b = this.bones.get(bone);
    this.setWorldQuat(b, new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).multiply(b.getWorldQuaternion(new THREE.Quaternion())));
  }
  lower(dy, dz = 0) {
    const b = this.bones.get('Body');
    const w = this.pos('Body').add(new THREE.Vector3(0, dy, dz));
    b.position.copy(b.parent.worldToLocal(w));
    b.updateMatrixWorld(true);
  }
  limb(upper, lower, end, target, pole) {
    const a = this.pos(upper);
    const l1 = this.pos(lower).distanceTo(a);
    const l2 = end().distanceTo(this.pos(lower));
    const dir = target.clone().sub(a);
    const d = THREE.MathUtils.clamp(dir.length(), 0.05, (l1 + l2) * 0.999);
    dir.normalize();
    const side = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const knee = a.clone().addScaledVector(dir, x).addScaledVector(side, Math.sqrt(Math.max(0, l1 * l1 - x * x)));
    this.aim(upper, this.pos(lower), knee.clone().sub(a));
    this.aim(lower, end(), a.clone().addScaledVector(dir, d).sub(this.pos(lower)));
  }
  leg(s, target, pole = new THREE.Vector3(s === 'L' ? 0.15 : -0.15, 0, 1), pitch = 0) {
    const shin = this.bones.get(`LowerLeg.${s}`);
    const end = () => shin.localToWorld(this[s].local.clone());
    this.limb(`UpperLeg.${s}`, `LowerLeg.${s}`, end, target, pole);
    const foot = this.bones.get(`Foot.${s}`);
    foot.position.copy(foot.parent.worldToLocal(end()));
    this.setWorldQuat(foot, new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, 0)).multiply(this[s].quat));
  }
  arm(s, target, pole) {
    this.limb(`UpperArm.${s}`, `LowerArm.${s}`, () => this.pos(`Wrist.${s}`), target, pole);
  }
  bake(name, duration, pose) {
    const frames = Math.round(duration * 15);
    const tracks = [...this.idle.tracks.map((t) => ({ node: t.node, path: t.path, times: [], values: [] }))];
    const has = new Set(tracks.map((t) => t.node + t.path));
    for (const n of ['Root', 'Body', 'Foot.L', 'Foot.R']) if (!has.has(`${n}translation`)) tracks.push({ node: n, path: 'translation', times: [], values: [] });
    const rootY = this.bones.get('Root').position.y;
    const extra = ['Root', 'Body', 'Foot.L', 'Foot.R'].map((n) => [n, this.bones.get(n).position.clone(), this.bones.get(n).quaternion.clone()]);
    for (let f = 0; f <= frames; f++) {
      for (const [n, p, q] of extra) {
        this.bones.get(n).position.copy(p);
        this.bones.get(n).quaternion.copy(q);
      }
      this.reset();
      const t = f / frames;
      const lift = pose(this, t) ?? 0;
      this.bones.get('Root').position.y = rootY + lift;
      for (const tr of tracks) {
        const b = this.bones.get(tr.node);
        tr.times.push(t * duration);
        const v = tr.path === 'rotation' ? b.quaternion.toArray() : b.position.toArray();
        const k = v.length;
        // 같은 회전의 부호가 뒤집히면 보간이 멀리 돌아간다.
        const prev = tr.values.slice(-k);
        tr.values.push(...(k === 4 && prev.length && prev.reduce((s, x, i) => s + x * v[i], 0) < 0 ? v.map((x) => -x) : v));
      }
    }
    for (const [n, p, q] of extra) {
      this.bones.get(n).position.copy(p);
      this.bones.get(n).quaternion.copy(q);
    }
    this.reset();
    return { name, tracks };
  }
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => t * t * (3 - 2 * t);
/** 시각 목록 사이를 부드럽게 잇는다. */
function keyed(t, keys) {
  let i = keys.findIndex(([k]) => k >= t);
  if (i <= 0) return keys[Math.max(0, i)][1];
  const [a, va] = keys[i - 1];
  const [b, vb] = keys[i];
  return va + (vb - va) * ease((t - a) / (b - a));
}

/** 팔을 늘어뜨린 자리에서 어깨 바깥 위쪽으로 든다. */
function raise(rig, s, up, spread) {
  const sx = s === 'L' ? 1 : -1;
  const rest = rig.pos(`Wrist.${s}`);
  const shoulder = rig.pos(`UpperArm.${s}`);
  // 몸통을 가로지르지 않도록 바깥쪽으로 돌아 올린다.
  const high = shoulder.clone().add(v3(sx * spread, 0.36, 0.08));
  const mid = shoulder.clone().add(v3(sx * 0.4, -0.02, 0.16));
  const to = rest.multiplyScalar((1 - up) ** 2).addScaledVector(mid, 2 * up * (1 - up)).addScaledVector(high, up * up);
  rig.arm(s, to, v3(sx, -0.3, -0.1));
}

function arms(rig, up, spread) {
  for (const s of 'LR') raise(rig, s, up, spread);
}

function wave(rig, t) {
  const up = keyed(t, [[0, 0], [0.2, 1], [0.8, 1], [1, 0]]);
  raise(rig, 'L', up, 0.4 + 0.09 * Math.sin(t * Math.PI * 8) * up);
  rig.turn('Head', 0, 0, -0.1 * up);
}

function cheer(rig, t) {
  const up = keyed(t, [[0, 0], [0.2, 1], [0.8, 1], [1, 0]]);
  const hop = t > 0.2 && t < 0.8 ? Math.abs(Math.sin(((t - 0.2) / 0.6) * Math.PI * 3)) : 0;
  const dip = up * (1 - hop) * 0.06;
  rig.lower(-dip);
  rig.turn('Torso', -0.1 * up);
  for (const s of 'LR') rig.leg(s, rig[s].ankle);
  arms(rig, up, 0.32 + 0.06 * hop);
  return hop * 0.09;
}

function jump(rig, t) {
  const crouch = keyed(t, [[0, 0], [0.2, 1], [0.32, 0], [0.68, 0], [0.8, 0.8], [1, 0]]);
  const air = t > 0.3 && t < 0.7 ? Math.sin(((t - 0.3) / 0.4) * Math.PI) : 0;
  rig.lower(-0.22 * crouch, -0.06 * crouch);
  rig.turn('Abdomen', 0.35 * crouch);
  arms(rig, 0.75 * air, 0.4);
  for (const s of 'LR') rig.leg(s, rig[s].ankle.clone().add(v3(0, 0.14 * air, -0.1 * air)), undefined, 0.5 * air);
  return air * 0.42;
}

function sit(rig, t) {
  const breathe = Math.sin(t * Math.PI * 2);
  rig.lower(0.15 - rig.hip.y, -0.22);
  rig.turn('Abdomen', -0.06 + 0.02 * breathe);
  for (const s of 'LR') {
    const sx = s === 'L' ? 1 : -1;
    const hip = rig.pos(`UpperLeg.${s}`);
    rig.leg(s, v3(hip.x * 0.75, 0.09, hip.z + 0.58), v3(sx * 0.04, 1, 0.1), -0.12);
    const knee = rig.pos(`LowerLeg.${s}`);
    rig.arm(s, hip.clone().lerp(knee, 0.75).add(v3(sx * 0.05, 0.1, 0)), v3(sx * 0.6, -0.5, -0.6));
  }
  rig.turn('Head', 0.04 * breathe, 0, 0);
}

function writeClip(doc, buffer, nodes, { name, tracks }) {
  const anim = doc.createAnimation(name);
  const inputs = new Map();
  for (const t of tracks.map(thin)) {
    const key = t.times.join();
    if (!inputs.has(key)) inputs.set(key, doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(new Float32Array(t.times)).setBuffer(buffer));
    const rot = t.path === 'rotation';
    const out = doc
      .createAccessor()
      .setType(rot ? Accessor.Type.VEC4 : Accessor.Type.VEC3)
      .setArray(rot ? Int16Array.from(t.values, (v) => Math.round(v * 32767)) : new Float32Array(t.values))
      .setNormalized(rot)
      .setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(inputs.get(key)).setOutput(out).setInterpolation('LINEAR');
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(nodes.get(t.node)).setTargetPath(t.path).setSampler(sampler));
  }
}

for (const gender of Object.keys(PARTS)) {
  rmSync(join(OUT, gender), { recursive: true, force: true });
  mkdirSync(join(OUT, gender), { recursive: true });
  await buildBase(gender);
  await buildParts(gender);
}
