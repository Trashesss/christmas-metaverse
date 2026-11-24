import { FONTS, PAINT_COLORS, SIZES, TEXT_SIZES, type Stroke } from '../../shared/paint';

/** 획마다 항상 같은 모양이 나오도록 좌표에서 난수를 만든다. */
export function noise(i: number, salt: number) {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export const fontOf = (s: Stroke, px: number) => `${px}px ${FONTS[s.font ?? 0].family}`;

/** 케이크 윗면 한 장을 그린다. flat이면 3D로 올리는 크림과 스프링클도 평면으로 그린다. */
export function clipToCake(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = ctx.lineJoin = 'round';
}

export function drawPaint(ctx: CanvasRenderingContext2D, size: number, strokes: Stroke[], flat = false) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  clipToCake(ctx, size);
  for (const s of strokes) drawStroke(ctx, size / 2, s, flat);
  ctx.restore();
}

export function drawStroke(ctx: CanvasRenderingContext2D, R: number, s: Stroke, flat: boolean) {
  const color = PAINT_COLORS[s.color];
  const w = SIZES[s.size] * R;
  ctx.save();
  switch (s.tool) {
    case 'pen':
      line(ctx, R, s, color, w, 0.3);
      shine(ctx, R, s, w);
      break;
    case 'jam':
      ctx.globalAlpha = 0.82;
      line(ctx, R, s, color, w * 2.4, 0.25);
      ctx.globalAlpha = 1;
      shine(ctx, R, s, w * 2.2);
      break;
    case 'cream':
      if (flat) line(ctx, R, s, color, w * 2.2, 0.3);
      break;
    case 'sprinkle':
      if (flat) specks(ctx, R, s, 2, 3.2, (i) => PAINT_COLORS[(s.color + Math.floor(noise(i, 9) * 5)) % PAINT_COLORS.length], w * 0.3);
      break;
    case 'glitter':
      specks(ctx, R, s, 7, 3.2, (i) => ['#f6d365', '#d9a520', '#fff3b8', color][Math.floor(noise(i, 5) * 4)], w * 0.11);
      break;
    case 'powder':
      ctx.globalAlpha = 0.5;
      specks(ctx, R, s, 14, 5, () => color, w * 0.1);
      break;
    case 'text':
      lettering(ctx, R, s, color);
  }
  ctx.restore();
}

function trace(ctx: CanvasRenderingContext2D, R: number, { pts }: Stroke) {
  const at = (i: number): [number, number] => [(pts[i] + 1) * R, (pts[i + 1] + 1) * R];
  ctx.beginPath();
  ctx.moveTo(...at(0));
  for (let i = 2; i < pts.length - 2; i += 2) {
    const [x, y] = at(i);
    const [nx, ny] = at(i + 2);
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.lineTo(...at(pts.length - 2));
}

function line(ctx: CanvasRenderingContext2D, R: number, s: Stroke, color: string, width: number, shadow: number) {
  trace(ctx, R, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = `rgba(40,20,10,${shadow})`;
  ctx.shadowBlur = width * 0.35;
  ctx.shadowOffsetY = width * 0.22;
  ctx.stroke();
  ctx.shadowColor = 'transparent';
}

function shine(ctx: CanvasRenderingContext2D, R: number, s: Stroke, width: number) {
  ctx.translate(-width * 0.1, -width * 0.2);
  trace(ctx, R, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = width * 0.22;
  ctx.stroke();
}

function specks(ctx: CanvasRenderingContext2D, R: number, s: Stroke, per: number, spread: number, color: (i: number) => string, radius: number) {
  scatter(s, per, spread, (x, z, i) => {
    ctx.fillStyle = color(i);
    ctx.beginPath();
    ctx.arc((x + 1) * R, (z + 1) * R, radius * (0.6 + noise(i, 7)), 0, Math.PI * 2);
    ctx.fill();
  });
}

/** 획을 따라 주변에 알갱이를 흩뿌린다. 원 밖으로 나간 것은 버린다. */
export function scatter(s: Stroke, per: number, spread: number, put: (x: number, z: number, i: number) => void) {
  const r = SIZES[s.size] * spread;
  for (let p = 0; p < s.pts.length; p += 2) {
    for (let k = 0; k < per; k++) {
      const i = (p / 2) * per + k;
      const salt = s.pts[p] * 13 + s.pts[p + 1] * 29;
      const a = noise(i, salt) * Math.PI * 2;
      const d = Math.sqrt(noise(i, salt + 3)) * r;
      const x = s.pts[p] + Math.cos(a) * d;
      const z = s.pts[p + 1] + Math.sin(a) * d;
      if (Math.hypot(x, z) < 0.99) put(x, z, i);
    }
  }
}

function lettering(ctx: CanvasRenderingContext2D, R: number, s: Stroke, color: string) {
  let px = TEXT_SIZES[s.size] * R;
  const text = s.text ?? '';
  ctx.font = fontOf(s, px);
  const max = R * 1.75;
  const width = ctx.measureText(text).width;
  if (width > max) px *= max / width;
  ctx.font = fontOf(s, px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = (s.pts[0] + 1) * R;
  const y = (s.pts[1] + 1) * R;
  ctx.shadowColor = 'rgba(40,20,10,0.3)';
  ctx.shadowBlur = px * 0.06;
  ctx.shadowOffsetY = px * 0.04;
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = px * 0.06;
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.fillText(text, x, y);
}

const fontsReady = new Set<string>();
const fontKey = (s: Stroke) => `${s.font}:${s.text}`;

/** 새로 준비된 글꼴이 있어 다시 그려야 하면 true. 실패해도 기본 글꼴로 그린다. */
export async function loadFonts(strokes: Stroke[]) {
  const texts = strokes.filter((s) => s.text && !fontsReady.has(fontKey(s)));
  await Promise.allSettled(texts.map((s) => document.fonts.load(fontOf(s, 40), s.text)));
  texts.forEach((s) => fontsReady.add(fontKey(s)));
  return texts.length > 0;
}
