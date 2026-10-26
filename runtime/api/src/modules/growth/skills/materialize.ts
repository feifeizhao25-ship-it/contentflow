import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TRAFFIC_SKILLS, changelogMarkdown, goldenFor, skillMarkdown } from './catalog';
import { SHARED_REDTEAM } from './catalog';

export function writeSkillLibrary(root = join(__dirname, 'library')): string[] {
  const written: string[] = [];
  for (const skill of TRAFFIC_SKILLS) {
    const dir = join(root, skill.id);
    mkdirSync(join(dir, 'evals'), { recursive: true });
    const files: Record<string, string> = {
      'SKILL.md': skillMarkdown(skill),
      'CHANGELOG.md': changelogMarkdown(skill),
      'evals/golden.jsonl': `${JSON.stringify(goldenFor(skill)[0])}\n`,
      'evals/redteam.jsonl': SHARED_REDTEAM.map((item) => JSON.stringify(item)).join('\n') + '\n',
    };
    for (const [name, contents] of Object.entries(files)) {
      const file = join(dir, name);
      writeFileSync(file, contents, 'utf8');
      written.push(file);
    }
  }
  return written;
}

if (require.main === module) {
  const files = writeSkillLibrary();
  process.stdout.write(`wrote ${files.length} skill files\n`);
}
