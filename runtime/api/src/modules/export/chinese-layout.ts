/**
 * 中文换行禁则，按 W3C clreq：行首不排句末点号和闭括号，行尾不排开括号。
 * https://www.w3.org/TR/clreq/
 */
const NO_LINE_START = new Set('，。、；：？！）》」』】'.split(''));
const NO_LINE_END = new Set('（《「『【'.split(''));

export function breakChineseLines(text: string, maxChars: number): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (!current.length) return;
    lines.push(current.join(''));
    current = [];
  };
  for (const char of chars) {
    if (current.length >= maxChars && !NO_LINE_START.has(char)) {
      while (current.length && NO_LINE_END.has(current[current.length - 1])) {
        // 开括号留到下一行，避免落在行尾。
        const moved = current.pop() as string;
        flush();
        current.push(moved);
      }
      flush();
    }
    current.push(char);
  }
  flush();
  return lines.length ? lines : [''];
}

export function lineBreaksFollowClreq(lines: string[]): boolean {
  return lines.every((line, index) => {
    const chars = Array.from(line);
    if (!chars.length) return true;
    if (NO_LINE_START.has(chars[0])) return false;
    if (index < lines.length - 1 && NO_LINE_END.has(chars[chars.length - 1])) return false;
    return true;
  });
}
