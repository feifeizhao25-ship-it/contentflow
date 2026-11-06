/**
 * 令第23号第十七条：不得批量发布同质化内容。
 * 多账号发布必须先经人工确认，并且各目的地的正文不能是同一稿。
 * 纯函数：不写库、不发请求。
 */

export function normalizePublishPayload(body: string): string {
  return String(body ?? '').replace(/\s+/g, ' ').trim();
}

export function identicalPayloadGroups(items: { key: string; body: string }[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const norm = normalizePublishPayload(item.body);
    const list = groups.get(norm) ?? [];
    list.push(item.key);
    groups.set(norm, list);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function bulkPublishBlockReason(
  items: { key: string; body: string }[],
  humanConfirmed: boolean,
  region: 'cn' | 'global',
): string | null {
  if (items.length < 2) return null;
  if (!humanConfirmed) {
    return region === 'global'
      ? 'Publishing to more than one account requires you to confirm each rewritten version yourself. This product does not auto-post identical content in bulk.'
      : '一次发到多个账号前，需要你确认已按平台分别改写，并由你本人发布。系统不会批量自动发出相同内容。';
  }
  if (identicalPayloadGroups(items).length) {
    return region === 'global'
      ? 'These destinations would receive the same text. Rewrite each platform version so they are not identical, then confirm again. Bulk posting of identical content is blocked.'
      : '这些账号会收到同一稿。请按平台分别改写，使正文不再相同，再确认发布。批量发布同质化内容已被拦住。';
  }
  return null;
}
