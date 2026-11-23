import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { breakChineseLines, lineBreaksFollowClreq } from './chinese-layout';
import { ExportDraft, buildDocx, buildSearchablePdf } from './document-export';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';

/**
 * 调用外部命令行工具（unzip / pdftotext / qpdf）。工具缺失或执行失败时抛出一条普通的 Error，写明是哪个工具、什么原因。
 * 直接把 execFileSync 的异常抛给 jest 不行：那个异常对象的 error 属性指回它自己（循环引用），
 * jest worker 序列化失败，整个文件只报「Converting circular structure to JSON」，看不出真正原因。
 */
function runTool(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' });
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { status?: number | null; stderr?: unknown };
    const why = e.code === 'ENOENT' ? `${cmd} is not installed (CI installs it in .github/workflows/ci.yml)` : `exit ${e.status ?? '?'}: ${String(e.stderr ?? e.message).slice(0, 500)}`;
    throw new Error(`${cmd} ${args.join(' ')} failed: ${why}`);
  }
}

const DRAFT: ExportDraft = {
  title: '发布说明',
  header: '分发侠',
  sections: [
    { level: 1, heading: '核对清单', paragraphs: ['先看广告用语。（再看标识）然后由人工确认。'] },
    { level: 2, heading: '标识', paragraphs: ['AI生成内容标识要留在正文里。'] },
    { level: 3, heading: '范围', paragraphs: ['这一份只给国内草稿使用。'] },
  ],
};

function unzipText(file: string, entry: string): string {
  return runTool('unzip', ['-p', file, entry]);
}

describe('稿件导出', () => {
  it('中文换行避开行首禁则和行尾开括号', () => {
    const lines = breakChineseLines('说明文字够长就换。（下一句）还要继续写完', 8);
    expect(lines.join('')).toBe('说明文字够长就换。（下一句）还要继续写完');
    expect(lineBreaksFollowClreq(lines)).toBe(true);
    expect(lines.some((line) => line.endsWith('（') || line.startsWith('）'))).toBe(false);
  });

  it('Word 有标题层级、目录和页眉', async () => {
    const buffer = await buildDocx(DRAFT);
    const dir = mkdtempSync(join(tmpdir(), 'cf-docx-'));
    const file = join(dir, 'draft.docx');
    try {
      writeFileSync(file, buffer);
      const names = runTool('unzip', ['-l', file]);
      expect(names).toMatch(/word\/document\.xml/);
      expect(names).toMatch(/word\/header\d*\.xml/);
      const documentXml = unzipText(file, 'word/document.xml');
      expect(documentXml).toContain('Heading1');
      expect(documentXml).toContain('Heading2');
      expect(documentXml).toContain('Heading3');
      expect(documentXml).toContain('TOC');
      expect(documentXml).toContain('目录');
      expect(documentXml).toContain('核对清单');
      const headerName = names.match(/word\/header\d*\.xml/)?.[0];
      expect(headerName).toBeTruthy();
      expect(unzipText(file, headerName as string)).toContain('分发侠');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PDF 文字层可以检索', async () => {
    const pdf = await buildSearchablePdf(DRAFT);
    const dir = mkdtempSync(join(tmpdir(), 'cf-pdf-'));
    const file = join(dir, 'draft.pdf');
    try {
      writeFileSync(file, pdf);
      const text = runTool('pdftotext', ['-layout', file, '-']);
      expect(text).toContain('分发侠');
      expect(text).toContain('发布说明');
      expect(text).toContain('目录');
      expect(text).toContain('核对清单');
      expect(text).toContain('AI生成内容标识');
      expect(text).toContain('国内草稿');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('AI 稿件缺少显式标识时不导出', async () => {
    const unlabeled: ExportDraft = {
      title: '发布说明',
      header: '分发侠',
      aiGenerated: true,
      sections: [{ level: 1, heading: '核对清单', paragraphs: ['先看用语，然后由人工确认。'] }],
    };
    await expect(buildDocx(unlabeled)).rejects.toThrow(/显式标识/);
    await expect(buildSearchablePdf(unlabeled)).rejects.toThrow(/没有向平台提交/);
  });

  it('带上显式标识的 AI 稿件可以导出，且标识留在文件里', async () => {
    const labeled: ExportDraft = {
      ...DRAFT,
      aiGenerated: true,
      sections: [...DRAFT.sections, { level: 2, heading: '标识原文', paragraphs: [AI_TEXT_LABEL] }],
    };
    const buffer = await buildDocx(labeled);
    const dir = mkdtempSync(join(tmpdir(), 'cf-docx-label-'));
    const file = join(dir, 'labeled.docx');
    try {
      writeFileSync(file, buffer);
      expect(unzipText(file, 'word/document.xml')).toContain('本内容由 AI 生成');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('不改 export.formats 和 batchExport', () => {
    const entitlements = JSON.parse(readFileSync(join(__dirname, '../../../../web-cn/src/lib/entitlements.json'), 'utf8')) as {
      tiers: Record<string, { export: { formats: string[]; batchExport: boolean; watermark: boolean } }>;
      entitlementStatus: Record<string, { status: string }>;
    };
    expect(entitlements.entitlementStatus['export.formats'].status).toBe('coming_soon');
    expect(entitlements.entitlementStatus['export.batchExport'].status).toBe('coming_soon');
    expect(entitlements.tiers.free.export).toEqual({ formats: ['视频'], watermark: true, batchExport: false });
    expect(entitlements.tiers.pro.export.formats).toEqual(['视频', '图文']);
    expect(entitlements.tiers.pro.export.batchExport).toBe(true);
    expect(entitlements.tiers.team.export.formats).toEqual(['视频', '图文', '数据报表']);
    expect(entitlements.tiers.team.export.batchExport).toBe(true);
    expect(entitlements.tiers.enterprise.export.formats).toEqual(['视频', '图文', '数据报表', 'API']);
    expect(entitlements.tiers.enterprise.export.batchExport).toBe(true);
  });
});
