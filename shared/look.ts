import { z } from 'zod';

export interface Option {
  id: string;
  label: string;
}
interface Swatch {
  label: string;
  color: string;
}
const swatches = (...list: [string, string][]): Swatch[] => list.map(([label, color]) => ({ label, color }));
const option = <T extends string>(id: T, label: string) => ({ id, label });

// 몸 종류는 아바타 모양일 뿐이다. 다른 사람에게 글자로 보이거나 짝을 찾는 데 쓰지 않는다.
export const BODIES = ['male', 'female'] as const;
export type Body = (typeof BODIES)[number];
export const BODY_LABEL: Record<Body, string> = { male: '남', female: '여' };

/** 파일이 있는 부품. bald와 buzz는 머리 모델의 머리 덮개 색만 바꾼다. */
export const PARTS = {
  male: {
    hair: [
      option('swept', '뒤로 넘긴'),
      option('side', '옆가르마'),
      option('layered', '덮은 머리'),
      option('spiky', '세운 머리'),
      option('tied', '묶은 머리'),
      option('mohawk', '모히칸'),
      option('buzz', '짧은 머리'),
      option('bald', '없음'),
    ],
    top: [
      option('hoodie', '후드티'),
      option('tee', '티셔츠'),
      option('shirt', '셔츠'),
      option('suit', '정장'),
      option('overall', '멜빵'),
      option('worker', '작업 조끼'),
      option('vest', '가죽 조끼'),
      option('tank', '민소매'),
    ],
    bottom: [
      option('jeans', '청바지'),
      option('slacks', '정장 바지'),
      option('cargo', '주머니 바지'),
      option('baggy', '넉넉한 바지'),
      option('ripped', '찢은 바지'),
      option('shorts', '반바지'),
      option('sporty', '줄무늬 반바지'),
    ],
    shoes: [
      option('sneakers', '스니커즈'),
      option('runners', '운동화'),
      option('boots', '부츠'),
      option('farmer', '작업화'),
      option('dress', '구두'),
      option('sandals', '슬리퍼'),
    ],
  },
  female: {
    hair: [
      option('bob', '단발'),
      option('tied', '묶은 머리'),
      option('straight', '곧은 머리'),
      option('short', '짧은 커트'),
      option('mohawk', '모히칸'),
      option('buzz', '아주 짧은'),
      option('bald', '없음'),
    ],
    top: [
      option('tee', '티셔츠'),
      option('sleeveless', '민소매'),
      option('suit', '정장'),
      option('tunic', '튜닉'),
      option('layered', '겹쳐 입기'),
      option('leather', '가죽 조끼'),
      option('worker', '작업 조끼'),
    ],
    bottom: [
      option('slim', '슬림 바지'),
      option('slacks', '정장 바지'),
      option('cargo', '주머니 바지'),
      option('skirt', '치마'),
      option('tiered', '레깅스 치마'),
      option('wide', '통바지'),
      option('shorts', '반바지'),
    ],
    shoes: [
      option('loafers', '단화'),
      option('flats', '플랫'),
      option('ankle', '앵클부츠'),
      option('boots', '장화'),
      option('long', '롱부츠'),
      option('platform', '통굽 부츠'),
    ],
  },
} as const;
export type PartKind = keyof (typeof PARTS)[Body];

export const FACES = [option('basic', '기본'), option('round', '동그란'), option('slim', '갸름한')] as const;
export const EYES = [
  option('round', '동그란'),
  option('almond', '또렷한'),
  option('sparkle', '반짝이는'),
  option('dot', '콩알'),
  option('sleepy', '나른한'),
  option('smile', '웃는'),
] as const;
export const LIPS = [
  option('smile', '미소'),
  option('natural', '자연스러운'),
  option('full', '도톰한'),
  option('grin', '활짝'),
  option('pout', '앵두'),
  option('cat', '고양이'),
  option('flat', '담담한'),
] as const;

export const SKIN_COLORS = swatches(
  ['아주 밝은 톤', '#ffdcc6'],
  ['밝은 분홍 톤', '#f8cdb6'],
  ['밝은 노랑 톤', '#f5cda4'],
  ['복숭아 톤', '#efbf9b'],
  ['베이지 톤', '#e3ae82'],
  ['꿀 톤', '#d1965f'],
  ['황갈색 톤', '#b97d50'],
  ['갈색 톤', '#9c643f'],
  ['밤색 톤', '#8a5537'],
  ['짙은 갈색 톤', '#70452f'],
  ['초콜릿 톤', '#5c3828'],
  ['아주 짙은 톤', '#472b20'],
);
export const HAIR_COLORS = swatches(
  ['검정', '#2a2528'],
  ['흑갈색', '#3f2a22'],
  ['갈색', '#6b4226'],
  ['밤색', '#8e4a2a'],
  ['금발', '#d9a94f'],
  ['은발', '#cfd3da'],
  ['빨강', '#b33a35'],
  ['분홍', '#e58fb0'],
  ['파랑', '#3f6fb5'],
  ['보라', '#7a54a8'],
);
export const EYE_COLORS = swatches(
  ['검정', '#2b2422'],
  ['갈색', '#6a3f22'],
  ['호박색', '#b57422'],
  ['초록', '#3f7d4e'],
  ['파랑', '#3a78c2'],
  ['하늘', '#63b4d8'],
  ['회색', '#76808d'],
  ['보라', '#7c55b3'],
);
export const LIP_COLORS = swatches(
  ['살구', '#dd8a74'],
  ['분홍', '#e0708a'],
  ['장미', '#c4495f'],
  ['빨강', '#c22f35'],
  ['주황', '#e0683f'],
  ['벽돌', '#9c4438'],
  ['자두', '#7d3550'],
  ['밤색', '#6e4034'],
);
export const CLOTH_COLORS = swatches(
  ['빨강', '#c8403f'],
  ['주황', '#e08a45'],
  ['노랑', '#e9c258'],
  ['초록', '#3f8f62'],
  ['짙은 초록', '#2e5a48'],
  ['하늘', '#6fb1dc'],
  ['파랑', '#3f68b0'],
  ['남색', '#2c3a63'],
  ['보라', '#8460b0'],
  ['분홍', '#e69cb4'],
  ['흰색', '#f1ece4'],
  ['검정', '#33343c'],
);

