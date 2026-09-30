/**
 * 分页参数归一化。
 *
 * 查询串里的 page / pageSize 来自用户，原来直接拿去算 skip / take：
 * pageSize=1000000 一次拉全表；page=abc 得到 NaN，Prisma 报 500。
 */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export function normalizePaging(
  page: unknown,
  pageSize: unknown,
  defaults: { pageSize?: number; max?: number } = {},
): { page: number; pageSize: number; skip: number } {
  const max = defaults.max ?? MAX_PAGE_SIZE;
  const fallbackSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE;
  const p = Math.floor(Number(page));
  const s = Math.floor(Number(pageSize));
  const safePage = Number.isFinite(p) && p >= 1 ? Math.min(p, 100_000) : 1;
  const safeSize = Number.isFinite(s) && s >= 1 ? Math.min(s, max) : fallbackSize;
  return { page: safePage, pageSize: safeSize, skip: (safePage - 1) * safeSize };
}
