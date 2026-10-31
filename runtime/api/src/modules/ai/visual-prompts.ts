/**
 * Splits an AI article from the "Visual Prompts" block the model was asked to append.
 *
 * Before: the parser looked for the literal token VISUAL_PROMPTS that no prompt ever asked for, so the
 * block usually stayed inside the article body, the heading line ("**Visual Prompts**") was returned as if it
 * were a prompt, and the third real prompt was cut off by slice(0, 3).
 */
export interface SplitArticle {
  content: string;
  visualPrompts: string[];
}

const HEADING = /^\s*[#>*_\s]*(?:visual[\s_-]*prompts?|image[\s_-]*prompts?|生图提示词|图片提示词)\b[\s*_:：-]*$/i;
const DIVIDER = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const LABEL = /^(?:visual\s*)?(?:prompt|提示词)\s*\d*\s*[:：.)-]\**\s*/i;

function cleanLine(line: string): string {
  return line
    .trim()
    .replace(/^[>\s]*(?:[-*•]|\d+[.)]|\(\d+\))\s+/, '')
    .replace(/^(?:\*\*|__|`)+/, '')
    .replace(LABEL, '')
    .replace(/^(?:\*\*|__|`|"|'|“|‘)+/, '')
    .replace(/(?:\*\*|__|`|"|'|”|’)+$/, '')
    .trim();
}

function isPrompt(line: string): boolean {
  if (!line || /https?:\/\//i.test(line)) return false;
  if (HEADING.test(line) || /[:：]$/.test(line)) return false;
  return /[A-Za-z]{3,}.*\s.*[A-Za-z]{3,}/.test(line) && line.length >= 12;
}

export function splitArticleAndVisualPrompts(raw: string, max = 3): SplitArticle {
  const text = (raw ?? '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  let headingAt = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (HEADING.test(lines[i])) { headingAt = i; break; }
  }
  let dividerAt = -1;
  if (headingAt === -1) {
    // No heading: accept the last divider only if what follows is a short run of prompt-like lines.
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!DIVIDER.test(lines[i])) continue;
      const tail = lines.slice(i + 1).map(cleanLine).filter(Boolean);
      if (tail.length > 0 && tail.length <= max + 2 && tail.every((l) => isPrompt(l) && !/[.!?。！？]$/.test(l) && l.length <= 240)) dividerAt = i;
      break;
    }
  }
  const cut = headingAt !== -1 ? headingAt : dividerAt;
  if (cut === -1) return { content: text.trim(), visualPrompts: [] };

  const prompts: string[] = [];
  for (const line of lines.slice(cut + 1)) {
    if (DIVIDER.test(line)) continue;
    const p = cleanLine(line);
    if (isPrompt(p) && !prompts.includes(p)) prompts.push(p);
    if (prompts.length >= max) break;
  }

  const body = lines.slice(0, cut);
  while (body.length && (!body[body.length - 1].trim() || DIVIDER.test(body[body.length - 1]))) body.pop();
  return { content: body.join('\n').trim(), visualPrompts: prompts };
}
