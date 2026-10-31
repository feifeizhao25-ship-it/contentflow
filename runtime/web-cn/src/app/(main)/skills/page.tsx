'use client';

import Link from 'next/link';
import { Tag } from 'antd';

const ready = [
  { name: '标题与正文', detail: '在创作工作室生成标题、脚本和正文。按实际令牌扣额度。', href: '/studio' },
  { name: '平台改写', detail: '同一条内容按抖音、B站、小红书等平台的长度和语气改写。不是自动发布。', href: '/studio' },
  { name: '合规检查', detail: '发布前检查明确违规和可能有风险的表述，并写明这不是法律意见。', href: '/publish' },
  { name: '爆款拆解', detail: '粘贴你手上的内容再分析。没有接入热点数据源时，不展示编造的榜单。', href: '/hot' },
];

export default function SkillsPage() {
  return <main className="p-8 max-w-6xl mx-auto">
    <h1 className="text-3xl font-black">能力中心</h1>
    <p className="text-zinc-500 mt-2">下面四项已经可以在对应页面使用。没有接通的能力只标即将上线，不会给出假的结果。</p>
    <div className="grid md:grid-cols-2 gap-5 mt-8">
      {ready.map((skill) => <section className="glass-card p-5" key={skill.name}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-lg">{skill.name}</h2>
          <Tag color="green">可使用</Tag>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{skill.detail}</p>
        <Link href={skill.href} className="mt-4 inline-block text-sm font-bold text-indigo-600">去使用</Link>
      </section>)}
    </div>
    <div className="glass-card p-8 mt-6">
      <p className="font-bold">尚未开通</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Tag color="blue">即将上线：团队审核流</Tag>
        <Tag>即将上线：品牌语气训练</Tag>
      </div>
      <p className="mt-3 text-sm text-zinc-500">这两项还没有执行点。团队邀请在邮件与接受流程接通前也不能添加成员。</p>
    </div>
  </main>;
}
