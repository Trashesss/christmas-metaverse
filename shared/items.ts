export const KINDS = ['cake', 'tree'] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = { cake: '케이크', tree: '트리' };
export const KIND_EMOJI: Record<Kind, string> = { cake: '🎂', tree: '🎄' };

/** stand: 윗면에만 세움 · normal: 표면을 따라 붙임 · hang: 옆면에 매닮 · topper: 트리 꼭대기 고정 */
export type Mount = 'stand' | 'normal' | 'hang' | 'topper';
export interface ItemDef {
  id: string;
  label: string;
  emoji: string;
  mount: Mount;
  tint: boolean;
}

export const ITEMS: Record<Kind, ItemDef[]> = {
  cake: [
    { id: 'strawberry', label: '딸기', emoji: '🍓', mount: 'normal', tint: false },
    { id: 'cream', label: '생크림', emoji: '🍦', mount: 'normal', tint: true },
    { id: 'candle', label: '초', emoji: '🕯️', mount: 'stand', tint: true },
    { id: 'cookie', label: '진저쿠키', emoji: '🍪', mount: 'stand', tint: false },
    { id: 'snowman', label: '눈사람', emoji: '⛄', mount: 'stand', tint: true },
    { id: 'cane', label: '지팡이사탕', emoji: '🍭', mount: 'stand', tint: true },
    { id: 'choco', label: '초코볼', emoji: '🟤', mount: 'normal', tint: true },
    { id: 'minitree', label: '미니트리', emoji: '🌲', mount: 'stand', tint: false },
  ],
  tree: [
    { id: 'ball', label: '오너먼트', emoji: '🔴', mount: 'hang', tint: true },
    { id: 'bulb', label: '전구', emoji: '💡', mount: 'hang', tint: true },
    { id: 'bell', label: '종', emoji: '🔔', mount: 'hang', tint: false },
    { id: 'ribbon', label: '리본', emoji: '🎀', mount: 'hang', tint: true },
    { id: 'cane', label: '지팡이사탕', emoji: '🍭', mount: 'hang', tint: true },
    { id: 'cookie', label: '진저쿠키', emoji: '🍪', mount: 'hang', tint: false },
    { id: 'gift', label: '선물', emoji: '🎁', mount: 'hang', tint: true },
    { id: 'star', label: '꼭대기 별', emoji: '⭐', mount: 'topper', tint: true },
  ],
};

export const COLORS = ['#e5484d', '#f5b83d', '#3fa66b', '#4c8fe0', '#b07be0', '#fff6ec'] as const;
export const BASES: Record<Kind, { label: string; color: string; accent: string }[]> = {
  cake: [
    { label: '바닐라', color: '#fff0d6', accent: '#ffffff' },
    { label: '딸기', color: '#f7b6c2', accent: '#fff3f5' },
    { label: '초코', color: '#70452f', accent: '#f3dfc8' },
    { label: '민트', color: '#a9dcc8', accent: '#ffffff' },
  ],
  tree: [
    { label: '초록', color: '#2f7d55', accent: '#eef7ff' },
    { label: '짙은 숲', color: '#1f5a4a', accent: '#dcecf5' },
    { label: '은백', color: '#b9d3dc', accent: '#ffffff' },
    { label: '분홍', color: '#e79ab0', accent: '#fff2f6' },
  ],
};

export const CAKE_TIERS = [
  { r: 1.65, h: 0.85, y: 0 },
];
export const CAKE_TOP = 0.85;
/** 테두리 크림 안쪽, 그림을 그릴 수 있는 반지름 */
export const PAINT_RADIUS = 1.5;
export const TREE_CONES = [
  { r: 1.5, h: 1.5, y: 0.4 },
  { r: 1.2, h: 1.3, y: 1.3 },
  { r: 0.9, h: 1.2, y: 2.1 },
  { r: 0.6, h: 1.0, y: 2.85 },
];
export const TREE_TOP = 3.85;
export const MAX_DECOS = 60;

export const findItem = (kind: Kind, id: string) => ITEMS[kind].find((i) => i.id === id);
