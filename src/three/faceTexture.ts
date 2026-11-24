import * as THREE from 'three';
import { EYE_COLORS, HAIR_COLORS, LIP_COLORS, SKIN_COLORS, type Look } from '../../shared/look';

// 얼굴 그림의 좌표는 1이 1mm다. 220×220이 얼굴 앞면 한 장이다.
const SPAN = 220;
const EYE = { x: 42, y: 86 };
const MOUTH_Y = 160;
const INK = '#33241f';

const hsl = { h: 0, s: 0, l: 0 };
const luminance = (hex: string) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** 피부와 비슷해 보이지 않을 때까지 밝히거나 어둡게 한다. */
function readable(hex: string, skin: string, ratio: number) {
  let out = hex;
  const step = luminance(skin) > 0.12 ? -0.04 : 0.04;
  for (let i = 0; i < 14 && contrast(out, skin) < ratio; i++) {
    const c = new THREE.Color(out);
    c.getHSL(hsl, THREE.SRGBColorSpace);
    out = `#${c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + step, 0.05, 0.9), THREE.SRGBColorSpace).getHexString()}`;
  }
  return out;
}

const mix = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

export function drawFace(canvas: HTMLCanvasElement, look: Look) {
  const ctx = canvas.getContext('2d')!;
  const skin = SKIN_COLORS[look.skin].color;
  ctx.setTransform(canvas.width / SPAN, 0, 0, canvas.height / SPAN, 0, 0);
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, SPAN, SPAN);
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(SPAN / 2 + side * EYE.x, EYE.y);
    ctx.scale(side * 1.22, 1.22);
    blush(ctx, luminance(skin) < 0.12 ? 0.2 : 0.32);
    eye(ctx, look, skin);
    brow(ctx, readable(mix(HAIR_COLORS[look.hairColor].color, skin, 0.35), skin, 1.5));
    ctx.restore();
  }
  ctx.save();
  ctx.translate(SPAN / 2, MOUTH_Y);
  mouth(ctx, look.lips, readable(mix(LIP_COLORS[look.lipColor].color, skin, 0.15), skin, 1.6));
  ctx.restore();
}

