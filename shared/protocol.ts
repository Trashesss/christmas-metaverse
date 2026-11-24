import { z } from 'zod';
import { FONTS, MAX_CHUNK, MAX_TEXT, PAINT_COLORS, SIZES, TOOL_IDS, type Stroke } from './paint';
import { COLORS, KINDS, type Kind } from './items';

export const CHARACTERS = ['Barbarian', 'Knight', 'Mage', 'Rogue'] as const;
export type Character = (typeof CHARACTERS)[number];
// 로비에서 아바타 외형을 고르는 용도로만 쓴다. 서버로 보내거나 다른 사람에게 보이지 않는다.
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];
export const CHARACTERS_BY_GENDER: Record<Gender, readonly Character[]> = {
  male: ['Barbarian', 'Knight'],
  female: ['Mage', 'Rogue'],
};
export const EMOTES = ['wave', 'cheer', 'jump', 'sit', 'laugh', 'snow'] as const;
export type Emote = (typeof EMOTES)[number];

export const MAX_CHAT = 120;
export const MAX_NOTE = 200;
export const MAX_NOTES = 50;

const num = z.number().finite();
const vec3 = z.tuple([num, num, num]);
const kind = z.enum(KINDS);
const color = z.number().int().min(0).max(COLORS.length - 1);
const pts = z.array(num.min(-1).max(1)).min(2).max(MAX_CHUNK * 2);
const index = (list: readonly unknown[]) => z.number().int().min(0).max(list.length - 1);
const id = z.string().max(40);
const ref = z.number().int().nonnegative();

export const clientMessage = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('join'),
    name: z.string().trim().min(1).max(12),
    character: z.enum(CHARACTERS),
    color,
  }),
  z.object({ t: z.literal('move'), x: num, z: num, ry: num, moving: z.boolean() }),
  z.object({ t: z.literal('chat'), text: z.string().trim().min(1).max(MAX_CHAT), session: id.nullable() }),
  z.object({ t: z.literal('whisper'), ref, to: id, text: z.string().trim().min(1).max(MAX_CHAT) }),
  z.object({ t: z.literal('note'), ref, to: id, text: z.string().trim().min(1).max(MAX_NOTE) }),
  z.object({ t: z.literal('deleteNote'), id }),
  z.object({ t: z.literal('emote'), emote: z.enum(EMOTES) }),
  z.object({ t: z.literal('wait'), kind: kind.nullable() }),
  z.object({ t: z.literal('joinWaiting'), host: id }),
  z.object({ t: z.literal('invite'), to: id, kind }),
  z.object({ t: z.literal('reply'), from: id, accept: z.boolean() }),
  z.object({ t: z.literal('mute'), id, on: z.boolean() }),
  z.object({ t: z.literal('place'), item: z.string().max(20), color, p: vec3, n: vec3 }),
  z.object({ t: z.literal('remove'), id }),
  z.object({
    t: z.literal('stroke'),
    id,
    tool: z.enum(TOOL_IDS),
    color: index(PAINT_COLORS),
    size: index(SIZES),
    pts,
    text: z.string().trim().min(1).max(MAX_TEXT).optional(),
    font: index(FONTS).optional(),
  }),
  z.object({ t: z.literal('strokeMore'), id, pts }),
  z.object({ t: z.literal('unstroke'), id }),
  z.object({ t: z.literal('gallery') }),
  z.object({ t: z.literal('base'), base: z.number().int().min(0).max(3) }),
  z.object({ t: z.literal('cursor'), p: vec3.nullable() }),
  z.object({ t: z.literal('ready'), on: z.boolean() }),
  z.object({ t: z.literal('leaveSession') }),
]);
export type ClientMessage = z.infer<typeof clientMessage>;

export interface PlayerState {
  id: string;
  name: string;
  character: Character;
  color: number;
  x: number;
  z: number;
  ry: number;
  moving: boolean;
  activity: Kind | null;
  waiting: Kind | null;
}
export type Vec3 = [number, number, number];
export interface Deco {
  id: string;
  item: string;
  color: number;
  by: string;
  p: Vec3;
  n: Vec3;
}
export interface SessionState {
  id: string;
  kind: Kind;
  base: number;
  decos: Deco[];
  strokes: Stroke[];
  members: string[];
  ready: string[];
}
export interface Exhibit {
  id: string;
  /** 같은 종류 안에서의 전시대 번호 */
  slot: number;
  kind: Kind;
  base: number;
  decos: Deco[];
  strokes: Stroke[];
  names: string[];
}
/** name은 보낸 순간의 닉네임이다. 나간 사람의 닉네임을 다른 사람이 쓸 수 있다. */
export interface StoredNote {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
}

export type ServerMessage =
  | { t: 'joinRejected'; reason: 'taken' | 'invalid' }
  | { t: 'welcome'; id: string; players: PlayerState[]; exhibits: Exhibit[] }
  | { t: 'player'; player: PlayerState }
  | { t: 'gone'; id: string }
  | { t: 'moves'; moves: [string, number, number, number, boolean][] }
  | { t: 'chat'; from: string; text: string }
  | { t: 'whisper'; from: string; text: string }
  | { t: 'note'; note: StoredNote }
  | { t: 'noteDeleted'; id: string }
  | { t: 'sent'; ref: number; result: 'ok' | 'slow' | 'gone' }
  | { t: 'emote'; from: string; emote: Emote }
  | { t: 'invite'; from: string; kind: Kind }
  | { t: 'session'; session: SessionState }
  | { t: 'sessionMeta'; base: number; members: string[]; ready: string[] }
  | { t: 'stroke'; stroke: Stroke }
  | { t: 'strokeMore'; id: string; pts: number[] }
  | { t: 'unstroke'; id: string }
  | { t: 'gallery'; cakes: Exhibit[] }
  | { t: 'deco'; deco: Deco }
  | { t: 'undeco'; id: string }
  | { t: 'cursor'; p: Vec3 | null }
  | { t: 'sessionEnd'; finished: boolean }
  | { t: 'exhibits'; exhibits: Exhibit[] }
  | { t: 'notice'; text: string };
