/**
 * AI 生成图片隐式标识（AIGC labeling）— 文件元数据写入。
 *
 * 与 `ai-content-label.ts` 的约定一致：
 * 文本用显式标识，媒体文件在导出时写入隐式元数据标识。
 * 视频走 ffmpeg 元数据，图片没有容器级的通用 metadata 概念，
 * 这里按格式分别写入：
 *  - PNG：IHDR 之后插入 iTXt chunk（keyword=AIGC，值为 JSON，UTF-8）；
 *  - JPEG：SOI 之后插入 APP1 XMP 段（aigc:* 字段）。
 *
 * 纯 Node 实现（CRC32 + chunk 拼接），不引入图片处理依赖。
 */

import { AI_GENERATOR_NAME } from './ai-content-label';

/** 隐式标识字段，与 API 侧 buildAiMediaMetadata 的输出结构一致 */
export interface AiImageLabel {
    ai_generated: true;
    generator: string;
    media_type: 'image';
    generated_at: string;
    model?: string;
}

export function buildAiImageLabel(opts: { model?: string; now?: Date } = {}): AiImageLabel {
    const label: AiImageLabel = {
        ai_generated: true,
        generator: AI_GENERATOR_NAME,
        media_type: 'image',
        generated_at: (opts.now || new Date()).toISOString(),
    };
    if (opts.model) label.model = opts.model;
    return label;
}

export type LabeledImageFormat = 'png' | 'jpeg' | null;

export interface LabeledImage {
    buffer: Buffer;
    format: LabeledImageFormat;
    /** false 表示格式不支持、未能写入（buffer 原样返回） */
    labeled: boolean;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC32（PNG chunk 校验用），表驱动纯实现
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function buildPngChunk(type: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(type, 'ascii');
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    typeBuf.copy(chunk, 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
    return chunk;
}

/** 未压缩 iTXt：keyword\0 flag(0) method(0) language\0 translated\0 utf8-text */
function buildAigcItxtChunk(label: AiImageLabel): Buffer {
    const data = Buffer.concat([
        Buffer.from('AIGC', 'ascii'),
        Buffer.from([0, 0, 0, 0, 0]),
        Buffer.from(JSON.stringify(label), 'utf8'),
    ]);
    return buildPngChunk('iTXt', data);
}

function pngHasAigcLabel(buf: Buffer): boolean {
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= buf.length) {
        const length = buf.readUInt32BE(offset);
        const type = buf.toString('ascii', offset + 4, offset + 8);
        if (type === 'iTXt' && buf.toString('ascii', offset + 8, offset + 12) === 'AIGC') {
            return true;
        }
        offset += 12 + length;
    }
    return false;
}

function labelPng(buf: Buffer, label: AiImageLabel): Buffer {
    if (pngHasAigcLabel(buf)) return buf; // 幂等：已有标识不重复写入
    // IHDR 固定在签名之后（length + type + 13 字节数据 + CRC = 25 字节），iTXt 插在其后
    const ihdrEnd = PNG_SIGNATURE.length + 25;
    return Buffer.concat([buf.subarray(0, ihdrEnd), buildAigcItxtChunk(label), buf.subarray(ihdrEnd)]);
}

const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';

function escapeXmlAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildAigcXmpPacket(label: AiImageLabel): string {
    const modelAttr = label.model ? ` aigc:model="${escapeXmlAttr(label.model)}"` : '';
    return (
        `<x:xmpmeta xmlns:x="adobe:ns:meta/">` +
        `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
        `<rdf:Description xmlns:aigc="urn:contentflow:aigc:1.0:"` +
        ` aigc:ai_generated="true"` +
        ` aigc:generator="${escapeXmlAttr(label.generator)}"` +
        ` aigc:media_type="image"` +
        ` aigc:generated_at="${escapeXmlAttr(label.generated_at)}"` +
        `${modelAttr}/>` +
        `</rdf:RDF></x:xmpmeta>`
    );
}

function labelJpeg(buf: Buffer, label: AiImageLabel): Buffer {
    if (buf.includes(Buffer.from('aigc:ai_generated', 'ascii'))) return buf; // 幂等
    const payload = Buffer.concat([Buffer.from(XMP_HEADER, 'ascii'), Buffer.from(buildAigcXmpPacket(label), 'utf8')]);
    // APP1 段：FFE1 + 长度(含自身 2 字节) + 负载
    const segment = Buffer.alloc(4 + payload.length);
    segment.writeUInt16BE(0xffe1, 0);
    segment.writeUInt16BE(payload.length + 2, 2);
    payload.copy(segment, 4);
    // 插在 SOI（FFD8）之后
    return Buffer.concat([buf.subarray(0, 2), segment, buf.subarray(2)]);
}

/**
 * 给生成的图片 Buffer 写入 AI 生成隐式标识。
 * 支持 PNG / JPEG；其他格式原样返回并标记 labeled=false，
 * 由调用方决定降级策略（不允许为写入标识而转码改画质）。
 */
export function labelImageBuffer(image: Buffer | Uint8Array, label: AiImageLabel): LabeledImage {
    const buf = Buffer.isBuffer(image) ? image : Buffer.from(image);
    if (buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
        return { buffer: labelPng(buf, label), format: 'png', labeled: true };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { buffer: labelJpeg(buf, label), format: 'jpeg', labeled: true };
    }
    return { buffer: buf, format: null, labeled: false };
}
