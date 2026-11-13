/** 与 API `publish/pre-publish-checklist.ts` 同一条标签。只展示，不自动放行。 */
export const PRE_PUBLISH_CHECKLIST = [
  {
    id: 'ai-generated-label',
    label: 'AI生成内容标识',
    detail: '内容含人工智能生成合成成分时，保留显式标识，不删除、不隐藏。这不是法律意见。',
  },
] as const;
