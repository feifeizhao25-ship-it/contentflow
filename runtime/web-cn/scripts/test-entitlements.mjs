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
    entitlementKeys,
    comingSoonEntitlements,
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

// ---------- 门禁：每条权益要么有执行点，要么标「即将上线」 ----------
// 审计（P0-3 / 第 6 点）：视频分钟、席位、水印、批量导出、审批流、人设数在注册表里写着，
// 后端没有任何执行点。卖了没执行的权益必须在界面上标「即将上线」。
const apiRoot = path.join(root, '..', 'api');
check('门禁：注册表每条权益都登记了执行状态（enforced 或 coming_soon）', () => {
    const keys = entitlementKeys(registry);
    assert.ok(keys.length >= 20, `权益键太少：${keys.length}`);
    for (const key of keys) {
        const entry = registry.entitlementStatus?.[key];
        assert.ok(entry, `${key} 未登记执行状态`);
        assert.ok(['enforced', 'coming_soon'].includes(entry.status), `${key} status=${entry.status}`);
        assert.ok(entry.label && /[\u4e00-\u9fff]/.test(entry.label), `${key} 缺中文名称`);
    }
});

check('门禁：标 enforced 的权益在 runtime/api 源码（非测试文件）里真有执行点', () => {
    for (const [key, entry] of Object.entries(registry.entitlementStatus)) {
        if (entry.status !== 'enforced') continue;
        const rel = entry.enforcedAt?.file ?? '';
        assert.ok(rel.startsWith('src/') && !/\.spec\.ts$/.test(rel), `${key} 执行点必须是 api 的非测试源码：${rel}`);
        const file = path.join(apiRoot, rel);
        assert.ok(fs.existsSync(file), `${key} 执行点文件不存在：${rel}`);
        assert.ok(fs.readFileSync(file, 'utf8').includes(entry.enforcedAt.contains), `${key} 执行点代码不存在：${rel} 中没有「${entry.enforcedAt.contains}」`);
    }
});

check('门禁：审计点名的 6 项没有执行点的权益都标为 coming_soon', () => {
    for (const key of ['quotas.videoMinutesMonthly', 'collaboration.seats', 'collaboration.approvalWorkflow', 'export.watermark', 'export.batchExport', 'personalization.personaCount']) {
        assert.equal(registry.entitlementStatus[key]?.status, 'coming_soon', key);
    }
});

check('门禁负例：删掉一条权益的状态、或把执行点指向不存在的代码，都会被拦', () => {
    const missing = JSON.parse(JSON.stringify(registry));
    delete missing.entitlementStatus['export.batchExport'];
    assert.ok(validateEntitlements(missing).some((e) => e.includes('export.batchExport')));
    const noRef = JSON.parse(JSON.stringify(registry));
    noRef.entitlementStatus['export.batchExport'] = { label: '批量导出', status: 'enforced' };
    assert.ok(validateEntitlements(noRef).some((e) => e.includes('没有写执行点')));
});

check('即将上线的权益会出现在套餐卡上（专业版：视频时长、去水印、批量导出、人设数）', () => {
    const pro = comingSoonEntitlements(registry, 'pro').join('|');
    assert.match(pro, /视频生成时长：每月 120 分钟/);
    assert.match(pro, /去水印/);
    assert.match(pro, /批量导出/);
    assert.match(pro, /人设数量：5 个/);
    const free = comingSoonEntitlements(registry, 'free').join('|');
    assert.doesNotMatch(free, /去水印|批量导出/, '免费版没有的权益不该列出');
    const team = buildFallbackPlans(registry).find((p) => p.id === 'team');
    assert.ok(team.comingSoonFeatures.includes('团队协作与审批'));
});

check('定价页与首页把未执行的权益标「即将上线」', () => {
    for (const rel of ['src/app/(main)/pricing/page.tsx', 'src/app/page.tsx']) {
        const src = readSrc(rel);
        assert.ok(src.includes('即将上线'), `${rel} 缺「即将上线」标注`);
        assert.ok(/comingSoon/.test(src), `${rel} 未读取注册表里的即将上线权益`);
    }
});

check('团队页：后端邀请未接通时，「邀请成员」按钮不可点并标「即将上线」', () => {
    const teamService = fs.readFileSync(path.join(apiRoot, 'src/modules/team/team.service.ts'), 'utf8');
    const page = readSrc('src/app/(main)/team/page.tsx');
    if (teamService.includes('尚未配置')) {
        assert.match(page, /const TEAM_INVITE_AVAILABLE = false;/, '后端邀请未接通，前端却放开了邀请按钮');
        assert.match(page, /disabled=\{!TEAM_INVITE_AVAILABLE\}/, '邀请按钮没有按开关置灰');
        assert.match(page, /即将上线/);
        assert.equal(registry.entitlementStatus['collaboration.seats'].status, 'coming_soon');
    }
});

check('旧付费弹窗（¥49/划线 ¥59/无限 AI/4K/去水印/7 天无理由、写死 16/20 的额度条）已删除', () => {
    assert.ok(!fs.existsSync(path.join(root, 'src/components/membership/PremiumGate.tsx')), 'PremiumGate.tsx 仍在');
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
    for (const file of walk(path.join(root, 'src')).filter((f) => /\.(tsx?|jsx?)$/.test(f))) {
        const src = fs.readFileSync(file, 'utf8');
        assert.ok(!/UpgradeModal|ShareToUnlock|QuotaDisplay\b/.test(src.replace(/showUpgradeModal|setShowUpgradeModal/g, '')), `${path.relative(root, file)} 仍引用旧付费组件`);
        assert.ok(!/无限 ?AI ?生成|7 ?天无理由/.test(src), `${path.relative(root, file)} 仍有与套餐不符的宣传`);
    }
});

check('定价页可选按年付费，并把周期传给下单接口', () => {
    const src = readSrc('src/app/(main)/pricing/page.tsx');
    assert.match(src, /setIsYearly/, '没有年付切换');
    assert.match(src, /按年付费/);
    assert.match(src, /billingCycle: isYearly \? 'yearly' : 'monthly'/);
    assert.doesNotMatch(src, /const \[isYearly\] = useState\(false\)/, '年付仍被写死为 false');
    const home = readSrc('src/app/page.tsx');
    if (/按年订阅/.test(home)) assert.match(home, /cycle=yearly/, '首页展示年付却没有可购买的入口');
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
    assert.ok(src.includes('会员方案'), '缺中文角标');
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

check('权限 Hook 使用注册表完整覆盖团队版和有限付费额度', () => {
    const src = readSrc('src/hooks/usePermissions.ts');
    assert.ok(src.includes('entitlements.json'), '权限 Hook 未读取权益注册表');
    assert.ok(src.includes('SubscriptionPlan = TierId'), '套餐类型未覆盖完整注册表');
    assert.ok(src.includes("subscription.plan !== 'free'"), '团队版未统一识别为付费权益');
    assert.ok(!src.includes('const FREE_LIMITS'), '仍保留重复的硬编码套餐额度');
    assert.ok(!src.includes("subscription.plan !== 'free') return true"), '付费套餐仍错误绕过有限额度检查');
});

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
