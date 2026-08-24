'use client';

import { useState } from 'react';

const users = [
  { name: '林晓｜知识博主', goal: '稳定更新并提高收藏', platform: '小红书', skill: '选题与笔记结构' },
  { name: '陈峰｜本地商家', goal: '把到店活动讲明白', platform: '抖音', skill: '短视频脚本' },
  { name: '周宁｜品牌运营', goal: '减少跨平台返工', platform: '微信＋微博', skill: '平台适配' },
  { name: '唐悦｜机构负责人', goal: '缩短团队审核时间', platform: '全渠道', skill: '审核与合规' },
  { name: '何川｜行业分析师', goal: '输出有依据的解读', platform: '知乎', skill: '来源核验' },
];

const week = [
  ['先认识你', '只问三个必要问题：服务谁、在哪个平台发布、希望用户做什么。'],
  ['接入第一个信号', '展示已连接数据与缺失数据，不用演示数字冒充真实成绩。'],
  ['学会你的表达', '根据你采纳和拒绝的建议调整语气，并允许随时重置画像。'],
  ['只看一个关键问题', '从大量指标中选出最值得今天处理的一项，并说明选择原因。'],
  ['完成一次小实验', '给出内容草稿、验证指标和停止条件，先审核再发布。'],
  ['生成行动清单', '按紧急度、可信度和工作量排序，避免信息堆砌。'],
  ['回顾这一周', '说明本周发生了什么、哪些结论仍不确定，以及下周的一个重点。'],
];

export default function ExperienceWeekPage() {
  const [selected, setSelected] = useState(0);
  const [day, setDay] = useState(0);
  const user = users[selected];
  const [title, detail] = week[day];
  const confidence = Math.min(45 + day * 7 + selected * 2, 93);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <header className="rounded-[32px] bg-zinc-950 p-7 text-white md:p-12">
        <p className="text-xs font-bold tracking-[.22em] text-indigo-300">五类用户 × 连续七天｜个性化验收视图（演示数据）</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">每天都更懂用户，但不偷偷替用户做决定。</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">点击不同用户和日期，检查首页重点、Skills 和行动建议是否真的发生变化。所有演示指标均明确标注，不能当作真实经营结果。</p>
      </header>

      <div className="grid gap-3 md:grid-cols-5">
        {users.map((item, index) => <button key={item.name} onClick={() => setSelected(index)} className={`rounded-2xl border p-4 text-left transition ${selected === index ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100' : 'border-zinc-200 bg-white hover:border-zinc-400'}`}><strong className="block text-sm text-zinc-900">{item.name}</strong><span className="mt-2 block text-xs leading-5 text-zinc-500">{item.goal}</span></button>)}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {week.map((_, index) => <button key={index} onClick={() => setDay(index)} className={`min-w-24 rounded-full px-4 py-2 text-sm font-bold ${day === index ? 'bg-indigo-600 text-white' : 'bg-white text-zinc-500 ring-1 ring-zinc-200'}`}>第 {index + 1} 天</button>)}
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.45fr_.55fr]">
        <article className="rounded-[30px] border border-zinc-200 bg-white p-7 shadow-sm md:p-10">
          <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{user.platform}</span><span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">第 {day + 1}/7 天</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">演示数据</span></div>
          <p className="mt-9 text-xs font-bold tracking-[.18em] text-zinc-400">你今天最值得处理的事</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-zinc-950 md:text-6xl">{title}</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">{detail}</p>
          <div className="mt-8 flex flex-wrap gap-3"><button className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">开始下一步</button><button className="rounded-xl border border-zinc-300 px-5 py-3 font-bold text-zinc-700">为什么推荐给我？</button></div>
        </article>
        <aside className="rounded-[30px] bg-zinc-900 p-7 text-white md:p-9">
          <p className="text-xs font-bold tracking-[.18em] text-emerald-300">证据准备度</p><div className="mt-3 text-6xl font-black">{confidence}%</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-700"><i className="block h-full rounded-full bg-emerald-400" style={{ width: `${confidence}%` }} /></div>
          <p className="mt-5 leading-7 text-zinc-300">{day < 2 ? '目前信号较少，因此只给保守建议，不展示虚假的精准结论。' : '来自已连接数据、明确偏好和经过核验的资料；过期资料不会进入默认答案。'}</p>
          <div className="mt-7 border-t border-zinc-700 pt-6"><span className="text-xs text-zinc-400">本日调用的专业能力</span><strong className="mt-2 block text-xl">{user.skill}</strong></div>
        </aside>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5"><span className="text-xs text-zinc-400">相比昨天发生的变化</span><strong className="mt-2 block">{day === 0 ? '完成冷启动首页排序' : day < 3 ? '内容语气与平台重点' : day < 6 ? '行动建议与优先级' : '下周唯一重点'}</strong></article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5"><span className="text-xs text-zinc-400">个性化控制</span><strong className="mt-2 block">可查看原因、修改偏好、关闭推荐</strong></article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-5"><span className="text-xs text-zinc-400">资料时效</span><strong className="mt-2 block">平台规则超过 30 天必须复核</strong></article>
      </div>
    </div>
  );
}
