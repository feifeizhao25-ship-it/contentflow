import { screenClaim } from '../../ai/compliance/claims';

export interface TemplatePage {
  slug: string;
  title: string;
  body: string;
  facts: { claim: string; source_id: string }[];
  humanApproved: boolean;
  status: 'draft' | 'live';
}

/** 未人工批准、话术不过闸、或缺少出处的页面保持草稿。 */
export function prepareTemplatePage(input: Omit<TemplatePage, 'status'>): TemplatePage {
  const screened = screenClaim(`${input.title}\n${input.body}`);
  const missingFact = input.facts.length === 0 || input.facts.some((fact) => !fact.source_id || !fact.claim);
  if (!screened.ok || missingFact || !input.humanApproved) {
    return { ...input, humanApproved: input.humanApproved && screened.ok && !missingFact, status: 'draft' };
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
