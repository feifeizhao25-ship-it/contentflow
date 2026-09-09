import assert from 'node:assert/strict';
import { mergeAttributes } from '@tiptap/core';

// Untrusted JSON can contain an own __proto__ property even though an object
// literal with the same spelling behaves differently. Check the real library.
const untrusted = JSON.parse('{"__proto__":{"onerror":"untrusted-handler","src":"untrusted-source"},"class":"imported"}');
const merged = mergeAttributes({ class: 'editor' }, untrusted);
assert.equal(Object.getPrototypeOf(merged), Object.prototype);
assert.equal(merged.onerror, undefined);
assert.equal(merged.src, undefined);
const enumerated = [];
for (const name in merged) enumerated.push(name);
assert.ok(!enumerated.includes('onerror'));
assert.ok(!enumerated.includes('src'));
assert.equal(merged.class, 'editor imported');
console.log('PASS 编辑器导入属性不会继承 JSON 注入的事件处理属性');
