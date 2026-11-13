/**
 * 国内发布前核对清单。只列出要人工看的项，不代替审核，也不自动放行。
 */
export interface PrePublishCheckItem {
  id: string;
  label: string;
  detail: string;
}

export const PRE_PUBLISH_CHECKLIST: readonly PrePublishCheckItem[] = [
  {
    id: 'ai-generated-label',
    label: 'AI生成内容标识',
    detail: '内容含人工智能生成合成成分时，保留显式标识，不删除、不隐藏。这不是法律意见。',
  },
];

export function prePublishChecklist(): PrePublishCheckItem[] {
  return PRE_PUBLISH_CHECKLIST.map((item) => ({ ...item }));
}
