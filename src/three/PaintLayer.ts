import type { Stroke } from '../../shared/paint';
import { clipToCake, drawStroke } from './drawPaint';

const SETTLE_MS = 1500;

function context(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return canvas.getContext('2d')!;
}

/** 한동안 바뀌지 않은 획은 따로 구워 두고, 그리는 중인 획만 매번 다시 그린다. */
export class PaintLayer {
  private top: CanvasRenderingContext2D;
  private baked: CanvasRenderingContext2D;
  private bakedStrokes: Stroke[] = [];
  private seen = new Map<string, { stroke: Stroke; at: number }>();
  private first = true;

  constructor(private size: number) {
    this.top = context(size);
    this.baked = context(size);
    clipToCake(this.top, size);
    clipToCake(this.baked, size);
  }

  get canvas() {
    return this.top.canvas;
  }

  invalidate() {
    this.baked.clearRect(0, 0, this.size, this.size);
    this.bakedStrokes = [];
  }

  draw(strokes: Stroke[]) {
    const now = performance.now();
    const seen = new Map<string, { stroke: Stroke; at: number }>();
    for (const s of strokes) {
      const old = this.seen.get(s.id);
      seen.set(s.id, old?.stroke === s ? old : { stroke: s, at: this.first ? -Infinity : now });
    }
    this.seen = seen;
    this.first = false;

    if (this.bakedStrokes.some((s, i) => strokes[i] !== s)) this.invalidate();
    let n = this.bakedStrokes.length;
    while (n < strokes.length && now - seen.get(strokes[n].id)!.at > SETTLE_MS) {
      drawStroke(this.baked, this.size / 2, strokes[n], false);
      this.bakedStrokes.push(strokes[n++]);
    }
    this.top.clearRect(0, 0, this.size, this.size);
    this.top.drawImage(this.baked.canvas, 0, 0);
    for (; n < strokes.length; n++) drawStroke(this.top, this.size / 2, strokes[n], false);
  }
}
