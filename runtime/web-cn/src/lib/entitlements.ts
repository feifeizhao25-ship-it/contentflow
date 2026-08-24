/**
 * 会员权益注册表（单一事实源）。
 *
 * 数据本体在 ./entitlements.json，定价页静态兜底、套餐卡渲染、
 * /api/entitlements 路由以及后端/客服均从这一份 JSON 读取。
 * 配额口径与后端 runtime/api/src/modules/billing/plans.constant.ts 的
 * CN_PLANS 保持一致；-1 表示不限（企业定制）。
 *
 * 本模块不直接 import JSON（Node 裸跑需要 import attribute，而打包器不要求），
 * 由消费方自行导入 JSON 后传入这里的纯函数，保证 node --experimental-strip-types
 * 测试与 Next.js 构建走同一份校验逻辑。
 */

export const TIER_IDS = ['free', 'pro', 'team', 'enterprise'] as const;
export type TierId = (typeof TIER_IDS)[number];

const DIMENSIONS = [
    'quotas',
    'knowledge',
    'personalization',
    'export',
    'collaboration',
    'service',
] as const;

export interface TierEntitlement {
    name: string;
    priceMonthlyCny: number | null;
    priceYearlyCny: number | null;
    custom: boolean;
    features: string[];
    quotas: Record<string, number>;
    knowledge: Record<string, unknown>;
    personalization: Record<string, unknown>;
    export: Record<string, unknown>;
    collaboration: Record<string, unknown>;
    service: Record<string, unknown>;
}

export interface EntitlementsRegistry {
    product: string;
    version: string;
    tiers: Record<TierId, TierEntitlement>;
}

/** 校验注册表 schema，返回错误列表（空数组 = 通过）。 */
export function validateEntitlements(input: unknown): string[] {
    const errors: string[] = [];
    const r = input as Partial<EntitlementsRegistry> | null;
    if (!r || typeof r !== 'object') return ['注册表必须是对象'];
    if (typeof r.product !== 'string' || !r.product) errors.push('缺少 product');
    if (typeof r.version !== 'string' || !r.version) errors.push('缺少 version');
    if (!r.tiers || typeof r.tiers !== 'object') {
        errors.push('缺少 tiers');
        return errors;
    }
    for (const id of TIER_IDS) {
        const tier = (r.tiers as Record<string, Partial<TierEntitlement>>)[id];
        if (!tier) {
            errors.push(`缺少套餐 ${id}`);
            continue;
        }
        if (typeof tier.name !== 'string' || !tier.name) errors.push(`${id}: 缺少 name`);
        if (tier.priceMonthlyCny !== null && typeof tier.priceMonthlyCny !== 'number') {
            errors.push(`${id}: priceMonthlyCny 必须是数字或 null`);
        }
        if (tier.priceYearlyCny !== null && typeof tier.priceYearlyCny !== 'number') {
            errors.push(`${id}: priceYearlyCny 必须是数字或 null`);
        }
        if (typeof tier.custom !== 'boolean') errors.push(`${id}: 缺少 custom`);
        if (!Array.isArray(tier.features) || tier.features.length === 0) {
            errors.push(`${id}: features 必须是非空数组`);
        }
        for (const dim of DIMENSIONS) {
            const value = (tier as Record<string, unknown>)[dim];
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                errors.push(`${id}: 缺少权益维度 ${dim}`);
            }
        }
        if (tier.custom !== (tier.priceMonthlyCny === null)) {
            errors.push(`${id}: custom 与定制报价（priceMonthlyCny 为 null）不一致`);
        }
    }
    return errors;
}

export interface FallbackPlan {
    id: TierId;
    name: string;
    priceMonthlyCny: number | null;
    priceYearlyCny: number | null;
    custom: boolean;
    features: string[];
}

/** 定价页静态兜底套餐：接口失败/加载中时保证全部套餐卡可渲染。 */
export function buildFallbackPlans(registry: EntitlementsRegistry): FallbackPlan[] {
    return TIER_IDS.map((id) => {
        const tier = registry.tiers[id];
        return {
            id,
            name: tier.name,
            priceMonthlyCny: tier.priceMonthlyCny,
            priceYearlyCny: tier.priceYearlyCny,
            custom: tier.custom,
            features: [...tier.features],
        };
    });
}
