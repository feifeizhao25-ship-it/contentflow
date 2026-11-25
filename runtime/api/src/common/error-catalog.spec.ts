import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ERROR_CATALOG } from './error-catalog';

const ENGLISH_SENTENCE = /[A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){2,}/;
const CJK = /[\u3400-\u9fff]/;

describe('错误码对照表', () => {
  const doc = readFileSync(join(__dirname, '../../../../docs/error-codes.md'), 'utf8');

  it('每句中文都有汉字且不是成句英文，每句英文都没有汉字，文档里都有', () => {
    const seen = new Set<string>();
    for (const [code, row] of Object.entries(ERROR_CATALOG)) {
      expect(CJK.test(row.zh)).toBe(true);
      expect(ENGLISH_SENTENCE.test(row.zh)).toBe(false);
      expect(CJK.test(row.en)).toBe(false);
      expect(doc).toContain(row.zh);
      expect(doc).toContain(row.en);
      expect(doc).toContain(code);
      expect(seen.has(row.zh)).toBe(false);
      expect(seen.has(row.en)).toBe(false);
      seen.add(row.zh);
      seen.add(row.en);
    }
  });
});
