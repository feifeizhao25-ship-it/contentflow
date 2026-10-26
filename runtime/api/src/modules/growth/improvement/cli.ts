import { readFileSync } from 'fs';
import { AppendOnlyAuditLog } from './audit-log';
import { CycleInput, runAndAudit } from './cycle';

export function runCycleFromInput(input: CycleInput): { decision: ReturnType<typeof runAndAudit>['decision']; audit: ReturnType<AppendOnlyAuditLog['list']> } {
  const { decision, log } = runAndAudit(input);
  return { decision, audit: log.list() };
}

function readInput(): CycleInput {
  const file = process.argv[2];
  const raw = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  return JSON.parse(raw) as CycleInput;
}

if (require.main === module) {
  const result = runCycleFromInput(readInput());
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
