import { getEvolutionStage } from '@/lib/persona/DashboardEvolution';

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const personas = [
  {
    name: '小明',
    role: '新手博主',
    market: '生活方式 / 抖音',
    goal: '从零完成第一条内容，减少迷茫感。',
    tier: '免费版',
    color: 'from-cyan-500 to-blue-500',
    focus: ['完善资料', '绑定平台', '选题建议', '首条内容', '首次发布', '数据反馈', '下周计划'],
  },
  {
    name: '阿芸',
    role: '小红书种草达人',
    market: '美妆护肤 / 小红书',
    goal: '提升收藏、评论和种草转化。',
    tier: '专业版',
    color: 'from-rose-500 to-orange-400',
    focus: ['人设校准', '热点拆解', '标题测试', '封面建议', '广告披露', '评论复盘', '商品复盘'],
  },
  {
    name: '陈老板',
    role: '本地生活商家',
    market: '同城获客 / 视频号',
    goal: '让内容直接服务门店曝光和成交。',
    tier: '团队版',
    color: 'from-emerald-500 to-teal-500',
    focus: ['门店目标', '同城热点', '探店脚本', '团购文案', '排期发布', '线索统计', '复购提醒'],
  },
  {
    name: '王姐',
    role: '矩阵号负责人',
    market: '多账号团队 / 全平台',
    goal: '突出审批、风险和交付节奏。',
    tier: '企业版',
    color: 'from-violet-500 to-indigo-500',
    focus: ['账号体检', '分工排期', '素材入库', '批量创作', '审核发布', '客户报告', '团队复盘'],
  },
  {
    name: '李老师',
    role: '知识付费创作者',
    market: '课程线索 / 微信生态',
    goal: '展示可信来源、课程路径和线索承接。',
    tier: '专业版',
    color: 'from-amber-500 to-yellow-400',
    focus: ['课程定位', '问题收集', '干货文章', '短视频拆条', '直播提纲', '线索复盘', '学员答疑'],
  },
];

function metricsForDay(day: number) {
  return {
    contentCreated: Math.max(0, day - 1),
    platformsConnected: day >= 4 ? 1 : 0,
  };
}

export default function PersonalizationDemoPage() {
  return (
    <div className="space-y-8 pb-10">
      <section className="overflow-hidden rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1 text-sm text-cyan-100">
            真实运行预览 · 5 类用户 × 连续 7 天
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            同一个产品，不同用户每天看到不同重点
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
            页面使用项目内真实的 DashboardEvolution 规则生成：按注册天数、内容数量、平台绑定状态推进，再叠加用户角色、领域、会员等级和本周目标。
          </p>
        </div>
      </section>

      <section className="grid gap-4">
        {personas.map((persona) => (
          <article key={persona.name} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className={`h-1.5 bg-gradient-to-r ${persona.color}`} />
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="lg:w-64">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">{persona.name}</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {persona.tier}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-cyan-700">{persona.role}</p>
                  <p className="text-xs text-slate-500">{persona.market}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{persona.goal}</p>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
                  {weekDays.map((label, index) => {
                    const day = index + 1;
                    const metrics = metricsForDay(day);
                    const stage = getEvolutionStage(day, metrics.contentCreated, metrics.platformsConnected);
                    return (
                      <div key={`${persona.name}-${label}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] font-bold text-slate-400">{label}</div>
                        <div className="mt-2 text-sm font-black text-slate-900">{persona.focus[index]}</div>
                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{stage.titleZh}</div>
                        <div className="mt-3 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-cyan-700">
                          {stage.primaryActionZh}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">登录首页真实卡片示例</h2>
            <p className="mt-1 text-sm text-slate-500">下面展示第 1、4、7 天的实际首页组件语义，便于检查是否真的在变化。</p>
          </div>
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">中文输出 / 国内场景</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 4, 7].map((day) => {
            const stage = getEvolutionStage(day, metricsForDay(day).contentCreated, metricsForDay(day).platformsConnected);
            return (
              <div key={day} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5">
                <div className="text-xs font-bold text-cyan-700">第 {day} 天</div>
                <h3 className="mt-2 text-lg font-black text-slate-900">{stage.titleZh}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{stage.subtitleZh}</p>
                <div className="mt-4 grid gap-2">
                  {stage.cards.slice(0, 3).map((card) => (
                    <div key={card.id} className="rounded-xl border border-slate-100 bg-white p-3">
                      <div className="text-lg">{card.icon}</div>
                      <div className="mt-1 text-sm font-bold text-slate-800">{card.titleZh}</div>
                      <div className="line-clamp-2 text-xs text-slate-500">{card.subtitleZh}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}