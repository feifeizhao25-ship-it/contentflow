import { assignArm } from '../improvement/canary';

export interface TitleVariant {
  id: string;
  wins: number;
  trials: number;
}

export function sampleBeta(alpha: number, beta: number, rng: () => number): number {
  const x = sampleGamma(Math.max(alpha, 1e-6), rng);
  const y = sampleGamma(Math.max(beta, 1e-6), rng);
  return x / (x + y);
}

function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) return sampleGamma(shape + 1, rng) * Math.pow(Math.max(rng(), 1e-12), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x = 0;
    let v = 0;
    do {
      const u1 = Math.max(rng(), 1e-12);
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(Math.max(u, 1e-12)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * 标题候选：15% 永久对照始终用第一个候选。
 * 其余用 Thompson Sampling，奖励由调用方记成 wins/trials（选用或回填表现）。
 */
export function chooseTitle(variants: TitleVariant[], subjectId: string, rng: () => number = Math.random): { id: string; arm: 'control' | 'treatment' } {
  if (!variants.length) throw new Error('没有标题候选');
  const arm = assignArm(subjectId);
  if (arm === 'control') return { id: variants[0].id, arm };
  let best = variants[0];
  let bestScore = -1;
  for (const variant of variants) {
    const losses = Math.max(0, variant.trials - variant.wins);
    const score = sampleBeta(1 + variant.wins, 1 + losses, rng);
    if (score > bestScore) {
      best = variant;
      bestScore = score;
    }
  }
  return { id: best.id, arm };
}
