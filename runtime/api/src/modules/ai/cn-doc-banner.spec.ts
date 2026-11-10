import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * #91 already banners the live README and the video guides. This check covers
 * the domestic markdown those edits did not touch, and fails if another file
 * starts telling people OpenRouter, Fal, or Shotstack is the current CN setup.
 */
const ROOT = join(__dirname, '../../../../web-cn');
const ALREADY_IN_91 = new Set([
  'README.md',
  'PHASE3_REPORT.md',
  'PROJECT_TECHNICAL_DOCUMENTATION.md',
  'QUICK_START_VIDEO.md',
  'VIDEO_GENERATION_ISSUE.md',
  'VIDEO_MERGING_SETUP.md',
  'MULTI_SEGMENT_VIDEO_GUIDE.md',
  'docs/PROJECT_ARCHITECTURE.md',
]);
const THIS_PR = [
  'TEST_REPORT_2026_01_11.md',
  'API_AND_DATA_STRATEGY.md',
  'PHASE2_REPORT.md',
  'RALPH_WIGGUM_TEST.md',
];
const CURRENT_STACK = /OpenRouter|Fal\.ai|Fal AI|Shotstack/;
const HISTORICAL = /历史/;

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

describe('国内文档里残留的 OpenRouter / Fal / Shotstack 说明', () => {
  it('本轮补上的文件都标明是历史记录', () => {
    for (const name of THIS_PR) {
      const text = readFileSync(join(ROOT, name), 'utf8');
      expect(text).toMatch(HISTORICAL);
      expect(text).toMatch(/暂未开放/);
    }
  });

  it('91 没改过的国内文档，只要还写这些供应商，就必须标明历史', () => {
    const missed = markdownFiles(ROOT)
      .map((path) => relative(ROOT, path))
      .filter((name) => !ALREADY_IN_91.has(name))
      .filter((name) => CURRENT_STACK.test(readFileSync(join(ROOT, name), 'utf8')))
      .filter((name) => !HISTORICAL.test(readFileSync(join(ROOT, name), 'utf8')));
    expect(missed).toEqual([]);
  });
});
