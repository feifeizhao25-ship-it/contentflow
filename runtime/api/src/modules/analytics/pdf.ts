/**
 * 最小 PDF：同一张周报表格，嵌入只含本页用到的字形的中文字体。
 * 没有的互动数字不会出现在文件里；缺字时跳过该字，不换成估算值。
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Cell, Sheet } from './xlsx';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const FONT_SIZE = 9;
const LINE = 13;

const fontCache = new Map<string, Buffer>();

function loadFont(file: string): Buffer {
  const cached = fontCache.get(file);
  if (cached) return cached;
  const candidates = [
    join(__dirname, '../../../assets/fonts', file),
    join(process.cwd(), 'assets/fonts', file),
  ];
  const path = candidates.find((item) => existsSync(item));
  if (!path) throw new Error(`PDF font is not installed: ${file}`);
  const bytes = readFileSync(path);
  fontCache.set(file, bytes);
  return bytes;
}

function u16(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}
function i16(buf: Buffer, offset: number): number {
  return buf.readInt16BE(offset);
}
function u32(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function table(font: Buffer, tag: string): Buffer {
  const count = u16(font, 4);
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    if (font.toString('latin1', at, at + 4) === tag) {
      const start = u32(font, at + 8);
      const length = u32(font, at + 12);
      return font.subarray(start, start + length);
    }
  }
  throw new Error(`font is missing ${tag}`);
}

function checksum(buf: Buffer): number {
  let sum = 0;
  const words = Math.ceil(buf.length / 4);
  for (let i = 0; i < words; i++) {
    const b0 = buf[i * 4] ?? 0;
    const b1 = buf[i * 4 + 1] ?? 0;
    const b2 = buf[i * 4 + 2] ?? 0;
    const b3 = buf[i * 4 + 3] ?? 0;
    sum = (sum + (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0)) >>> 0;
  }
  return sum;
}

interface Cmap {
  glyphId(code: number): number;
}

function parseCmap(cmap: Buffer): Cmap {
  const tables = u16(cmap, 2);
  let format4 = -1;
  let format12 = -1;
  for (let i = 0; i < tables; i++) {
    const platform = u16(cmap, 4 + i * 8);
    const encoding = u16(cmap, 6 + i * 8);
    const offset = u32(cmap, 8 + i * 8);
    const format = u16(cmap, offset);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12) format12 = offset;
    if (format === 4) format4 = offset;
  }
  if (format12 >= 0) {
    const groups = u32(cmap, format12 + 12);
    return {
      glyphId(code: number) {
        let lo = 0;
        let hi = groups - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const at = format12 + 16 + mid * 12;
          const start = u32(cmap, at);
          const end = u32(cmap, at + 4);
          const glyph = u32(cmap, at + 8);
          if (code < start) hi = mid - 1;
          else if (code > end) lo = mid + 1;
          else return glyph + (code - start);
        }
        return 0;
      },
    };
  }
  if (format4 < 0) throw new Error('font has no unicode cmap');
  const segCount = u16(cmap, format4 + 6) / 2;
  const endAt = format4 + 14;
  const startAt = endAt + segCount * 2 + 2;
  const deltaAt = startAt + segCount * 2;
  const rangeAt = deltaAt + segCount * 2;
  return {
    glyphId(code: number) {
      for (let i = 0; i < segCount; i++) {
        const end = u16(cmap, endAt + i * 2);
        if (code > end) continue;
        const start = u16(cmap, startAt + i * 2);
        if (code < start) return 0;
        const range = u16(cmap, rangeAt + i * 2);
        if (range === 0) return (code + i16(cmap, deltaAt + i * 2)) & 0xffff;
        const id = u16(cmap, rangeAt + i * 2 + range + (code - start) * 2);
        if (id === 0) return 0;
        return (id + i16(cmap, deltaAt + i * 2)) & 0xffff;
      }
      return 0;
    },
  };
}

interface GlyphSource {
  record(id: number): Buffer;
  metrics(id: number): { advance: number; lsb: number };
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: [number, number, number, number];
}

function openGlyphs(font: Buffer): GlyphSource {
  const head = table(font, 'head');
  const hhea = table(font, 'hhea');
  const loca = table(font, 'loca');
  const glyf = table(font, 'glyf');
  const hmtx = table(font, 'hmtx');
  const long = u16(head, 50) === 1;
  const hMetrics = u16(hhea, 34);
  const record = (id: number) => {
    const start = long ? u32(loca, id * 4) : u16(loca, id * 2) * 2;
    const end = long ? u32(loca, (id + 1) * 4) : u16(loca, (id + 1) * 2) * 2;
    return glyf.subarray(start, end);
  };
  return {
    record,
    metrics(id: number) {
      if (id < hMetrics) {
        return { advance: u16(hmtx, id * 4), lsb: i16(hmtx, id * 4 + 2) };
      }
      const advance = u16(hmtx, (hMetrics - 1) * 4);
      const lsb = i16(hmtx, hMetrics * 4 + (id - hMetrics) * 2);
      return { advance, lsb };
    },
    unitsPerEm: u16(head, 18),
    ascent: i16(hhea, 4),
    descent: i16(hhea, 6),
    bbox: [i16(head, 36), i16(head, 38), i16(head, 40), i16(head, 42)],
  };
}

const MORE = 0x0020;
const ARG_WORDS = 0x0001;
const SCALE = 0x0008;
const XY_SCALE = 0x0040;
const MATRIX = 0x0080;

function componentGlyphs(record: Buffer): number[] {
  if (record.length < 10 || record.readInt16BE(0) >= 0) return [];
  const ids: number[] = [];
  let p = 10;
  while (p + 4 <= record.length) {
    const flags = record.readUInt16BE(p);
    ids.push(record.readUInt16BE(p + 2));
    p += 4;
    p += flags & ARG_WORDS ? 4 : 2;
    if (flags & SCALE) p += 2;
    else if (flags & XY_SCALE) p += 4;
    else if (flags & MATRIX) p += 8;
    if (!(flags & MORE)) break;
  }
  return ids;
}

function remapComponents(record: Buffer, oldToNew: Map<number, number>): Buffer {
  if (record.length < 10 || record.readInt16BE(0) >= 0) return record;
  const out = Buffer.from(record);
  let p = 10;
  while (p + 4 <= out.length) {
    const flags = out.readUInt16BE(p);
    const mapped = oldToNew.get(out.readUInt16BE(p + 2));
    if (mapped === undefined) throw new Error('PDF font subset is missing a component');
    out.writeUInt16BE(mapped, p + 2);
    p += 4;
    p += flags & ARG_WORDS ? 4 : 2;
    if (flags & SCALE) p += 2;
    else if (flags & XY_SCALE) p += 4;
    else if (flags & MATRIX) p += 8;
    if (!(flags & MORE)) break;
  }
  return out;
}

function buildCmap(codepoints: number[], glyphOf: Map<number, number>): Buffer {
  const pairs = codepoints
    .filter((code) => code <= 0xffff && (glyphOf.get(code) ?? 0) > 0)
    .sort((a, b) => a - b);
  const segCount = pairs.length + 1;
  const search = 2 * 2 ** Math.floor(Math.log2(segCount));
  const entry = Math.floor(Math.log2(search / 2));
  const rangeShift = 2 * segCount - search;
  const bytes = 16 + segCount * 8;
  const buf = Buffer.alloc(bytes);
  buf.writeUInt16BE(4, 0);
  buf.writeUInt16BE(bytes, 2);
  buf.writeUInt16BE(0, 4);
  buf.writeUInt16BE(segCount * 2, 6);
  buf.writeUInt16BE(search, 8);
  buf.writeUInt16BE(entry, 10);
  buf.writeUInt16BE(rangeShift, 12);
  const endAt = 14;
  const startAt = endAt + segCount * 2 + 2;
  const deltaAt = startAt + segCount * 2;
  const rangeAt = deltaAt + segCount * 2;
  pairs.forEach((code, i) => {
    const glyph = glyphOf.get(code) ?? 0;
    buf.writeUInt16BE(code, endAt + i * 2);
    buf.writeUInt16BE(code, startAt + i * 2);
    buf.writeUInt16BE((glyph - code) & 0xffff, deltaAt + i * 2);
    buf.writeUInt16BE(0, rangeAt + i * 2);
  });
  const last = segCount - 1;
  buf.writeUInt16BE(0xffff, endAt + last * 2);
  buf.writeUInt16BE(0xffff, startAt + last * 2);
  buf.writeInt16BE(1, deltaAt + last * 2);
  buf.writeUInt16BE(0, rangeAt + last * 2);
  return buf;
}

interface Subset {
  bytes: Buffer;
  glyphId(code: number): number;
  width(code: number): number;
}

function subsetFont(font: Buffer, codes: number[]): Subset {
  const cmap = parseCmap(table(font, 'cmap'));
  const glyphs = openGlyphs(font);
  const needed = new Set<number>([0]);
  const glyphOf = new Map<number, number>();
  for (const code of codes) {
    const id = cmap.glyphId(code);
    if (id > 0) {
      glyphOf.set(code, id);
      needed.add(id);
    }
  }
  const stack = [...needed];
  while (stack.length) {
    const id = stack.pop() as number;
    for (const child of componentGlyphs(glyphs.record(id))) {
      if (!needed.has(child)) {
        needed.add(child);
        stack.push(child);
      }
    }
  }
  const ordered = [...needed].sort((a, b) => a - b);
  if (ordered[0] !== 0) ordered.unshift(0);
  const oldToNew = new Map<number, number>();
  ordered.forEach((old, index) => oldToNew.set(old, index));
  const newGlyph = new Map<number, number>();
  for (const [code, old] of glyphOf) newGlyph.set(code, oldToNew.get(old) ?? 0);

  const pieces: Buffer[] = [];
  const offsets: number[] = [0];
  for (const old of ordered) {
    let rec = remapComponents(glyphs.record(old), oldToNew);
    if (rec.length % 2) rec = Buffer.concat([rec, Buffer.from([0])]);
    pieces.push(rec);
    offsets.push(offsets[offsets.length - 1] + rec.length);
  }
  const glyf = Buffer.concat(pieces);
  const loca = Buffer.alloc(offsets.length * 4);
  offsets.forEach((offset, i) => loca.writeUInt32BE(offset, i * 4));
  const hmtx = Buffer.alloc(ordered.length * 4);
  ordered.forEach((old, index) => {
    const metric = glyphs.metrics(old);
    hmtx.writeUInt16BE(metric.advance, index * 4);
    hmtx.writeInt16BE(metric.lsb, index * 4 + 2);
  });

  const head = Buffer.from(table(font, 'head'));
  head.writeUInt16BE(1, 50);
  head.writeUInt32BE(0, 8);
  const hhea = Buffer.from(table(font, 'hhea'));
  hhea.writeUInt16BE(ordered.length, 34);
  const maxp = Buffer.from(table(font, 'maxp'));
  maxp.writeUInt16BE(ordered.length, 4);
  const body = buildCmap([...newGlyph.keys()], newGlyph);
  const cmapTable = Buffer.alloc(12 + body.length);
  cmapTable.writeUInt16BE(0, 0);
  cmapTable.writeUInt16BE(1, 2);
  cmapTable.writeUInt16BE(3, 4);
  cmapTable.writeUInt16BE(1, 6);
  cmapTable.writeUInt32BE(12, 8);
  body.copy(cmapTable, 12);

  const keep = ['OS/2', 'name', 'post', 'cvt ', 'fpgm', 'prep', 'gasp'].flatMap((tag) => {
    try {
      return [{ tag, data: Buffer.from(table(font, tag)) }];
    } catch {
      return [];
    }
  });
  const bytes = assemble([
    { tag: 'head', data: head },
    { tag: 'hhea', data: hhea },
    { tag: 'maxp', data: maxp },
    { tag: 'hmtx', data: hmtx },
    { tag: 'loca', data: loca },
    { tag: 'glyf', data: glyf },
    { tag: 'cmap', data: cmapTable },
    ...keep,
  ]);
  const scale = 1000 / glyphs.unitsPerEm;
  return {
    bytes,
    glyphId: (code) => newGlyph.get(code) ?? 0,
    width: (code) => {
      const old = glyphOf.get(code);
      if (!old) return 500;
      return Math.max(1, Math.round(glyphs.metrics(old).advance * scale));
    },
  };
}

function assemble(tables: Array<{ tag: string; data: Buffer }>): Buffer {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const count = sorted.length;
  const search = 16 * 2 ** Math.floor(Math.log2(count));
  const entry = Math.floor(Math.log2(count));
  let cursor = 12 + count * 16;
  const placed = sorted.map((item) => {
    const start = cursor;
    cursor += item.data.length;
    cursor = (cursor + 3) & ~3;
    return { ...item, start };
  });
  const file = Buffer.alloc(cursor);
  file.writeUInt32BE(0x00010000, 0);
  file.writeUInt16BE(count, 4);
  file.writeUInt16BE(search, 6);
  file.writeUInt16BE(entry, 8);
  file.writeUInt16BE(count * 16 - search, 10);
  placed.forEach((item, index) => {
    const at = 12 + index * 16;
    file.write(item.tag, at, 'latin1');
    file.writeUInt32BE(checksum(item.data), at + 4);
    file.writeUInt32BE(item.start, at + 8);
    file.writeUInt32BE(item.data.length, at + 12);
    item.data.copy(file, item.start);
  });
  const head = placed.find((item) => item.tag === 'head');
  if (!head) throw new Error('font subset is missing head');
  const sum = checksum(file);
  file.writeUInt32BE((0xb1b0afba - sum) >>> 0, head.start + 8);
  return file;
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

interface Face {
  name: 'F1' | 'F2';
  source: Buffer;
  subset: Subset;
}

function uniqueCodes(text: string): number[] {
  const codes: number[] = [];
  const seen = new Set<number>();
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0xffff || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

function toUnicode(font: Subset, used: string, marker: string): string {
  const seen = new Map<number, number>();
  for (const char of used) {
    const code = char.codePointAt(0) ?? 0;
    const glyph = font.glyphId(code);
    if (glyph) seen.set(glyph, code);
  }
  const entries = [...seen.entries()].sort((a, b) => a[0] - b[0]);
  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const slice = entries.slice(i, i + 100);
    const rows = slice.map(([glyph, code]) => `<${glyph.toString(16).padStart(4, '0')}> <${code.toString(16).padStart(4, '0')}>`);
    chunks.push(`${slice.length} beginbfchar\n${rows.join('\n')}\nendbfchar`);
  }
  return `% font ${marker}\n/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
}

function widthArray(font: Subset, used: string): string {
  const widths = new Map<number, number>();
  for (const char of used) {
    const code = char.codePointAt(0) ?? 0;
    const glyph = font.glyphId(code);
    if (glyph) widths.set(glyph, font.width(code));
  }
  const list = [...widths.entries()].sort((a, b) => a[0] - b[0]);
  const parts: string[] = [];
  for (let i = 0; i < list.length; ) {
    let j = i;
    const run = [list[i][1]];
    while (j + 1 < list.length && list[j + 1][0] === list[j][0] + 1) {
      j += 1;
      run.push(list[j][1]);
    }
    parts.push(`${list[i][0]} [${run.join(' ')}]`);
    i = j + 1;
  }
  return parts.join(' ');
}

function descriptor(source: Buffer, fileId: number): string {
  const glyphs = openGlyphs(source);
  const scale = 1000 / glyphs.unitsPerEm;
  const box = glyphs.bbox.map((n) => Math.round(n * scale));
  return `<< /Type /FontDescriptor /FontName /Weekly /Flags 4 /FontBBox [${box.join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(glyphs.ascent * scale)} /Descent ${Math.round(glyphs.descent * scale)} /CapHeight ${Math.round(glyphs.ascent * scale)} /StemV 80 /FontFile2 ${fileId} 0 R >>`;
}

export function buildPdf(sheets: Sheet[]): Buffer {
  const lines = sheetLines(sheets);
  const sample = lines.join('\n');
  const latinSource = loadFont('NotoSans-Regular.ttf');
  const cjkSource = loadFont('DroidSansFallbackFull.ttf');
  const latinCmap = parseCmap(table(latinSource, 'cmap'));
  const cjkCmap = parseCmap(table(cjkSource, 'cmap'));
  const codes = uniqueCodes(sample);
  const latinCodes = codes.filter((code) => latinCmap.glyphId(code) > 0);
  const cjkCodes = codes.filter((code) => latinCmap.glyphId(code) === 0 && cjkCmap.glyphId(code) > 0);
  const latin: Face = { name: 'F1', source: latinSource, subset: subsetFont(latinSource, latinCodes) };
  const cjk: Face = { name: 'F2', source: cjkSource, subset: subsetFont(cjkSource, cjkCodes) };
  const faceOf = (code: number): Face | null => {
    if (latin.subset.glyphId(code)) return latin;
    if (cjk.subset.glyphId(code)) return cjk;
    return null;
  };
  const advanceOf = (code: number) => {
    const face = faceOf(code);
    if (!face) return 0;
    return (face.subset.width(code) * FONT_SIZE) / 1000;
  };
  const wrap = (line: string) => {
    const out: string[] = [];
    let current = '';
    let width = 0;
    const maxWidth = PAGE_W - MARGIN * 2;
    for (const char of line) {
      const code = char.codePointAt(0) ?? 0;
      const advance = advanceOf(code);
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
  };
  const drawLine = (line: string, y: number) => {
    let x = MARGIN;
    const ops: string[] = [];
    for (const char of line) {
      const code = char.codePointAt(0) ?? 0;
      const face = faceOf(code);
      const glyph = face?.subset.glyphId(code) ?? 0;
      if (!face || !glyph) continue;
      ops.push(`/${face.name} ${FONT_SIZE} Tf 1 0 0 1 ${x.toFixed(2)} ${y} Tm <${glyph.toString(16).padStart(4, '0')}> Tj`);
      x += advanceOf(code);
    }
    return ops.join('\n');
  };
  const wrapped = lines.flatMap((line) => wrap(line));
  const perPage = Math.floor((PAGE_H - MARGIN * 2) / LINE);
  const pages: string[] = [];
  for (let i = 0; i < Math.max(wrapped.length, 1); i += perPage) {
    const slice = wrapped.slice(i, i + perPage);
    const body = slice
      .map((line, index) => drawLine(line, PAGE_H - MARGIN - FONT_SIZE - index * LINE))
      .filter(Boolean)
      .join('\n');
    pages.push(`BT\n${body}\nET`);
  }

  const objects: Buffer[] = [];
  const add = (body: string) => objects.push(Buffer.from(body, 'latin1'));
  const pageCount = pages.length;
  const base = 3 + pageCount * 2;
  const fileId = (slot: number) => base + 8 + slot;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, i) => `${3 + i * 2} 0 R`).join(' ')}] >>`);
  pages.forEach((content, index) => {
    const pageId = 3 + index * 2;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${base} 0 R /F2 ${base + 4} 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
    );
    add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
  });
  [latin, cjk].forEach((face, slot) => {
    const type0 = base + slot * 4;
    add(`<< /Type /Font /Subtype /Type0 /BaseFont /Weekly${face.name} /Encoding /Identity-H /DescendantFonts [${type0 + 1} 0 R] /ToUnicode ${type0 + 3} 0 R >>`);
    add(
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Weekly${face.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${type0 + 2} 0 R /DW 500 /W [${widthArray(face.subset, sample)}] /CIDToGIDMap /Identity >>`,
    );
    add(descriptor(face.source, fileId(slot)));
    const cmapText = toUnicode(face.subset, sample, face.name);
    add(`<< /Length ${Buffer.byteLength(cmapText, 'latin1')} >>\nstream\n${cmapText}\nendstream`);
  });
  const files = [latin.subset.bytes, cjk.subset.bytes];
  files.forEach((ttf) => add(`<< /Length ${ttf.length} /Length1 ${ttf.length} >>\nstream\n`));
  const fileStart = objects.length - files.length;

  const header = Buffer.from('%PDF-1.4\n', 'latin1');
  const chunks: Buffer[] = [header];
  const offsets: number[] = [0];
  let cursor = header.length;
  objects.forEach((body, index) => {
    offsets.push(cursor);
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, 'latin1');
    if (index >= fileStart) {
      const ttf = files[index - fileStart];
      const stream = Buffer.concat([prefix, body, ttf, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
      chunks.push(stream);
      cursor += stream.length;
      return;
    }
    const piece = Buffer.concat([prefix, body, Buffer.from('\nendobj\n', 'latin1')]);
    chunks.push(piece);
    cursor += piece.length;
  });
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

function unicodeMap(section: string): Map<number, string> {
  const map = new Map<number, string>();
  const bf = /beginbfchar\n([\s\S]*?)endbfchar/g;
  let match: RegExpExecArray | null;
  while ((match = bf.exec(section))) {
    for (const line of match[1].split('\n')) {
      const pair = line.match(/<([0-9A-Fa-f]+)> <([0-9A-Fa-f]+)>/);
      if (!pair) continue;
      map.set(parseInt(pair[1], 16), String.fromCharCode(parseInt(pair[2], 16)));
    }
  }
  return map;
}

/** 从本模块写出的 PDF 里还原可见文字，供测试核对字段。 */
export function pdfPlainText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const maps = new Map<string, Map<number, string>>();
  for (const name of ['F1', 'F2']) {
    const marker = `% font ${name}`;
    const at = raw.indexOf(marker);
    if (at < 0) continue;
    const end = raw.indexOf('endstream', at);
    maps.set(name, unicodeMap(raw.slice(at, end === -1 ? raw.length : end)));
  }
  const lines: string[] = [];
  let current = '';
  let y: number | null = null;
  const op = /\/(F[12]) \d+ Tf 1 0 0 1 [\d.]+ ([\d.]+) Tm <([0-9A-Fa-f]+)> Tj/g;
  let match: RegExpExecArray | null;
  while ((match = op.exec(raw))) {
    const nextY = Number(match[2]);
    if (y !== null && nextY !== y) {
      lines.push(current);
      current = '';
    }
    y = nextY;
    const glyph = parseInt(match[3], 16);
    current += maps.get(match[1])?.get(glyph) ?? '';
  }
  if (current) lines.push(current);
  return lines.join('\n');
}
