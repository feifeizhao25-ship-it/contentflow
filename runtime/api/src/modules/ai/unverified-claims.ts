/**
 * Flags specific, checkable-looking claims in generated copy that the user never supplied
 * (percentages and ALL-CAPS brand-like names). The generator has no product database, so anything
 * of this kind came from the model and must be confirmed by a person before publishing.
 */
const COMMON_CAPS = new Set([
  'AI', 'AIGC', 'USB', 'LED', 'LCD', 'OLED', 'SPF', 'UV', 'DIY', 'FAQ', 'CEO', 'CTA', 'SEO', 'APP', 'USA', 'FTC', 'FDA',
  'GDPR', 'ASMR', 'GRWM', 'OOTD', 'VLOG', 'TIKTOK', 'YOUTUBE', 'WIFI', 'HDMI', 'RGB', 'PDF', 'ROI', 'KPI', 'TOP', 'NEW',
  'HTTP', 'HTTPS', 'HTML', 'JSON', 'API', 'GPS', 'NASA', 'OK', 'VIP', 'PRO', 'MAX', 'MINI', 'PLUS',
]);

export function findUnverifiedClaims(content: string, userText: string): string[] {
  const text = content ?? '';
  const given = (userText ?? '').toLowerCase();
  const found: string[] = [];
  const add = (v: string) => { if (!found.includes(v)) found.push(v); };

  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*%|百分之\s*(\d+(?:\.\d+)?)/g)) {
    const num = m[1] ?? m[2];
    if (!new RegExp(`(^|[^\\d.])${num.replace('.', '\\.')}(?![\\d])`).test(given)) add(m[0].replace(/\s+/g, ''));
  }
  for (const m of text.matchAll(/\b[A-Z]{4,}(?:\s+[A-Z]{3,})*\b/g)) {
    const token = m[0];
    if (token.split(/\s+/).every((w) => COMMON_CAPS.has(w))) continue;
    if (given.includes(token.toLowerCase())) continue;
    add(token);
  }
  return found.slice(0, 10);
}

export const CLAIMS_NOTICE_ZH = '文中出现了你没有提供的具体数据或品牌名，AI 无法核实，发布前请逐条确认或删除。';
export const CLAIMS_NOTICE_EN = 'The copy contains specific figures or brand names you did not provide. The AI cannot verify them: confirm or remove each one before publishing.';
