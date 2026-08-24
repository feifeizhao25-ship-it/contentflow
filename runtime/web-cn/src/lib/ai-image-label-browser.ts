/**
 * AI 生成/辅助编辑图片隐式标识 — 浏览器端实现。
 *
 * 与 `ai-image-label.ts`（服务端 Node 实现）字段约定一致：
 * PNG 在 IHDR 之后插入 iTXt chunk（keyword=AIGC，值为 JSON，UTF-8）。
 * 用于 ImageEditor 画布导出（canvas.toDataURL 客户端下载）等纯浏览器链路。
 *
 * 纯 TypeScript 实现：核心函数输入输出均为 Uint8Array，
 * 不依赖 Buffer / Node API，可在浏览器与 Node 测试中通用。
 */

import { AI_GENERATOR_NAME } from './ai-content-label';

/** 隐式标识字段，与服务端 buildAiImageLabel 的输出结构一致 */
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

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC32（PNG chunk 校验用），表驱动纯实现，与服务端一致
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

function crc32(buf: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function asciiBytes(text: string): Uint8Array {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0x7f;
    return bytes;
}

function asciiString(buf: Uint8Array, start: number, end: number): string {
    let s = '';
    for (let i = start; i < end; i++) s += String.fromCharCode(buf[i]);
    return s;
}

function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = asciiBytes(type);
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    const crcInput = chunk.subarray(4, 8 + data.length);
    view.setUint32(8 + data.length, crc32(crcInput));
    return chunk;
}

/** 未压缩 iTXt：keyword\0 flag(0) method(0) language\0 translated\0 utf8-text */
function buildAigcItxtChunk(label: AiImageLabel): Uint8Array {
    const keyword = asciiBytes('AIGC');
    const text = new TextEncoder().encode(JSON.stringify(label));
    const data = new Uint8Array(keyword.length + 5 + text.length);
    data.set(keyword, 0);
    // 中间 5 字节（flag/method/language\0/translated\0）已为 0
    data.set(text, keyword.length + 5);
    return buildPngChunk('iTXt', data);
}

export function pngHasAigcLabel(buf: Uint8Array): boolean {
    let offset = PNG_SIGNATURE.length;
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    while (offset + 12 <= buf.length) {
        const length = view.getUint32(offset);
        const type = asciiString(buf, offset + 4, offset + 8);
        if (type === 'iTXt' && asciiString(buf, offset + 8, offset + 12) === 'AIGC') {
            return true;
        }
        offset += 12 + length;
    }
    return false;
}

function isPng(buf: Uint8Array): boolean {
    if (buf.length < PNG_SIGNATURE.length) return false;
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (buf[i] !== PNG_SIGNATURE[i]) return false;
    }
    return true;
}

/**
 * 给 PNG 字节写入 AI 隐式标识（iTXt/AIGC chunk，位于 IHDR 之后）。
 * 幂等：已含 AIGC 标识或非 PNG 输入时原样返回。
 */
export function labelPngBytes(png: Uint8Array, label: AiImageLabel): Uint8Array {
    if (!isPng(png)) return png;
    if (pngHasAigcLabel(png)) return png;
    // IHDR 固定在签名之后（length + type + 13 字节数据 + CRC = 25 字节），iTXt 插在其后
    const ihdrEnd = PNG_SIGNATURE.length + 25;
    const itxt = buildAigcItxtChunk(label);
    const out = new Uint8Array(png.length + itxt.length);
    out.set(png.subarray(0, ihdrEnd), 0);
    out.set(itxt, ihdrEnd);
    out.set(png.subarray(ihdrEnd), ihdrEnd + itxt.length);
    return out;
}

function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const CHUNK = 0x8000; // 分片避免 apply 参数过多
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

/**
 * 给 PNG data URL（canvas.toDataURL('image/png') 的产物）写入隐式标识。
 * 非 PNG data URL 原样返回（不转码、不改画质）。
 */
export function labelImageDataUrl(dataUrl: string, label: AiImageLabel): string {
    const prefix = 'data:image/png;base64,';
    if (!dataUrl.startsWith(prefix)) return dataUrl;
    const labeled = labelPngBytes(base64ToBytes(dataUrl.slice(prefix.length)), label);
    return prefix + bytesToBase64(labeled);
}