// 아래 함수들은 오른쪽(+x가 바깥쪽)만 그리고, 왼쪽은 뒤집어 쓴다.
function blush(ctx: CanvasRenderingContext2D, alpha: number) {
  const g = ctx.createRadialGradient(10, 27, 0, 10, 27, 14);
  g.addColorStop(0, `rgba(235, 110, 105, ${alpha})`);
  g.addColorStop(1, 'rgba(235, 110, 105, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-6, 12, 32, 30);
}

/** 바깥쪽이 살짝 처진 부드러운 눈썹 */
function brow(ctx: CanvasRenderingContext2D, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(-9, -26);
  ctx.quadraticCurveTo(4, -31, 14, -24.5);
  ctx.stroke();
}

function eye(ctx: CanvasRenderingContext2D, { eyes, eyeColor }: Look, skin: string) {
  const color = EYE_COLORS[eyeColor].color;
  const dark = luminance(skin) < 0.12;
  const oval = (x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  /** 위는 짙고 아래는 밝은 눈동자. 빛 두 점이 생기를 준다. */
  const iris = (rx: number, ry: number, y = 0) => {
    const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    g.addColorStop(0, mix(color, INK, 0.75));
    g.addColorStop(0.55, color);
    g.addColorStop(1, mix(color, '#ffffff', 0.45));
    oval(0, y, rx, ry, INK);
    oval(0, y, rx - 1, ry - 1, g);
    oval(0, y - ry * 0.08, rx * 0.48, ry * 0.52, INK);
    oval(rx * 0.32, y - ry * 0.42, rx * 0.34, ry * 0.3, '#fff');
    oval(-rx * 0.35, y + ry * 0.45, rx * 0.17, ry * 0.15, '#ffffffcc');
  };
  const line = (width: number, stroke: string, path: () => void) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    path();
    ctx.stroke();
  };
  const white = (path: () => void) => {
    ctx.beginPath();
    path();
    ctx.fillStyle = '#fffdf8';
    ctx.fill();
    ctx.save();
    ctx.clip();
  };
  const ellipse = (rx: number, ry: number, from = 0, to = 2) => ctx.ellipse(0, 0, rx, ry, 0, Math.PI * from, Math.PI * to);
  switch (eyes) {
    case 'round':
      white(() => ellipse(13.5, 15.5));
      iris(11.5, 13.5, 0.8);
      ctx.restore();
      return line(2.8, INK, () => ellipse(13.5, 15.5, 1.06, 1.94));
    case 'almond':
      white(() => {
        ctx.moveTo(-15, 4);
        ctx.quadraticCurveTo(-9, -13, 4, -12);
        ctx.quadraticCurveTo(13, -10, 16, 0);
        ctx.quadraticCurveTo(8, 12, -2, 12);
        ctx.quadraticCurveTo(-11, 11, -15, 4);
      });
      iris(10.5, 12, -0.5);
      ctx.restore();
      return line(2.8, INK, () => {
        ctx.moveTo(-15, 4);
        ctx.quadraticCurveTo(-9, -13, 4, -12);
        ctx.quadraticCurveTo(13, -10, 17, 0);
      });
    case 'sparkle':
      white(() => ellipse(14.5, 17));
      iris(13, 15.5, 0.8);
      oval(-5, -6, 2, 2, '#fff');
      ctx.restore();
      line(3, INK, () => ellipse(14.5, 17, 1.06, 1.94));
      return line(2.4, INK, () => {
        ctx.moveTo(12.5, -8.5);
        ctx.lineTo(17.5, -12);
        ctx.moveTo(14, -4);
        ctx.lineTo(19, -5.5);
      });
    case 'dot':
      oval(0, 0, 10.2, 12.7, dark ? '#fffdf8' : INK);
      oval(0, 0, 9, 11.5, mix(color, INK, 0.55));
      oval(2.8, -4.6, 3.2, 3.6, '#fff');
      return oval(-2.8, 5, 1.6, 1.6, '#ffffffbb');
    case 'sleepy':
      white(() => {
        ctx.moveTo(-14, -1);
        ctx.quadraticCurveTo(0, -8, 14, -1);
        ctx.quadraticCurveTo(12, 13, 0, 13);
        ctx.quadraticCurveTo(-12, 13, -14, -1);
      });
      iris(11, 12.5, 2);
      ctx.restore();
      return line(3.2, INK, () => {
        ctx.moveTo(-15, 0);
        ctx.quadraticCurveTo(0, -8.5, 15.5, 1);
      });
    case 'smile':
      return line(4, dark ? readable(color, skin, 3.4) : mix(color, INK, 0.5), () => {
        ctx.moveTo(-13, 5);
        ctx.quadraticCurveTo(0, -14, 13, 5);
      });
  }
}

function mouth(ctx: CanvasRenderingContext2D, lips: Look['lips'], color: string) {
  const shade = `#${new THREE.Color(color).multiplyScalar(0.45).getHexString()}`;
  const path = (d: string) => new Path2D(d);
  const fill = (d: string, style = color) => {
    ctx.fillStyle = style;
    ctx.fill(path(d));
  };
  const stroke = (d: string, width: number, style = color) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke(path(d));
  };
  switch (lips) {
    case 'smile':
      return stroke('M-13 -3 Q0 9 13 -3', 4);
    case 'natural':
      fill('M-13 -1 Q-6 -6 -2.5 -5 Q0 -3.5 2.5 -5 Q6 -6 13 -1 Q0 10 -13 -1 Z');
      return stroke('M-11 -1 Q0 3.5 11 -1', 1.6, shade);
    case 'full':
      fill('M-15 -2 Q-8 -9 -3.5 -7.5 Q0 -5.5 3.5 -7.5 Q8 -9 15 -2 Q9 10 0 10 Q-9 10 -15 -2 Z');
      stroke('M-13 -2 Q0 4 13 -2', 1.8, shade);
      return stroke('M-3.5 6 Q0 7 3.5 6', 1.8, '#ffffff66');
    case 'grin':
      fill('M-16 -6 Q0 -2 16 -6 Q13 11 0 11 Q-13 11 -16 -6 Z', shade);
      fill('M-13 -4.5 Q0 -1.5 13 -4.5 Q12 0 0 1.5 Q-12 0 -13 -4.5 Z', '#fffdf8');
      fill('M-8 8.5 Q0 2 8 8.5 Q0 12 -8 8.5 Z', '#e98a86');
      return stroke('M-16 -6 Q0 -2 16 -6 Q13 11 0 11 Q-13 11 -16 -6 Z', 2.4);
    case 'pout':
      fill('M-8 -1 Q-5 -6.5 0 -3.5 Q5 -6.5 8 -1 Q6 7 0 7 Q-6 7 -8 -1 Z');
      return stroke('M-6 -0.5 Q0 2.5 6 -0.5', 1.6, shade);
    case 'cat':
      return stroke('M-14 -3 Q-12 5 -7 5 Q-1.5 5 0 -2 Q1.5 5 7 5 Q12 5 14 -3', 3.4);
    case 'flat':
      return stroke('M-9 0 Q0 1.5 9 0', 4);
  }
}
