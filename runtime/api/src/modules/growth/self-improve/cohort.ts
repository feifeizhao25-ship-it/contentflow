import { createHash } from 'crypto';

/**
 * 永久 15% 对照 + 10% 灰度。哈希与盐沿用 improvement/canary.ts（fenfaxia-canary-v1），
 * 所以已经在对照组里的主体不会因为本模块而换组。对照比例是常量，不读环境变量。
 */
export const CONTROL_PERCENT = 15;
export const CANARY_PERCENT = 10;

export function bucketOf(subjectId: string): number {
  const hex = createHash('sha256').update(`fenfaxia-canary-v1:${subjectId}`).digest('hex');
  return parseInt(hex.slice(0, 8), 16) % 100;
}

export type Arm = 'control' | 'canary' | 'stable';

export function armFor(subjectId: string, canaryActive: boolean): Arm {
  const b = bucketOf(subjectId);
  if (b < CONTROL_PERCENT) return 'control';
  if (canaryActive && b < CONTROL_PERCENT + CANARY_PERCENT) return 'canary';
  return 'stable';
}
