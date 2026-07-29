'use client';

import { Empty, Tag } from 'antd';

const categories = [
  { name: '内容创作', skills: ['标题优化', '社交帖子', '视频脚本'] },
  { name: '增长优化', skills: ['SEO 检查', '平台适配'] },
  { name: '合规与质量', skills: ['敏感内容检查', '来源核验'] },
];

export default function SkillsPage() {
  return <main className="p-8 max-w-6xl mx-auto">
    <h1 className="text-3xl font-black">Skills 能力中心</h1>
    <p className="text-zinc-500 mt-2">按使用场景选择能力；未开放能力会明确标记，不使用虚假占位结果。</p>
    <div className="grid md:grid-cols-3 gap-5 mt-8">
      {categories.map(category => <section className="glass-card p-5" key={category.name}>
        <h2 className="font-bold text-lg">{category.name}</h2>
        <div className="space-y-3 mt-4">{category.skills.map(skill =>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800" key={skill}>{skill}</div>)}</div>
      </section>)}
    </div>
    <div className="glass-card p-8 mt-6"><Empty description="暂时没有更多已验证能力">
      <Tag color="blue">即将上线：团队审核流</Tag><Tag>即将上线：品牌语气训练</Tag>
    </Empty></div>
  </main>;
}
