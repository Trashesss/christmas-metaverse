/** 키보드와 터치 조이스틱을 하나의 이동 벡터로 합친다. */
export const stick = { x: 0, y: 0 };
const keys = new Set<string>();

export function stopInput() {
  keys.clear();
  stick.x = stick.y = 0;
}

export const isTyping = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');

addEventListener('keydown', (e) => {
  // macOS는 Cmd를 누른 채 뗀 글자의 keyup을 보내지 않는다.
  if (e.metaKey || e.ctrlKey || e.altKey) keys.clear();
  else if (!isTyping()) keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', stopInput);
addEventListener('focusin', () => {
  if (isTyping()) keys.clear();
});

const axis = (neg: string[], pos: string[]) =>
  Number(pos.some((k) => keys.has(k))) - Number(neg.some((k) => keys.has(k)));

/** 조이스틱을 끝까지 밀거나 Shift를 누르면 달린다. */
const RUN_STICK = 0.92;
const shift = () => keys.has('ShiftLeft') || keys.has('ShiftRight');

export function readMove() {
  const x = axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + stick.x;
  const y = axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']) + stick.y;
  const len = Math.hypot(x, y);
  const run = shift() || Math.hypot(stick.x, stick.y) > RUN_STICK;
  return len > 1 ? { x: x / len, y: y / len, run } : { x, y, run };
}
