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

export interface EntitlementStatusEntry {
    label: string;
    /** enforced：后端有执行点（enforcedAt 指向 runtime/api 下的文件与代码片段）；coming_soon：尚未执行，界面标「即将上线」。 */
    status: 'enforced' | 'coming_soon';
    enforcedAt?: { file: string; contains: string };
    note?: string;
}

export interface EntitlementsRegistry {
    product: string;
    version: string;
    tiers: Record<TierId, TierEntitlement>;
    /** 键为「维度.权益」，例如 quotas.monthlyPosts。每条权益都必须登记。 */
    entitlementStatus?: Record<string, EntitlementStatusEntry>;
    /** 套餐卖点（features）里依赖尚未上线权益的条目，界面上标「即将上线」。 */
    comingSoonFeatures?: string[];
}

/** 列出所有套餐里出现过的权益键（维度.权益）。 */
export function entitlementKeys(registry: EntitlementsRegistry): string[] {
    const keys = new Set<string>();
    for (const id of TIER_IDS) {
        const tier = registry.tiers[id];
        if (!tier) continue;
        for (const dim of DIMENSIONS) {
            for (const key of Object.keys((tier as unknown as Record<string, Record<string, unknown>>)[dim] ?? {})) {
                keys.add(`${dim}.${key}`);
            }
        }
    }
    return [...keys];
}

export function isComingSoonFeature(registry: EntitlementsRegistry, feature: string): boolean {
    return (registry.comingSoonFeatures ?? []).includes(feature);
}

function describeValue(key: string, label: string, value: unknown): string | null {
    if (value === false || value === null || value === undefined || value === 0) {
        // 「水印」是反向的：watermark=false 才是卖点「去水印」
        return key === 'export.watermark' && value === false ? label : null;
    }
    if (key === 'export.watermark') return null; // watermark=true 是限制，不是权益
    if (value === true) return label;
    if (value === -1) return `${label}：不限`;
    if (Array.isArray(value)) return value.length ? `${label}：${value.join('、')}` : null;
    if (key === 'quotas.videoMinutesMonthly') return `${label}：每月 ${value} 分钟`;
    if (key === 'quotas.storageGb') return `${label}：${value} GB`;
    if (key === 'quotas.platformAccounts') return `${label}：${value} 个`;
    if (key === 'collaboration.seats') return `${label}：${value} 人`;
    if (key === 'personalization.personaCount') return `${label}：${value} 个`;
    return `${label}：${String(value)}`;
}

/** 某档套餐里「即将上线」的权益，按可读文案返回（值为 false/0 的不列）。 */
export function comingSoonEntitlements(registry: EntitlementsRegistry, tierId: TierId): string[] {
    const tier = registry.tiers[tierId];
    const statuses = registry.entitlementStatus ?? {};
    if (!tier) return [];
    const out: string[] = [];
    for (const [key, entry] of Object.entries(statuses)) {
        if (entry.status !== 'coming_soon') continue;
        const [dim, name] = key.split('.');
        const value = (tier as unknown as Record<string, Record<string, unknown>>)[dim]?.[name];
        const text = describeValue(key, entry.label, value);
        if (text) out.push(text);
    }
    return out;
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
    if (errors.length) return errors;
    // 每条权益都要登记执行状态：要么后端有执行点，要么标「即将上线」。
    const statuses = (r as EntitlementsRegistry).entitlementStatus;
    if (!statuses || typeof statuses !== 'object') {
        errors.push('缺少 entitlementStatus（每条权益的执行状态）');
        return errors;
    }
    for (const key of entitlementKeys(r as EntitlementsRegistry)) {
        const entry = statuses[key];
        if (!entry) {
            errors.push(`${key}: 未登记执行状态`);
            continue;
        }
        if (entry.status === 'enforced') {
            if (!entry.enforcedAt?.file || !entry.enforcedAt?.contains) errors.push(`${key}: 标为 enforced 但没有写执行点`);
        } else if (entry.status !== 'coming_soon') {
            errors.push(`${key}: status 只能是 enforced 或 coming_soon`);
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
    /** features 中依赖未上线权益的条目 */
    comingSoonFeatures: string[];
    /** 本档套餐里尚未执行、界面需标「即将上线」的权益 */
    comingSoon: string[];
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
            comingSoonFeatures: tier.features.filter((f) => isComingSoonFeature(registry, f)),
            comingSoon: comingSoonEntitlements(registry, id),
        };
    });
}
