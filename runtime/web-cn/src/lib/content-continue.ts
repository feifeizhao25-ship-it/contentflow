/** 内容库回到创作页继续编辑。创作页按 contentId 读回标题、正文和封面。 */
export function continueCreatingHref(contentId: unknown): string {
  const id = typeof contentId === 'string' ? contentId.trim() : '';
  return `/studio?contentId=${encodeURIComponent(id)}`;
}

export function batchDeleteSummary(result: {
  succeeded?: number;
  failed?: number;
  failures?: Array<{ message?: string }>;
} | null | undefined): string {
  const succeeded = Number(result?.succeeded ?? 0);
  const failed = Number(result?.failed ?? 0);
  if (failed > 0 && succeeded > 0) return `已删除 ${succeeded} 条，另有 ${failed} 条没有删除`;
  if (failed > 0) {
    const reason = result?.failures?.find((item) => typeof item?.message === 'string' && item.message.trim())?.message;
    return reason ? `没有删除：${reason}` : `没有删除，共 ${failed} 条失败`;
  }
  return `已删除 ${succeeded} 条内容`;
}
