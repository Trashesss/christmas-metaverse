import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CAKE_TOP, PAINT_RADIUS } from '../../shared/items';
import { PAINT_COLORS, SIZES, type Stroke } from '../../shared/paint';
import { PaintLayer } from './PaintLayer';
import { loadFonts, noise, scatter } from './drawPaint';

const noRaycast = () => null;

/** 케이크 윗면 그림. 펜과 시럽은 텍스처로, 크림과 스프링클은 입체로 올린다. */
export const CakePaint = memo(function CakePaint({ strokes, resolution = 512 }: { strokes: Stroke[]; resolution?: number }) {
  const layer = useMemo(() => new PaintLayer(resolution), [resolution]);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(layer.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [layer]);
  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    let live = true;
    const draw = () => {
      layer.draw(strokes);
      texture.needsUpdate = true;
    };
    // 한 프레임에 여러 점이 들어와도 한 번만 그린다.
    const frame = requestAnimationFrame(draw);
    void loadFonts(strokes).then((loaded) => {
      if (!loaded) return;
      layer.invalidate();
      if (live) draw();
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [texture, layer, strokes]);

  return (
    <group position-y={CAKE_TOP}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} receiveShadow raycast={noRaycast}>
        <circleGeometry args={[PAINT_RADIUS, 64]} />
        <meshStandardMaterial map={texture} transparent roughness={0.4} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <Cream strokes={strokes} />
      <Sprinkles strokes={strokes} />
    </group>
  );
});

interface Piece {
  x: number;
  z: number;
  size: number;
  color: string;
  turn: number;
}

const pieceCache = new WeakMap<Stroke, Piece[]>();

/** 획 객체는 바뀔 때마다 새로 만들어지므로 그대로인 획의 조각은 다시 계산하지 않는다. */
function piecesOf(strokes: Stroke[], tool: Stroke['tool'], build: (s: Stroke) => Piece[]) {
  return strokes.flatMap((s) => {
    if (s.tool !== tool) return [];
    let pieces = pieceCache.get(s);
    if (!pieces) pieceCache.set(s, (pieces = build(s)));
    return pieces;
  });
}

function creamPieces(s: Stroke) {
  const out: Piece[] = [];
  const size = SIZES[s.size] * 1.25;
  const gap = size * 0.75;
  let next = 0;
  let turn = 0;
  const put = (x: number, z: number) => out.push({ x, z, size, color: PAINT_COLORS[s.color], turn: turn++ });
  if (s.pts.length === 2) put(s.pts[0], s.pts[1]);
  for (let i = 0; i + 3 < s.pts.length; i += 2) {
    const [ax, az, bx, bz] = s.pts.slice(i, i + 4);
    const len = Math.hypot(bx - ax, bz - az);
    while (next <= len) {
      const t = len ? next / len : 0;
      put(ax + (bx - ax) * t, az + (bz - az) * t);
      next += gap;
    }
    next -= len;
  }
  return out;
}

function Cream({ strokes }: { strokes: Stroke[] }) {
  const pieces = useMemo(() => piecesOf(strokes, 'cream', creamPieces), [strokes]);
  return (
    <Pieces
      pieces={pieces}
      geometry={<sphereGeometry args={[1, 9, 6]} />}
      place={(o, p) => {
        const r = p.size * PAINT_RADIUS;
        // 짤주머니로 짠 결처럼 높이를 번갈아 준다.
        o.position.set(p.x * PAINT_RADIUS, r * 0.35, p.z * PAINT_RADIUS);
        o.rotation.set(0, p.turn, 0);
        o.scale.set(r, r * (p.turn % 2 ? 0.8 : 0.95), r);
      }}
    />
  );
}

function sprinklePieces(s: Stroke) {
  const out: Piece[] = [];
  scatter(s, 2, 3.2, (x, z, i) =>
    out.push({ x, z, size: 0.016, color: PAINT_COLORS[(s.color + Math.floor(noise(i, 9) * 5)) % PAINT_COLORS.length], turn: noise(i, 4) * 6 }),
  );
  return out;
}

function Sprinkles({ strokes }: { strokes: Stroke[] }) {
  const pieces = useMemo(() => piecesOf(strokes, 'sprinkle', sprinklePieces), [strokes]);
  return (
    <Pieces
      pieces={pieces}
      geometry={<capsuleGeometry args={[0.7, 2.4, 2, 6]} />}
      place={(o, p) => {
        o.position.set(p.x * PAINT_RADIUS, 0.02, p.z * PAINT_RADIUS);
        o.rotation.set(0, p.turn, Math.PI / 2);
        o.scale.setScalar(p.size);
      }}
    />
  );
}

const dummy = new THREE.Object3D();
const tint = new THREE.Color();

/** 그리는 동안 개수가 계속 늘어나므로 용량은 두 배씩만 다시 잡는다. */
function Pieces({ pieces, geometry, place }: { pieces: Piece[]; geometry: React.ReactNode; place: (o: THREE.Object3D, p: Piece) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const drawn = useRef<{ mesh: THREE.InstancedMesh; pieces: Piece[] } | null>(null);
  const capacity = pieces.length && 2 ** Math.ceil(Math.log2(Math.max(64, pieces.length)));
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const prev = drawn.current?.mesh === mesh ? drawn.current.pieces : [];
    drawn.current = { mesh, pieces };
    pieces.forEach((p, i) => {
      if (p === prev[i]) return;
      place(dummy, p);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.set(p.color));
    });
    mesh.count = pieces.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pieces, capacity]);
  if (!capacity) return null;
  return (
    <instancedMesh key={capacity} ref={ref} args={[undefined, undefined, capacity]} raycast={noRaycast} frustumCulled={false}>
      {geometry}
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}
