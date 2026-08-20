interface Plan {
  id: string;
  name: string;
  priceMonthlyCny: number | null;
  platformLimit: number;
  monthlyPostQuota: number;
  custom: boolean;
  features: string[];
}

async function loadPlans(): Promise<Plan[]> {
  const origin = process.env.API_INTERNAL_URL || 'http://api:4000';
  try {
    const response = await fetch(`${origin}/api/v1/billing/plans`, { cache: 'no-store' });
    if (!response.ok) return [];
    const payload = await response.json();
    const data = payload?.data ?? payload;
    return data?.market === 'cn' && Array.isArray(data?.plans) ? data.plans : [];
  } catch {
    return [];
  }
}

function price(plan: Plan) {
  if (plan.custom || plan.priceMonthlyCny === null) return '定制报价';
  return plan.priceMonthlyCny === 0 ? '¥0' : `¥${plan.priceMonthlyCny}/月`;
}

function limit(value: number, unit: string) {
  return value < 0 ? `按合同约定${unit}` : `${value} ${unit}`;
}

export default async function PricingPage() {
  const plans = await loadPlans();
  return (
    <main className="max-w-7xl mx-auto space-y-10">
      <div className="text-center max-w-3xl mx-auto">
        <div className="text-sm font-semibold text-indigo-600">会员权益</div>
        <h1 className="text-4xl font-black mt-3">按真实发布规模选择套餐</h1>
        <p className="text-zinc-500 mt-4">套餐目录由国内 API 统一提供。支付、权益发放、取消与退款闭环完成前，升级按钮保持关闭。</p>
      </div>
      {plans.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">套餐服务暂不可用，请稍后重试；系统不会显示过期价格或模拟购买成功。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col shadow-sm">
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <div className="text-3xl font-black mt-4">{price(plan)}</div>
              <div className="text-sm text-zinc-500 mt-4 space-y-1">
                <p>{limit(plan.platformLimit, '个平台账号')}</p>
                <p>{limit(plan.monthlyPostQuota, '次发布/月')}</p>
              </div>
              <ul className="mt-5 space-y-2 text-sm flex-1">
                {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
              </ul>
              <button type="button" disabled className="mt-6 rounded-xl bg-zinc-100 px-4 py-3 text-zinc-500 cursor-not-allowed">
                {plan.id === 'free' ? '注册后使用免费额度' : '支付闭环验证后开放'}
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
