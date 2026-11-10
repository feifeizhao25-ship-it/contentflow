/**
 * 周报 PDF。用 pdfkit（MIT）嵌入字体子集：拉丁文用 Noto Sans（OFL），
 * 中文用 Droid Sans Fallback（Apache-2.0）。缺字就跳过，不编造互动数字。
 */
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { Cell, Sheet } from './xlsx';

const MARGIN = 40;
const FONT_SIZE = 9;
const LINE = 13;

type Face = 'Latin' | 'Cjk';

function fontFile(name: string): string {
  const candidates = [
    join(__dirname, '../../../assets/fonts', name),
    join(process.cwd(), 'assets/fonts', name),
  ];
  const path = candidates.find((item) => existsSync(item));
  if (!path) throw new Error(`PDF font is not installed: ${name}`);
  return path;
}

function hasGlyph(doc: PDFKit.PDFDocument, face: Face, code: number): boolean {
  doc.font(face);
  const font = (doc as PDFKit.PDFDocument & { _font: { font: { hasGlyphForCodePoint(code: number): boolean } } })._font.font;
  return font.hasGlyphForCodePoint(code);
}

function faceFor(doc: PDFKit.PDFDocument, code: number): Face | null {
  if (hasGlyph(doc, 'Latin', code)) return 'Latin';
  if (hasGlyph(doc, 'Cjk', code)) return 'Cjk';
  return null;
}

function sheetLines(sheets: Sheet[]): string[] {
  const lines: string[] = [];
  for (const sheet of sheets) {
    lines.push(sheet.name);
    for (const row of sheet.rows) {
      const text = row
        .map((cell: Cell) => (cell === null || cell === undefined ? '' : String(cell)))
        .join('  ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) lines.push(text);
    }
    lines.push('');
  }
  return lines;
}

function wrap(doc: PDFKit.PDFDocument, line: string, maxWidth: number): string[] {
  const out: string[] = [];
  let current = '';
  let width = 0;
  for (const char of line) {
    const code = char.codePointAt(0) ?? 0;
    const face = faceFor(doc, code);
    if (!face) continue;
    const advance = doc.font(face).fontSize(FONT_SIZE).widthOfString(char);
    if (current && width + advance > maxWidth) {
      out.push(current);
      current = char;
      width = advance;
    } else {
      current += char;
      width += advance;
    }
  }
  if (current) out.push(current);
  if (!out.length) out.push('');
  return out;
}

function drawLine(doc: PDFKit.PDFDocument, line: string, y: number) {
  let x = MARGIN;
  let runFace: Face | null = null;
  let run = '';
  const flush = () => {
    if (!run || !runFace) return;
    doc.font(runFace).fontSize(FONT_SIZE);
    const width = doc.widthOfString(run);
    doc.text(run, x, y, { lineBreak: false });
    x += width;
    run = '';
  };
  for (const char of line) {
    const code = char.codePointAt(0) ?? 0;
    const face = faceFor(doc, code);
    if (!face) continue;
    if (runFace && face !== runFace) flush();
    runFace = face;
    run += char;
  }
  flush();
}

export function buildPdf(sheets: Sheet[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('Latin', fontFile('NotoSans-Regular.ttf'));
    doc.registerFont('Cjk', fontFile('DroidSansFallbackFull.ttf'));
    const maxWidth = doc.page.width - MARGIN * 2;
    let y = MARGIN;
    for (const line of sheetLines(sheets)) {
      for (const part of wrap(doc, line, maxWidth)) {
        if (y + LINE > doc.page.height - MARGIN) {
          doc.addPage();
          y = MARGIN;
        }
        if (part) drawLine(doc, part, y);
        y += LINE;
      }
    }
    doc.end();
  });
}
