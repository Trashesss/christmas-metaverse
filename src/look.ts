import { parseLooks, type Body, type Look } from '../shared/look';

const KEY = 'look';
export type Looks = { body: Body; looks: Record<Body, Look> };

export function loadLooks(): Looks {
  try {
    return parseLooks(localStorage.getItem(KEY));
  } catch {
    // 저장소를 막아둔 브라우저에서는 기본 모습으로 시작한다.
    return parseLooks(null);
  }
}

export function saveLooks(state: Looks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장하지 못해도 이번 접속에는 그대로 쓴다.
  }
}

/** 저장된 모습 가운데 이 몸의 것만 바꾼다. */
export const withLook = ({ looks }: Looks, look: Look): Looks => ({ body: look.body, looks: { ...looks, [look.body]: look } });

export const sameLook = (a: Look, b: Look) => (Object.keys(a) as (keyof Look)[]).every((k) => a[k] === b[k]);
