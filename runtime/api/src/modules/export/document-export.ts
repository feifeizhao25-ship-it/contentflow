/**
 * 国内稿件导出：Word 用 dolanmiu/docx（MIT）写出标题 1–3、目录和页眉；
 * PDF 用 pdfkit 写可检索的文字层。
 * 不改 export.formats / batchExport，也不自动发布。
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { AlignmentType, Document, Header, HeadingLevel, Packer, Paragraph, TableOfContents, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import { breakChineseLines } from './chinese-layout';

export interface ExportSection {
  level: 1 | 2 | 3;
  heading: string;
  paragraphs: string[];
}

export interface ExportDraft {
  title: string;
  header: string;
  sections: ExportSection[];
}

const HEADING = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

function fontFile(name: string): string {
  const candidates = [join(__dirname, '../../../assets/fonts', name), join(process.cwd(), 'assets/fonts', name)];
  const path = candidates.find((item) => existsSync(item));
  if (!path) throw new Error(`PDF font is not installed: ${name}`);
  return path;
}

export async function buildDocx(draft: ExportDraft): Promise<Buffer> {
  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('目录')] }),
    new TableOfContents('目录', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(draft.title)] }),
  ];
  for (const section of draft.sections) {
    children.push(new Paragraph({ heading: HEADING[section.level], children: [new TextRun(section.heading)] }));
    for (const paragraph of section.paragraphs) {
      for (const line of breakChineseLines(paragraph, 36)) {
        children.push(new Paragraph({ children: [new TextRun(line)] }));
      }
    }
  }
  const doc = new Document({
    title: draft.title,
    sections: [
      {
        headers: {
          default: new Header({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun(draft.header)] })],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

type Face = 'Latin' | 'Cjk';

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

function drawMixed(doc: PDFKit.PDFDocument, line: string, y: number, size: number) {
  let x = 48;
  let runFace: Face | null = null;
  let run = '';
  const flush = () => {
    if (!run || !runFace) return;
    doc.font(runFace).fontSize(size);
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

export function buildSearchablePdf(draft: ExportDraft): Promise<Buffer> {
  const lines: { text: string; size: number }[] = [
    { text: draft.header, size: 10 },
    { text: draft.title, size: 18 },
    { text: '目录', size: 14 },
  ];
  for (const section of draft.sections) lines.push({ text: section.heading, size: 12 });
  for (const section of draft.sections) {
    lines.push({ text: section.heading, size: 16 - section.level });
    for (const paragraph of section.paragraphs) {
      for (const line of breakChineseLines(paragraph, 28)) lines.push({ text: line, size: 11 });
    }
  }
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('Latin', fontFile('NotoSans-Regular.ttf'));
    doc.registerFont('Cjk', fontFile('DroidSansFallbackFull.ttf'));
    let y = 48;
    for (const line of lines) {
      if (y > doc.page.height - 64) {
        doc.addPage();
        y = 48;
        drawMixed(doc, draft.header, y, 10);
        y += 16;
      }
      drawMixed(doc, line.text, y, line.size);
      y += line.size + 8;
    }
    doc.end();
  });
}
