/**
 * 周收获许可过滤。
 * 拒绝 AGPL / GPL / NC / NOASSERTION，以及爬虫、自动评论类（即使许可证写成 MIT 或 Apache）。
 * MIT、Apache、CC0、BSD 和已登记的政府公开引用通过。
 * 只决定候选去留，不安装仓库，不发布。
 */
export interface LicenseInput {
  id?: string;
  title?: string;
  url?: string;
  license?: string;
  kind?: string;
}

export interface LicenseDecision {
  pass: boolean;
  reason?: 'license' | 'scraper_or_auto_comment';
}

const REJECT_LICENSE = /agpl|(^|[^a-z])gpl|lgpl|cc-by-nc|non-?commercial|(^|[^a-z])nc([^a-z]|$)|noassertion/i;
const SCRAPER = /mediacrawler|xiaohongshu-mcp|自动评论|auto-comment|爬虫|\bscraper\b|\bcrawler\b/i;

export function decideHarvestLicense(source: LicenseInput): LicenseDecision {
  const blob = `${source.id ?? ''} ${source.title ?? ''} ${source.url ?? ''} ${source.kind ?? ''}`;
  if (SCRAPER.test(blob)) return { pass: false, reason: 'scraper_or_auto_comment' };
  if (REJECT_LICENSE.test(String(source.license ?? ''))) return { pass: false, reason: 'license' };
  return { pass: true };
}
