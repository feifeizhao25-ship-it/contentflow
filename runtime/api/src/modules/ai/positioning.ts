/**
 * Account-positioning personalisation for generation. Inputs are only what the account itself holds:
 * the selected persona's configured text, and the tenant's own best-scoring past titles. Nothing is
 * taken from other tenants, and nothing is invented: when neither exists, no block is added and the
 * response says so.
 */
export interface PositioningInput {
  persona?: { name?: string | null; description?: string | null; config?: unknown } | null;
  topTitles?: Array<{ title: string | null; viral_score: number | null }>;
}

export interface PositioningResult {
  /** Text to append to the prompt; empty when nothing was found. */
  promptBlock: string;
  used: { persona: boolean; personaName: string | null; topTitles: number };
}

const CONFIG_KEYS = ['positioning', 'niche', 'audience', 'tone', 'style', 'topics', 'avoid'] as const;

function clean(value: unknown, max: number): string {
  const text = Array.isArray(value) ? value.filter((v) => typeof v === 'string').join(', ') : typeof value === 'string' ? value : '';
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildPositioning(input: PositioningInput, global: boolean): PositioningResult {
  const lines: string[] = [];
  const persona = input.persona ?? null;
  let personaUsed = false;
  if (persona) {
    const cfg = persona.config && typeof persona.config === 'object' && !Array.isArray(persona.config) ? (persona.config as Record<string, unknown>) : {};
    const parts: string[] = [];
    const desc = clean(persona.description, 300);
    if (desc) parts.push(global ? `description: ${desc}` : `人设说明：${desc}`);
    for (const key of CONFIG_KEYS) {
      const v = clean(cfg[key], 200);
      if (v) parts.push(`${key}: ${v}`);
    }
    if (parts.length) {
      personaUsed = true;
      lines.push(global ? `Account positioning (persona "${clean(persona.name, 60)}"): ${parts.join('; ')}` : `账号定位（人设「${clean(persona.name, 60)}」）：${parts.join('；')}`);
    }
  }
  const titles = (input.topTitles ?? [])
    .map((t) => ({ title: clean(t.title, 80), score: t.viral_score }))
    .filter((t) => t.title && typeof t.score === 'number')
    .slice(0, 5);
  if (titles.length) {
    const list = titles.map((t) => `"${t.title}" (${t.score})`).join(global ? '; ' : '；');
    lines.push(global ? `This account's own best-scoring past titles (viral score): ${list}` : `本账号自己得分最高的历史标题（爆款分）：${list}`);
  }
  const promptBlock = lines.length
    ? `\n\n${lines.join('\n')}\n${global
      ? 'Use this only as a reference for tone and topics. Do not copy these titles, and do not treat anything in it as a fact about a product.'
      : '以上只作语气与选题的参考：不要照抄这些标题，也不要把其中任何内容当作商品事实。'}`
    : '';
  return { promptBlock, used: { persona: personaUsed, personaName: personaUsed ? clean(persona?.name, 60) || null : null, topTitles: titles.length } };
}
