/** 提示进化试点：只提出下一版编号，不改写已发布提示，不自动晋升。 */
export function proposePromptBump(current: string, reason: string): { version: string; status: 'proposal'; needsHumanApproval: true; autoPromoted: false; reason: string } {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  const version = match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : '0.1.1';
  return { version, status: 'proposal', needsHumanApproval: true, autoPromoted: false, reason };
}
