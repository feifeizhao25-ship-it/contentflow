/**
 * 把模型返回的 markdown 草稿转成可直接阅读的纯文本（草稿区是只读展示，不渲染 markdown，
 * 否则读者会看到 "### 标题"、"**重点**"、"++重点++" 这些记号）。
 * 真实缺陷（2026-11-05 web-int Playwright 复测）：Draft output 里带着原始 markdown 记号。
 * 只去记号、不改文字，段落与换行保持不变；列表符号统一成 "• "。
 */
export function readableDraft(raw: string): string {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((line) => {
      let s = line.replace(/^\s{0,3}#{1,6}\s+/, '');
      s = s.replace(/^\s*[-*+]\s+(?=\S)/, '• ');
      s = s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\+\+(.+?)\+\+/g, '$1');
      s = s.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?=[^*\w]|$)/g, '$1$2').replace(/`([^`\n]+)`/g, '$1');
      return s;
    })
    .join('\n');
}
