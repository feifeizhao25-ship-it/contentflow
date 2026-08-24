/**
 * AI 隐式标识浏览器端实现（ai-image-label-browser.ts）单元测试。
 *
 * 与 scripts/test-ai-image-label.mjs 同一惯例：
 *   node --experimental-strip-types scripts/test-ai-image-label-browser.mjs
 * 核心逻辑是纯函数（Uint8Array -> Uint8Array），不依赖 canvas/DOM；
 * atob/btoa 在 Node >= 16 为全局函数，data URL 包装层也可直接测。
 * 退出码：0 通过，1 有失败。
 */

import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { registerHooks } from 'node:module';

// strip-types 走的是 ESM 解析，要求相对导入带扩展名；
// 而 Next 项目源码按 bundler 约定不写扩展名。注册一个解析钩子：
// 相对导入解析失败时尝试补 `.ts`，让测试能直接加载源码。
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
            try {
                return nextResolve(specifier, context);
            } catch {
                return nextResolve(`${specifier}.ts`, context);
            }
        }
        return nextResolve(specifier, context);
    },
});

const { buildAiImageLabel, labelPngBytes, labelImageDataUrl, pngHasAigcLabel } =
    await import('../src/lib/ai-image-label-browser.ts');
// 服务端实现：用于交叉验证两端写入结果互相识别（幂等兼容）
const { labelImageBuffer } = await import('../src/lib/ai-image-label.ts');
const { AI_GENERATOR_NAME } = await import('../src/lib/ai-content-label.ts');

let failures = 0;
function check(name, fn) {
    try {
        fn();
        console.log(`  PASS ${name}`);
    } catch (e) {
        failures++;
        console.error(`  FAIL ${name}: ${e.message}`);
    }
}

console.log('AI image label (browser) tests');

// ---- 构造最小合法 PNG 样本（与服务端测试同一套） ----

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    typeBuf.copy(chunk, 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 8 + data.length);
    return chunk;
}

function makeMinimalPng() {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        PNG_SIGNATURE,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(Buffer.alloc(4))),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

// ---- buildAiImageLabel ----

check('buildAiImageLabel 字段与服务端约定一致', () => {
    const label = buildAiImageLabel({ now: new Date('2026-08-23T00:00:00Z') });
    assert.equal(label.ai_generated, true);
    assert.equal(label.generator, AI_GENERATOR_NAME);
    assert.equal(label.media_type, 'image');
    assert.equal(label.generated_at, '2026-08-23T00:00:00.000Z');
    assert.equal(label.model, undefined);
});

check('buildAiImageLabel 带 model 时透传', () => {
    const label = buildAiImageLabel({ model: 'canvas-ai-edit' });
    assert.equal(label.model, 'canvas-ai-edit');
});

// ---- labelPngBytes ----

check('PNG 插入 iTXt(AIGC) chunk，位于 IHDR 之后', () => {
    const png = new Uint8Array(makeMinimalPng());
    const labeled = Buffer.from(labelPngBytes(png, buildAiImageLabel()));
    // 签名不变
    assert.ok(labeled.subarray(0, 8).equals(PNG_SIGNATURE));
    // 第一个 chunk 仍是 IHDR，第二个是 iTXt/AIGC
    const firstLen = labeled.readUInt32BE(8);
    assert.equal(labeled.toString('ascii', 12, 16), 'IHDR');
    const second = 8 + 12 + firstLen;
    assert.equal(labeled.toString('ascii', second + 4, second + 8), 'iTXt');
    assert.equal(labeled.toString('ascii', second + 8, second + 12), 'AIGC');
});

check('PNG iTXt 内容可解析且字段完整', () => {
    const png = new Uint8Array(makeMinimalPng());
    const label = buildAiImageLabel({ model: 'canvas-ai-edit', now: new Date('2026-08-23T00:00:00Z') });
    const labeled = Buffer.from(labelPngBytes(png, label));
    const second = 8 + 12 + 13; // 跳过签名 + IHDR chunk
    const dataLen = labeled.readUInt32BE(second);
    const data = labeled.subarray(second + 8, second + 8 + dataLen);
    // iTXt: keyword\0 flag method language\0 translated\0 text
    const text = data.subarray(data.indexOf(0) + 1 + 4).toString('utf8');
    const parsed = JSON.parse(text);
    assert.equal(parsed.ai_generated, true);
    assert.equal(parsed.generator, AI_GENERATOR_NAME);
    assert.equal(parsed.media_type, 'image');
    assert.equal(parsed.generated_at, '2026-08-23T00:00:00.000Z');
    assert.equal(parsed.model, 'canvas-ai-edit');
});

