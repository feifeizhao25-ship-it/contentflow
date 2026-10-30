import { DEFAULT_THRESHOLDS, GateThresholds } from './gates';

/** 自改进配置。默认全部关闭；对照比例不可配置（见 cohort.ts）。 */
export interface SILConfig {
  product: string;
  enabled: boolean; // SIL_ENABLED，默认关
  autoPromoteInternal: boolean; // 仅「用户不可见」且门禁全绿才可自动晋升；默认也关
  maxProposalsPerWeek: number;
  dataDir: string;
  thresholds: GateThresholds;
  allowedDomains: string[];
  families?: string[];
}

const flag = (env: NodeJS.ProcessEnv, key: string) => ['1', 'true', 'yes', 'on'].includes(String(env[key] ?? '0').trim().toLowerCase());

export function configFromEnv(product: string, env: NodeJS.ProcessEnv = process.env, overrides: Partial<SILConfig> = {}): SILConfig {
  return {
    product,
    enabled: flag(env, 'SIL_ENABLED'),
    autoPromoteInternal: flag(env, 'SIL_AUTO_PROMOTE_INTERNAL'),
    maxProposalsPerWeek: Math.min(Number(env.SIL_MAX_PROPOSALS ?? 3), 3), // 上限写死 3
    dataDir: env.SIL_DATA_DIR ?? `var/self_improve/${product}`,
    thresholds: DEFAULT_THRESHOLDS,
    allowedDomains: [],
    ...overrides,
  };
}
