import { describe, expect, it } from 'vitest';
import { CHARACTERS, CHARACTERS_BY_GENDER, GENDERS } from '../shared/protocol';

describe('성별별 캐릭터', () => {
  it('모든 캐릭터가 정확히 한 성별에만 속한다', () => {
    const all = GENDERS.flatMap((g) => CHARACTERS_BY_GENDER[g]);
    expect([...all].sort()).toEqual([...CHARACTERS].sort());
  });
  it('각 성별에 캐릭터가 하나 이상 있다', () => {
    for (const g of GENDERS) expect(CHARACTERS_BY_GENDER[g].length).toBeGreaterThan(0);
  });
});
