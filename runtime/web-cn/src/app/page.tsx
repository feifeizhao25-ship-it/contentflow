import Link from 'next/link';
import registry from '@/lib/entitlements.json';
import { buildFallbackPlans } from '@/lib/entitlements';

export default function Home() {
  const capabilities = [
    ['一稿多平台适配', '按平台语气、长度和内容结构生成候选版本；发布前可逐条检查和修改。'],
    ['证据与时效提示', '对引用来源、采集时间、适用平台和不确定内容进行标记，降低过期信息误发风险。'],
    ['审批后再发布', '草稿、审核、排期、发布和失败重试全程留痕；默认不让 AI 绕过人工确认。'],
    ['数据驱动复盘', '只根据已接入平台的真实数据做归因；数据不足时明确显示“暂无结论”。'],
  ];
  const plans = buildFallbackPlans(registry).map((plan) => ({
    ...plan,
    price: plan.custom ? '联系咨询' : `¥${plan.priceMonthlyCny}${plan.priceMonthlyCny ? '/月' : ''}`,
    note: plan.priceYearlyCny ? `按年订阅 ¥${plan.priceYearlyCny}/年` : '查看完整额度与开通条件',
    recommended: plan.id === 'team',
  }));

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-black"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">分</span><span className="text-lg">分发侠</span></Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex"><Link href="#capabilities" className="hover:text-indigo-600">核心能力</Link><Link href="#workflow" className="hover:text-indigo-600">发布流程</Link><Link href="#plans" className="hover:text-indigo-600">会员方案</Link></nav>
          <div className="flex items-center gap-2"><Link href="/login" className="whitespace-nowrap px-2 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600">登录</Link><Link href="/register" className="whitespace-nowrap rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-indigo-500">免费注册</Link></div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:pt-24"><div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(99,102,241,.18),transparent_32%),radial-gradient(circle_at_18%_70%,rgba(168,85,247,.12),transparent_32%)]" /><div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.08fr_.92fr]"><div><p className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700">面向中国内容团队的 AI 发布工作台</p><h1 className="mt-6 text-3xl font-black leading-tight [text-wrap:balance] sm:text-5xl lg:text-6xl">内容只做一次，<br /><span className="text-indigo-600">每个平台都认真对待。</span></h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">从选题、创作、平台适配到审核、排期和复盘，把重复劳动交给系统，把品牌判断留给人。</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/register" className="rounded-xl bg-indigo-600 px-6 py-3 text-center font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-500">免费建立第一个工作区</Link><Link href="/login" className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center font-bold text-slate-700 hover:border-indigo-300">已有账号，直接登录</Link></div><p className="mt-4 text-sm text-slate-500">发布前人工确认 · 无真实数据不做确定归因 · 不承诺流量或收益结果</p></div><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-indigo-100"><div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-sm text-slate-500">工作流程示例</p><p className="mt-1 text-xl font-black">先处理最重要的一件事</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">待人工确认</span></div><div className="mt-5 space-y-3">{['检查平台规则与敏感表达', '确认引用来源和采集日期', '逐平台预览标题、封面与正文', '批准后进入排期队列'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">{index + 1}</span><span className="text-sm font-medium text-slate-700">{item}</span></div>)}</div></div></div></section>

        <section id="capabilities" className="border-y border-slate-200 bg-white px-4 py-20"><div className="mx-auto max-w-6xl"><p className="text-sm font-black tracking-widest text-indigo-600">核心能力</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">不是堆功能，而是打通可控的发布闭环</h2><div className="mt-10 grid gap-5 md:grid-cols-2">{capabilities.map(([title, body], index) => <article key={title} className="rounded-2xl border border-slate-200 p-6"><span className="text-sm font-black text-indigo-600">0{index + 1}</span><h3 className="mt-3 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-600">{body}</p></article>)}</div></div></section>

        <section id="workflow" className="px-4 py-20"><div className="mx-auto max-w-6xl"><h2 className="text-3xl font-black sm:text-4xl">三步完成一次可靠分发</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{[['1','建立内容任务','选择受众、目标、平台和截止时间。'],['2','生成并逐项审核','查看平台适配、引用、风险提示和预览。'],['3','排期与复盘','批准后发布，并用真实表现数据更新下次建议。']].map(([n,title,body]) => <article key={n} className="rounded-2xl bg-slate-950 p-6 text-white"><span className="text-sm font-black text-violet-300">步骤 {n}</span><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-300">{body}</p></article>)}</div></div></section>

        <section id="plans" className="bg-white px-4 py-20"><div className="mx-auto max-w-6xl"><div className="max-w-2xl"><p className="text-sm font-black tracking-widest text-indigo-600">会员方案</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">从个人创作到企业协作</h2><p className="mt-4 text-slate-600">与会员方案页共用价格和权益配置，付款确认后开通对应服务。</p></div><div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => <article key={plan.name} className={`relative rounded-2xl border p-6 ${plan.recommended ? 'border-indigo-500 shadow-xl shadow-indigo-100' : 'border-slate-200'}`}>{plan.recommended && <span className="absolute -top-3 left-5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">团队协作方案</span>}<h3 className="text-xl font-black">{plan.name}</h3><p className="mt-3 text-3xl font-black">{plan.price}</p><p className="mt-2 text-sm text-slate-500">{plan.note}</p><ul className="mt-5 space-y-3 text-sm text-slate-700">{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><Link href="/pricing" className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-bold ${plan.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>查看{plan.name}权益</Link></article>)}</div></div></section>

        <section className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-16 text-white"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center"><div><h2 className="text-3xl font-black">今天先减少一次重复发布。</h2><p className="mt-2 text-indigo-100">免费建立工作区，完整体验创建、审核和排期流程。</p></div><Link href="/register" className="rounded-xl bg-white px-6 py-3 font-black text-indigo-700">免费注册</Link></div></section>
      </main>

      <footer className="bg-slate-950 px-4 py-10 text-sm text-slate-400"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row"><div><p className="font-black text-white">分发侠</p><p className="mt-1">AI 驱动、人工可控的全渠道内容工作台</p></div><div className="flex gap-5"><Link href="/login" className="hover:text-white">登录</Link><Link href="/register" className="hover:text-white">注册</Link><Link href="/terms" className="hover:text-white">用户协议</Link><Link href="/privacy" className="hover:text-white">隐私政策</Link></div></div></footer>
    </div>
  );
}
