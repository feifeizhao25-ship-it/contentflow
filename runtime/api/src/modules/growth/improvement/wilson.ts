/** Wilson 得分区间。样本为 0 时下界和上界都是 0。 */
export function wilsonInterval(successes: number, total: number, z = 1.96): { lower: number; upper: number } {
  if (total <= 0 || successes < 0 || successes > total) return { lower: 0, upper: 0 };
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return { lower: (centre - margin) / denom, upper: (centre + margin) / denom };
}
