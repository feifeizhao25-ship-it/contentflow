import { screenClaim } from '../../ai/compliance/claims';
import { growthFlagsFromEnv, scanClaims } from '../kit';

export interface TemplatePage {
  slug: string;
  title: string;
  body: string;
  facts: { claim: string; source_id: string }[];
  humanApproved: boolean;
  status: 'draft' | 'live';
}

/**
 * 未人工批准、话术不过闸、或缺少出处的页面保持草稿。
 * 增长工具包（SEO_PAGES_ENABLED，默认关闭）：打开后，医疗功效、命运预测、收益承诺、绝对化用语也让页面保持草稿。
 * 只会多拦，不会放行原来拦住的页面。
 */
export function prepareTemplatePage(
  input: Omit<TemplatePage, 'status'>,
  env: Record<string, string | undefined> = process.env,
): TemplatePage {
  const text = `${input.title}\n${input.body}`;
  const screened = screenClaim(text);
  const kitHit = growthFlagsFromEnv(env).seoPages && scanClaims(text).length > 0;
  const missingFact = input.facts.length === 0 || input.facts.some((fact) => !fact.source_id || !fact.claim);
  if (!screened.ok || kitHit || missingFact || !input.humanApproved) {
    return { ...input, humanApproved: input.humanApproved && screened.ok && !kitHit && !missingFact, status: 'draft' };
  }
  return { ...input, status: 'live' };
}

export function draftFromNewTerm(term: string): TemplatePage {
  return prepareTemplatePage({
    slug: `term-${term.slice(0, 24)}`,
    title: `${term}选题草稿`,
    body: `【本内容由 AI 生成】\n${term} 只生成选题草稿。请人工确认事实和出处后再决定是否上线。`,
    facts: [],
    humanApproved: false,
  });
}
