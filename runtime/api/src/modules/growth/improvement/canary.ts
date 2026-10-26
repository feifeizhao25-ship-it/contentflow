import { createHash } from 'crypto';

/** 永久 15% 对照。同一个 subjectId 始终落在同一组。 */
export function assignArm(subjectId: string): 'control' | 'treatment' {
  const hex = createHash('sha256').update(`fenfaxia-canary-v1:${subjectId}`).digest('hex');
  const bucket = parseInt(hex.slice(0, 8), 16) % 100;
  return bucket < 15 ? 'control' : 'treatment';
}