const index = (list: readonly unknown[]) => z.number().int().min(0).max(list.length - 1);
const ids = <T extends readonly Option[]>(list: T) => z.enum(list.map((o) => o.id) as [T[number]['id'], ...T[number]['id'][]]);
const lookOf = <B extends Body>(body: B) =>
  z.strictObject({
    body: z.literal(body),
    face: ids(FACES),
    skin: index(SKIN_COLORS),
    hair: ids(PARTS[body].hair),
    hairColor: index(HAIR_COLORS),
    eyes: ids(EYES),
    eyeColor: index(EYE_COLORS),
    lips: ids(LIPS),
    lipColor: index(LIP_COLORS),
    top: ids(PARTS[body].top),
    topColor: index(CLOTH_COLORS),
    bottom: ids(PARTS[body].bottom),
    bottomColor: index(CLOTH_COLORS),
    shoes: ids(PARTS[body].shoes),
    shoesColor: index(CLOTH_COLORS),
    hat: z.boolean(),
    hatColor: index(CLOTH_COLORS),
  });
/** 부품 이름은 몸마다 다르므로 몸에 맞는 부품인지까지 확인한다. */
export const lookSchema = z.discriminatedUnion('body', [lookOf('male'), lookOf('female')]);
export type Look = z.infer<typeof lookSchema>;

export const DEFAULT_LOOKS: Record<Body, Look> = {
  male: {
    body: 'male', face: 'basic', skin: 2, hair: 'side', hairColor: 2, eyes: 'round', eyeColor: 1, lips: 'smile', lipColor: 0,
    top: 'hoodie', topColor: 3, bottom: 'jeans', bottomColor: 7, shoes: 'sneakers', shoesColor: 0, hat: true, hatColor: 0,
  },
  female: {
    body: 'female', face: 'basic', skin: 2, hair: 'bob', hairColor: 2, eyes: 'sparkle', eyeColor: 1, lips: 'smile', lipColor: 1,
    top: 'layered', topColor: 9, bottom: 'skirt', bottomColor: 7, shoes: 'boots', shoesColor: 0, hat: true, hatColor: 0,
  },
};

/** 서로 어울리는 [상의, 하의, 신발, 모자] 색 */
const OUTFITS = [
  [0, 7, 11, 0],
  [4, 7, 0, 0],
  [3, 10, 11, 0],
  [10, 7, 0, 0],
  [9, 7, 10, 9],
  [5, 7, 10, 10],
  [6, 10, 0, 6],
  [2, 4, 11, 3],
  [1, 7, 11, 1],
  [8, 11, 10, 8],
  [10, 4, 1, 4],
  [11, 6, 10, 0],
] as const;

export function randomLook(body: Body): Look {
  const n = (count: number) => Math.floor(Math.random() * count);
  const one = <T>(list: readonly T[]) => list[n(list.length)];
  const often = (p: number) => Math.random() < p;
  const parts = PARTS[body];
  const hairs = parts.hair.filter((h) => h.id !== 'bald' && h.id !== 'mohawk');
  const hair = often(0.05) ? 'bald' : often(0.05) ? 'mohawk' : one<Option>(hairs).id;
  const [topColor, bottomColor, shoesColor, hatColor] = one(OUTFITS);
  return lookSchema.parse({
    body,
    face: one(FACES).id,
    skin: n(SKIN_COLORS.length),
    hair,
    // 자연스러운 머리색(앞의 여섯 가지)과 입술색(앞의 세 가지)을 주로 고른다.
    hairColor: often(0.85) ? n(6) : n(HAIR_COLORS.length),
    eyes: one(EYES).id,
    eyeColor: n(EYE_COLORS.length),
    lips: one(LIPS).id,
    lipColor: n(3),
    top: one<Option>(parts.top).id,
    topColor,
    bottom: one<Option>(parts.bottom).id,
    bottomColor,
    shoes: one<Option>(parts.shoes).id,
    shoesColor,
    hat: often(0.5),
    hatColor,
  });
}

/** 저장된 값은 예전 형식이거나 손댄 값일 수 있어 하나씩 검증한다. */
export function parseLooks(json: string | null): { body: Body; looks: Record<Body, Look> } {
  const looks = { ...DEFAULT_LOOKS };
  let body: Body = 'female';
  try {
    const raw = JSON.parse(json ?? 'null');
    for (const b of BODIES) {
      const parsed = lookSchema.safeParse(raw?.looks?.[b]);
      if (parsed.success && parsed.data.body === b) looks[b] = parsed.data;
    }
    if (BODIES.includes(raw?.body)) body = raw.body;
  } catch {
    // 깨진 값이면 기본 모습을 쓴다.
  }
  return { body, looks };
}
