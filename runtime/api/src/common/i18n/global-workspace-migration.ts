import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { defaultWorkspaceName, hasCjk, isGlobalMarket } from './market-text';

/**
 * One-off, idempotent clean-up for international (MARKET_REGION=global) accounts created before sign-up became
 * market-aware: they were named '<name>的工作室' / '我的工作室' and kept the column default settings
 * (zh-CN, Asia/Shanghai), which made GET /users/me answer 502 GLOBAL_ENGLISH_CONTRACT.
 *
 * Only the auto-generated default name is renamed; a workspace name the owner typed is left alone and counted.
 * Settings are changed only when they are still the untouched column default (zh-CN + Asia/Shanghai).
 * The domestic edition never runs this (it would be wrong there): the guard is MARKET_REGION, not data.
 * Switch off with GLOBAL_WORKSPACE_MIGRATION=0.
 */
export const DEFAULT_ZH_WORKSPACE = /^(我的工作室|.*的工作室)$/;

export interface TenantRow { id: string; name: string; settings: any }

export function isUntouchedChineseSettings(settings: any): boolean {
  return !!settings && String(settings.language ?? '').toLowerCase().startsWith('zh') && settings.timezone === 'Asia/Shanghai';
}

export function planWorkspaceFix(row: TenantRow, ownerName?: string | null): { name?: string; settings?: Record<string, unknown>; custom?: boolean } | null {
  const fix: { name?: string; settings?: Record<string, unknown>; custom?: boolean } = {};
  if (hasCjk(row.name ?? '')) {
    if (DEFAULT_ZH_WORKSPACE.test(row.name)) {
      const base = ownerName && !hasCjk(ownerName) ? ownerName : null;
      fix.name = defaultWorkspaceName(base, { MARKET_REGION: 'global' } as NodeJS.ProcessEnv);
    } else {
      fix.custom = true;
    }
  }
  if (isUntouchedChineseSettings(row.settings)) {
    fix.settings = { ...row.settings, language: 'en-US', timezone: 'UTC' };
  }
  return fix.name || fix.settings || fix.custom ? fix : null;
}

export interface MigrationResult { scanned: number; renamed: number; settingsUpdated: number; customLeftAlone: number }

@Injectable()
export class GlobalWorkspaceMigration implements OnApplicationBootstrap {
  private readonly logger = new Logger(GlobalWorkspaceMigration.name);
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!isGlobalMarket() || process.env.GLOBAL_WORKSPACE_MIGRATION === '0') return;
    try {
      const r = await this.run();
      if (r.renamed || r.settingsUpdated || r.customLeftAlone) {
        this.logger.log(`international workspaces normalised: renamed=${r.renamed} settings=${r.settingsUpdated} custom_names_left_alone=${r.customLeftAlone}`);
      }
    } catch (error) {
      // Never block start-up; the sign-up path is already market-aware and the next start retries.
      this.logger.warn(`international workspace clean-up skipped: ${(error as Error).message}`);
    }
  }

  async run(): Promise<MigrationResult> {
    const rows = (await this.prisma.$queryRaw<TenantRow[]>`
      SELECT id, name, settings FROM "Tenant"
      WHERE name ~ '[㐀-鿿]'
         OR (settings->>'language' LIKE 'zh%' AND settings->>'timezone' = 'Asia/Shanghai')`) ?? [];
    const result: MigrationResult = { scanned: rows.length, renamed: 0, settingsUpdated: 0, customLeftAlone: 0 };
    for (const row of rows) {
      const owner = await this.prisma.user.findFirst({ where: { tenant_id: row.id }, orderBy: { created_at: 'asc' }, select: { name: true } });
      const fix = planWorkspaceFix(row, owner?.name);
      if (!fix) continue;
      if (fix.custom) result.customLeftAlone++;
      const data: Record<string, unknown> = {};
      if (fix.name) { data.name = fix.name; result.renamed++; }
      if (fix.settings) { data.settings = fix.settings; result.settingsUpdated++; }
      if (Object.keys(data).length) await this.prisma.tenant.update({ where: { id: row.id }, data: data as any });
    }
    return result;
  }
}
