/** 레터링 케이크 윗면에 그리는 재료. 좌표는 윗면 반지름을 1로 둔 [x, z]이다. */
export const TOOLS = [
  { id: 'pen', label: '레터링펜', emoji: '🖊️' },
  { id: 'text', label: '글자', emoji: '가' },
  { id: 'cream', label: '짤크림', emoji: '🍦' },
  { id: 'jam', label: '시럽', emoji: '🍯' },
  { id: 'sprinkle', label: '스프링클', emoji: '🎊' },
  { id: 'glitter', label: '금가루', emoji: '✨' },
  { id: 'powder', label: '슈가파우더', emoji: '❄️' },
] as const;
export const TOOL_IDS = TOOLS.map((t) => t.id) as [ToolId, ...ToolId[]];
export type ToolId = (typeof TOOLS)[number]['id'];

export const PAINT_COLORS = [
  '#4a2b20', '#d6353f', '#f27f9b', '#f5903d', '#f5c93d', '#4aa564',
  '#4c8fe0', '#7b5cd0', '#b98a5e', '#8fd0d6', '#ffffff', '#2b2f45',
] as const;
export const FONTS = [
  { label: '동글체', family: 'Jua' },
  { label: '손글씨', family: 'Gaegu' },
] as const;
export const SIZES = [0.025, 0.045, 0.08] as const;
export const TEXT_SIZES = [0.2, 0.3, 0.45] as const;

export const MAX_TEXT = 14;
export const MAX_STROKES = 300;
export const MAX_POINTS = 8000;
/** 한 획의 좌표 수. 넘으면 화면에서 새 획으로 이어 그린다. */
export const MAX_STROKE_POINTS = 400;
export const MAX_CHUNK = 64;
export const MAX_GALLERY = 30;

export interface Stroke {
  id: string;
  by: string;
  tool: ToolId;
  color: number;
  size: number;
  /** [x0, z0, x1, z1, ...] */
  pts: number[];
  text?: string;
  font?: number;
}
