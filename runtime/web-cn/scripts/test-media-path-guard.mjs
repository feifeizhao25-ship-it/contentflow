/**
 * 视频合并服务路径穿越回归测试。
 *
 * web-cn 没有 jest（见 scripts/check-api-contract.mjs 头部说明），
 * 本脚本只用 Node 内置断言，直接可跑（.mjs 经 strip-types 加载 TS 源文件）：
 *   node --experimental-strip-types scripts/test-media-path-guard.mjs
 * 退出码：0 通过，1 有失败。
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import {
    resolvePublicMediaPath,
    PUBLIC_MEDIA_ROOT,
    MediaPathError,
} from '../src/lib/media-path-guard.ts';

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

console.log('Media path guard tests');

check('站内合法路径解析到 public/ 内', () => {
    const resolved = resolvePublicMediaPath('/generated/abc.mp4');
    assert.equal(resolved, path.join(PUBLIC_MEDIA_ROOT, 'generated', 'abc.mp4'));
});

check('/../ 相对穿越被拒绝', () => {
    assert.throws(() => resolvePublicMediaPath('/../secret.txt'), MediaPathError);
});

check('/../../ 多级穿越被拒绝', () => {
    assert.throws(() => resolvePublicMediaPath('/../../etc/passwd'), MediaPathError);
});

check('URL 编码穿越（%2e%2e%2f）被拒绝', () => {
    assert.throws(() => resolvePublicMediaPath('/%2e%2e/%2e%2e/etc/passwd'), MediaPathError);
});

check('空字节注入被拒绝', () => {
    assert.throws(() => resolvePublicMediaPath('/generated/a.mp4%00.png'), MediaPathError);
});

check('非 / 开头的路径被拒绝', () => {
    assert.throws(() => resolvePublicMediaPath('etc/passwd'), MediaPathError);
});

check('public 内不存在的子路径仍解析在根内（由调用方判存在性）', () => {
    const resolved = resolvePublicMediaPath('/etc/passwd');
    assert.ok(resolved.startsWith(PUBLIC_MEDIA_ROOT + path.sep));
});

if (failures > 0) {
    console.error(`Result: FAIL (${failures} 项失败)`);
    process.exit(1);
}
console.log('Result: PASS');
