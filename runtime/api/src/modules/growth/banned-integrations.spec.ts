import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const BANNED = ['xiaohongshu-mcp', 'social-auto-upload', 'MediaCrawler', 'XiaohongshuSkills'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    if (name.endsWith('.spec.ts')) return [];
    if (statSync(file).isDirectory()) return files(file);
    if (!file.endsWith('.ts') && !file.endsWith('package.json')) return [];
    return [file];
  });
}

describe('禁止的采集与代发依赖', () => {
  it('增长代码和依赖清单不引用被禁项目', () => {
    const roots = [
      join(__dirname, '../../../package.json'),
      ...files(join(__dirname)),
      ...files(join(__dirname, '../ai/growth-rag')),
      ...files(join(__dirname, '../ai/compliance')),
    ];
    const corpus = roots.map((file) => readFileSync(file, 'utf8')).join('\n');
    for (const name of BANNED) expect(corpus).not.toContain(name);
  });
});
