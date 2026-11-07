/**
 * Convert the model's markdown draft into readable plain text. The draft area is
 * read-only display and does not render markdown, so without this pass readers
 * would see raw markers like "### heading", "**bold**", "++bold++".
 * Real defect (2026-11-05 web-int Playwright retest): draft output carried raw
 * markdown markers.
 * Only strips markers, never rewrites the text; paragraphs and line breaks stay
 * intact; list bullets normalize to "• ".
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
