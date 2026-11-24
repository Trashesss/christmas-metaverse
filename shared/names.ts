// 눈에 보이지 않는 글자만 바꿔 남의 닉네임을 흉내 내지 못하게 한다. U+2800은 빈칸처럼 보이는 점자다.
const INVISIBLE = /[\p{Cf}\p{Default_Ignorable_Code_Point}⠀]|(?!\s)\p{Cc}/gu;

/** 띄어쓰기는 남기고 모양만 맞춘다. 띄어쓰기로 구분해야 하는 /w 닉네임 찾기에 쓴다. */
export function foldName(name: string) {
  return name
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toUpperCase()
    .toLowerCase()
    .normalize('NFKC');
}

/** 같은 닉네임인지 비교하는 값. 비어 있으면 쓸 수 없는 닉네임이다. */
export const nameKey = (name: string) => foldName(name).replace(/\s/gu, '');

export type WhisperCommand = { error: string } | { to: { id: string; name: string }; body: string };

/** /로 시작하지 않으면 null. /로 시작한 글은 잘못 적었더라도 공개 채팅으로 보내지 않도록 error를 돌려준다. */
export function parseWhisper(text: string, people: { id: string; name: string }[]): WhisperCommand | null {
  const slash = /^[\s\p{Cf}]*[/／](.*)$/su.exec(text);
  if (!slash) return null;
  // 한글 자판에서 w 자리는 ㅈ이다.
  const command = /^(?:w|ㅈ|귓속말|귓)(?:\s+(.*))?$/isu.exec(slash[1]);
  if (!command) return { error: '알 수 없는 명령이에요. 귓속말은 /w 닉네임 내용으로 보내요.' };
  const rest = (command[1] ?? '').trim();
  if (!rest) return { error: '/w 뒤에 닉네임을 적어주세요.' };
  let found: WhisperCommand | null = null;
  // 닉네임에 띄어쓰기가 있을 수 있다. 여럿이 맞으면 엉뚱한 사람에게 가지 않도록 보내지 않는다.
  for (const { index } of rest.matchAll(/\s+|$/gu)) {
    const name = foldName(rest.slice(0, index));
    const to = people.find((p) => foldName(p.name) === name);
    if (!to) continue;
    if (found) return { error: '비슷한 닉네임이 있어요. 마을 사람들에서 골라주세요.' };
    found = { to, body: rest.slice(index).trim() };
  }
  return found ?? { error: '그런 닉네임을 찾지 못했어요. 귓속말은 /w 닉네임 내용으로 보내요.' };
}
