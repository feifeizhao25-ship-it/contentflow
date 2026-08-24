/**
 * AI 生成图片隐式标识（ai-image-label.ts）单元测试。
 *
 * web-cn 没有 jest（见 scripts/check-api-contract.mjs 头部说明），
 * 本脚本只用 Node 内置断言，直接可跑（.mjs 经 strip-types 加载 TS 源文件）：
 *   node --experimental-strip-types scripts/test-ai-image-label.mjs
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

const { buildAiImageLabel, labelImageBuffer } = await import('../src/lib/ai-image-label.ts');
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

console.log('AI image label tests');

// ---- 构造最小合法图片样本 ----

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    typeBuf.copy(chunk, 4);
    data.copy(chunk, 8);
    // 用 zlib.crc32 做与实现无关的独立校验值
    chunk.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 8 + data.length);
    return chunk;
}

function makeMinimalPng() {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);  // width
    ihdr.writeUInt32BE(1, 4);  // height
    ihdr[8] = 8;               // bit depth
    ihdr[9] = 2;               // color type: truecolor
    return Buffer.concat([
        PNG_SIGNATURE,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(Buffer.alloc(4))),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

// SOI + APP0(JFIF) + EOI 的最小 JPEG 骨架
function makeMinimalJpeg() {
    return Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]),
        Buffer.from([0xff, 0xd9]),
    ]);
}

// ---- buildAiImageLabel ----

check('buildAiImageLabel 字段与 API 侧约定一致', () => {
    const label = buildAiImageLabel({ now: new Date('2026-08-23T00:00:00Z') });
    assert.equal(label.ai_generated, true);
    assert.equal(label.generator, AI_GENERATOR_NAME);
    assert.equal(label.media_type, 'image');
    assert.equal(label.generated_at, '2026-08-23T00:00:00.000Z');
    assert.equal(label.model, undefined);
});

check('buildAiImageLabel 带 model 时透传', () => {
    const label = buildAiImageLabel({ model: 'nano-banana-pro' });
    assert.equal(label.model, 'nano-banana-pro');
});

// ---- PNG ----

check('PNG 插入 iTXt(AIGC) chunk，位于 IHDR 之后', () => {
    const png = makeMinimalPng();
    const label = buildAiImageLabel({ now: new Date('2026-08-23T00:00:00Z') });
    const { buffer, format, labeled } = labelImageBuffer(png, label);
    assert.equal(format, 'png');
    assert.equal(labeled, true);
    // 签名不变
    assert.ok(buffer.subarray(0, 8).equals(PNG_SIGNATURE));
    // 第二个 chunk 是 iTXt
    const firstLen = buffer.readUInt32BE(8);
    assert.equal(buffer.toString('ascii', 12, 16), 'IHDR');
    const second = 8 + 12 + firstLen;
    assert.equal(buffer.toString('ascii', second + 4, second + 8), 'iTXt');
    assert.equal(buffer.toString('ascii', second + 8, second + 12), 'AIGC');
});

check('PNG iTXt 内容可解析且字段完整', () => {
    const png = makeMinimalPng();
    const label = buildAiImageLabel({ now: new Date('2026-08-23T00:00:00Z') });
    const { buffer } = labelImageBuffer(png, label);
    const second = 8 + 12 + 13; // 跳过签名 + IHDR chunk
    const dataLen = buffer.readUInt32BE(second);
    const data = buffer.subarray(second + 8, second + 8 + dataLen);
    // iTXt: keyword\0 flag method language\0 translated\0 text
    const text = data.subarray(data.indexOf(0) + 1 + 4).toString('utf8');
    const parsed = JSON.parse(text);
    assert.equal(parsed.ai_generated, true);
    assert.equal(parsed.generator, AI_GENERATOR_NAME);
    assert.equal(parsed.media_type, 'image');
    assert.equal(parsed.generated_at, '2026-08-23T00:00:00.000Z');
});

check('PNG 所有 chunk CRC 写入后仍有效', () => {
    const png = makeMinimalPng();
    const { buffer } = labelImageBuffer(png, buildAiImageLabel());
    let offset = 8;
    let sawItxt = false;
    while (offset + 12 <= buffer.length) {
        const len = buffer.readUInt32BE(offset);
        const typeAndData = buffer.subarray(offset + 4, offset + 8 + len);
        const crc = buffer.readUInt32BE(offset + 8 + len);
        assert.equal(zlib.crc32(typeAndData) >>> 0, crc, `chunk ${typeAndData.toString('ascii', 0, 4)} CRC 不匹配`);
        if (typeAndData.toString('ascii', 0, 4) === 'iTXt') sawItxt = true;
        offset += 12 + len;
    }
    assert.ok(sawItxt);
    assert.equal(offset, buffer.length, 'chunk 遍历应正好走到文件尾');
});

check('PNG 重复写入幂等，不产生第二个 AIGC chunk', () => {
    const png = makeMinimalPng();
    const once = labelImageBuffer(png, buildAiImageLabel()).buffer;
    const twice = labelImageBuffer(once, buildAiImageLabel()).buffer;
    assert.ok(twice.equals(once));
});

// ---- JPEG ----

check('JPEG 在 SOI 后插入 APP1 XMP 段', () => {
    const jpeg = makeMinimalJpeg();
    const label = buildAiImageLabel({ model: 'nano-banana-pro', now: new Date('2026-08-23T00:00:00Z') });
    const { buffer, format, labeled } = labelImageBuffer(jpeg, label);
    assert.equal(format, 'jpeg');
    assert.equal(labeled, true);
    assert.equal(buffer[0], 0xff);
    assert.equal(buffer[1], 0xd8); // SOI
    assert.equal(buffer[2], 0xff);
    assert.equal(buffer[3], 0xe1); // APP1
    const segLen = buffer.readUInt16BE(4);
    const payload = buffer.subarray(6, 4 + segLen).toString('utf8');
    assert.ok(payload.startsWith('http://ns.adobe.com/xap/1.0/\0'));
    assert.ok(payload.includes('aigc:ai_generated="true"'));
    assert.ok(payload.includes(`aigc:generator="${AI_GENERATOR_NAME}"`));
    assert.ok(payload.includes('aigc:media_type="image"'));
    assert.ok(payload.includes('aigc:generated_at="2026-08-23T00:00:00.000Z"'));
    assert.ok(payload.includes('aigc:model="nano-banana-pro"'));
    // 原有 APP0 与 EOI 仍在
    assert.ok(buffer.includes(Buffer.from([0xff, 0xe0])));
    assert.ok(buffer.subarray(buffer.length - 2).equals(Buffer.from([0xff, 0xd9])));
});

check('JPEG XMP 属性值做 XML 转义', () => {
    const jpeg = makeMinimalJpeg();
    const label = buildAiImageLabel({ model: 'a"b<c>&d' });
    const { buffer } = labelImageBuffer(jpeg, label);
    const text = buffer.toString('utf8');
    assert.ok(text.includes('aigc:model="a&quot;b&lt;c&gt;&amp;d"'));
    assert.ok(!text.includes('aigc:model="a"b<c>&d"'));
});

check('JPEG 重复写入幂等', () => {
    const jpeg = makeMinimalJpeg();
    const once = labelImageBuffer(jpeg, buildAiImageLabel()).buffer;
    const twice = labelImageBuffer(once, buildAiImageLabel()).buffer;
    assert.ok(twice.equals(once));
});

// ---- 不支持的格式 ----

check('不支持的格式原样返回并标记 labeled=false', () => {
    const gif = Buffer.from('GIF89a fake payload');
    const { buffer, format, labeled } = labelImageBuffer(gif, buildAiImageLabel());
    assert.equal(format, null);
    assert.equal(labeled, false);
    assert.ok(buffer.equals(gif));
});

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
