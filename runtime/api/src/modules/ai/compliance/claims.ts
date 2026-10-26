import { readFileSync } from 'fs';
import { join } from 'path';

export interface ClaimEntry {
  id: string;
  text: string;
}

export interface ClaimsInventory {
  allowed: ClaimEntry[];
  forbidden: string[];
}

/** 只解析本库存使用的两段结构，不引入通用 YAML 库。 */
export function parseClaimsYaml(raw: string): ClaimsInventory {
  const allowed: ClaimEntry[] = [];
  const forbidden: string[] = [];
  let section: 'allowed' | 'forbidden' | null = null;
  let current: { id?: string; text?: string } | null = null;
  const flush = () => {
    if (current?.id && current.text) allowed.push({ id: current.id, text: current.text });
    current = null;
  };
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed === 'allowed:') {
      flush();
      section = 'allowed';
      continue;
    }
    if (trimmed === 'forbidden:') {
      flush();
      section = 'forbidden';
      continue;
    }
    if (section === 'forbidden') {
      const item = trimmed.match(/^-\s+(.+)$/);
      if (item) forbidden.push(item[1].trim());
      continue;
    }
    if (section === 'allowed') {
      const id = line.match(/^\s*-\s+id:\s+(.+)$/);
      if (id) {
        flush();
        current = { id: id[1].trim() };
        continue;
      }
      const text = line.match(/^\s+text:\s+(.+)$/);
      if (text && current) current.text = text[1].trim();
    }
  }
  flush();
  return { allowed, forbidden };
}

export function loadClaims(yamlPath = join(__dirname, 'claims.yaml')): ClaimsInventory {
  return parseClaimsYaml(readFileSync(yamlPath, 'utf8'));
}

export function screenClaim(text: string, claims: ClaimsInventory = loadClaims()): { ok: boolean; hits: string[] } {
  const haystack = text.toLowerCase();
  const hits = claims.forbidden.filter((phrase) => haystack.includes(phrase.toLowerCase()));
  return { ok: hits.length === 0, hits };
}
