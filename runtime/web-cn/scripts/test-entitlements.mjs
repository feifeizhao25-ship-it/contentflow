/**
 * 会员权益注册表 + 定价页兜底/错误态 + 中文 404 页 回归测试。
 *
 * web-cn 没有 jest（见 scripts/check-api-contract.mjs 头部说明），
 * 本脚本只用 Node 内置断言，直接可跑（.mjs 经 strip-types 加载 TS 源文件）：
 *   node --experimental-strip-types scripts/test-entitlements.mjs
 * 退出码：0 通过，1 有失败。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    TIER_IDS,
    validateEntitlements,
    buildFallbackPlans,
} from '../src/lib/entitlements.ts';
import { CN_PLANS } from '../../api/src/modules/billing/plans.constant.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const registry = JSON.parse(readSrc('src/lib/entitlements.json'));

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

console.log('Entitlements registry & pricing fallback tests');

// ---------- 注册表 schema ----------
check('注册表 schema 校验通过', () => {
    assert.deepEqual(validateEntitlements(registry), []);
});

check('注册表包含 product/version 与全部四档套餐', () => {
    assert.equal(registry.product, 'contentflow-cn');
    assert.ok(registry.version);
    assert.deepEqual(Object.keys(registry.tiers).sort(), [...TIER_IDS].sort());
});

check('每档套餐含六个权益维度', () => {
    for (const id of TIER_IDS) {
        for (const dim of ['quotas', 'knowledge', 'personalization', 'export', 'collaboration', 'service']) {
            assert.ok(registry.tiers[id][dim] && typeof registry.tiers[id][dim] === 'object', `${id} 缺 ${dim}`);
        }
    }
});

check('缺维度的注册表被拒绝（负例）', () => {
    const broken = JSON.parse(JSON.stringify(registry));
    delete broken.tiers.pro.export;
    assert.ok(validateEntitlements(broken).length > 0);
});

// ---------- 与后端 CN_PLANS 同源 ----------
check('注册表价格/配额与后端 CN_PLANS 一致', () => {
    for (const plan of CN_PLANS) {
        const tier = registry.tiers[plan.id];
        assert.ok(tier, `注册表缺少 ${plan.id}`);
        assert.equal(tier.name, plan.name, `${plan.id} name`);
        assert.equal(tier.priceMonthlyCny, plan.priceMonthlyCny, `${plan.id} 月价`);
        assert.equal(tier.priceYearlyCny, plan.priceYearlyCny, `${plan.id} 年价`);
        assert.equal(tier.custom, plan.custom, `${plan.id} custom`);
        assert.equal(tier.quotas.platformAccounts, plan.platformLimit, `${plan.id} 平台数`);
        assert.equal(tier.quotas.monthlyPosts, plan.monthlyPostQuota, `${plan.id} 发布条数`);
        assert.equal(tier.quotas.monthlyAiTokens, plan.aiTokenQuota, `${plan.id} AI 令牌`);
        assert.deepEqual(tier.features, plan.features, `${plan.id} features`);
    }
});

// ---------- 定价页静态兜底 ----------
check('兜底套餐覆盖全部四档且字段与注册表一致', () => {
    const plans = buildFallbackPlans(registry);
    assert.equal(plans.length, 4);
    for (const p of plans) {
        const tier = registry.tiers[p.id];
        assert.equal(p.name, tier.name);
        assert.equal(p.priceMonthlyCny, tier.priceMonthlyCny);
        assert.deepEqual(p.features, tier.features);
    }
});

check('定价页使用注册表兜底且错误文案为友好中文', () => {
    const src = readSrc('src/app/(main)/pricing/page.tsx');
    assert.ok(src.includes('buildFallbackPlans'), '未使用注册表兜底');
    assert.ok(src.includes('价格信息加载失败，请稍后重试'), '缺友好错误文案');
    assert.ok(src.includes('重试'), '缺重试按钮');
    assert.ok(!src.includes('plansError}'), '不得把异常 message 原文渲染上屏');
});

check('定价页无英文角标残留', () => {
    const src = readSrc('src/app/(main)/pricing/page.tsx');
    assert.ok(!src.includes('Early Access Discount'), '英文角标未移除');
    assert.ok(src.includes('早鸟优惠'), '缺中文角标');
});

// ---------- API 客户端友好错误 ----------
check('API 客户端统一收敛解析/网络错误为友好中文', () => {
    const src = readSrc('src/lib/api-client.ts');
    assert.ok(src.includes('FriendlyApiError'), '缺 FriendlyApiError');
    assert.ok(src.includes('服务响应异常，请稍后重试'), '缺解析失败友好文案');
    assert.ok(src.includes('网络连接失败，请稍后重试'), '缺网络失败友好文案');
    assert.ok(!src.includes('API request failed'), '英文错误文案未清理');
});

// ---------- /api/entitlements 路由 ----------
check('/api/entitlements 路由返回注册表', () => {
    const src = readSrc('src/app/api/entitlements/route.ts');
    assert.ok(src.includes('entitlements.json'), '路由未读注册表');
    assert.ok(src.includes('validateEntitlements'), '路由未做 schema 校验');
});

// ---------- 中文 404 页与 proxy 放行 ----------
check('存在中文 404 页且带返回首页入口', () => {
    const src = readSrc('src/app/not-found.tsx');
    assert.ok(src.includes('404'), '缺 404 标识');
    assert.ok(src.includes('页面不存在'), '缺中文说明');
    assert.ok(src.includes('返回首页'), '缺返回首页入口');
    assert.ok(src.includes('href="/"'), '缺首页链接');
});

check('proxy 区分受保护路径与未知路径', () => {
    const src = readSrc('src/proxy.ts');
    assert.ok(src.includes('PROTECTED_SEGMENTS'), '缺受保护路径清单');
    assert.ok(src.includes("'/pricing'"), '定价页应保持公开');
    assert.ok(src.includes("'/register'"), '注册页应保持公开');
});

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