check('PNG 所有 chunk CRC 写入后仍有效（zlib.crc32 独立校验）', () => {
    const png = new Uint8Array(makeMinimalPng());
    const labeled = Buffer.from(labelPngBytes(png, buildAiImageLabel()));
    let offset = 8;
    let sawItxt = false;
    while (offset + 12 <= labeled.length) {
        const len = labeled.readUInt32BE(offset);
        const typeAndData = labeled.subarray(offset + 4, offset + 8 + len);
        const crc = labeled.readUInt32BE(offset + 8 + len);
        assert.equal(zlib.crc32(typeAndData) >>> 0, crc, `chunk ${typeAndData.toString('ascii', 0, 4)} CRC 不匹配`);
        if (typeAndData.toString('ascii', 0, 4) === 'iTXt') sawItxt = true;
        offset += 12 + len;
    }
    assert.ok(sawItxt);
    assert.equal(offset, labeled.length, 'chunk 遍历应正好走到文件尾');
});

check('重复写入幂等，不产生第二个 AIGC chunk', () => {
    const png = new Uint8Array(makeMinimalPng());
    const once = labelPngBytes(png, buildAiImageLabel());
    const twice = labelPngBytes(once, buildAiImageLabel());
    assert.ok(Buffer.from(twice).equals(Buffer.from(once)));
});

check('与服务端实现交叉幂等：浏览器写入后服务端不再重复写，反之亦然', () => {
    const png = makeMinimalPng();
    // 浏览器写 -> 服务端识别为已标识
    const byBrowser = labelPngBytes(new Uint8Array(png), buildAiImageLabel());
    const serverAgain = labelImageBuffer(Buffer.from(byBrowser), buildAiImageLabel());
    assert.equal(serverAgain.labeled, true);
    assert.ok(serverAgain.buffer.equals(Buffer.from(byBrowser)));
    // 服务端写 -> 浏览器识别为已标识
    const byServer = labelImageBuffer(png, buildAiImageLabel()).buffer;
    const browserAgain = labelPngBytes(new Uint8Array(byServer), buildAiImageLabel());
    assert.ok(Buffer.from(browserAgain).equals(byServer));
});

check('非 PNG 输入原样返回', () => {
    const gif = new Uint8Array(Buffer.from('GIF89a fake payload'));
    const out = labelPngBytes(gif, buildAiImageLabel());
    assert.equal(out, gif); // 同一引用，未拷贝未修改
    assert.equal(pngHasAigcLabel(new Uint8Array(makeMinimalPng())), false);
});

// ---- labelImageDataUrl ----

check('PNG data URL 写入标识且可往返解码', () => {
    const png = makeMinimalPng();
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    const labeled = labelImageDataUrl(dataUrl, buildAiImageLabel({ now: new Date('2026-08-23T00:00:00Z') }));
    assert.ok(labeled.startsWith('data:image/png;base64,'));
    const decoded = Buffer.from(labeled.slice('data:image/png;base64,'.length), 'base64');
    assert.ok(decoded.subarray(0, 8).equals(PNG_SIGNATURE));
    // 包含 AIGC iTXt chunk，且服务端实现视为已标识
    const serverAgain = labelImageBuffer(decoded, buildAiImageLabel());
    assert.ok(serverAgain.buffer.equals(decoded));
    assert.ok(decoded.includes(Buffer.from('"ai_generated":true')));
});

check('非 PNG data URL 原样返回', () => {
    const jpegUrl = 'data:image/jpeg;base64,/9j/4AAQ';
    assert.equal(labelImageDataUrl(jpegUrl, buildAiImageLabel()), jpegUrl);
});

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
