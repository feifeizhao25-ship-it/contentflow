/**
 * Counter for the international English-only contract. The TransformInterceptor already refuses to
 * return Chinese from the international edition (502, or one retry for reads); this counts how often
 * that happens so a regression shows up as a number instead of a user report.
 * It stores only the route path (ids collapsed) and counts: never response bodies or user data.
 */
export interface LanguageGuardSnapshot {
  checked: number;
  cjkLeaks: number;
  recoveredByRetry: number;
  refused: number;
  byPath: Record<string, number>;
}

const state = { checked: 0, cjkLeaks: 0, recoveredByRetry: 0, refused: 0, byPath: new Map<string, number>() };
const MAX_PATHS = 200;

export function normalizePath(url: string): string {
  return String(url || '')
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .slice(0, 120);
}

export function recordLanguageCheck(): void {
  state.checked += 1;
}

export function recordCjkLeak(url: string): void {
  state.cjkLeaks += 1;
  const path = normalizePath(url);
  if (state.byPath.has(path) || state.byPath.size < MAX_PATHS) {
    state.byPath.set(path, (state.byPath.get(path) ?? 0) + 1);
  }
}

export function recordRecovered(): void {
  state.recoveredByRetry += 1;
}

export function recordRefused(): void {
  state.refused += 1;
}

export function languageGuardSnapshot(): LanguageGuardSnapshot {
  return {
    checked: state.checked,
    cjkLeaks: state.cjkLeaks,
    recoveredByRetry: state.recoveredByRetry,
    refused: state.refused,
    byPath: Object.fromEntries([...state.byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)),
  };
}

export function resetLanguageGuard(): void {
  state.checked = 0;
  state.cjkLeaks = 0;
  state.recoveredByRetry = 0;
  state.refused = 0;
  state.byPath.clear();
}
