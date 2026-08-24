import * as fs from 'fs';
import * as path from 'path';

/**
 * service 不得凭空编造业务数据。
 *
 * 2026-08-18 复核发现 `growth` 与 `competitor` 两个 service **一行数据库都没查**，
 * 直接 return 写死的对象：
 *
 *   getGrowthPlan()          → { currentPhase: 1, goals: { followers: 10000 }, ... }
 *   getCompetitorAnalysis()  → { name: '竞品账号', followers: 100000, ... }
 *
 * 无论传什么参数都是同一组数字。而 `GrowthGoal` / `CompetitorMonitor`
 * 两个模型早就在 schema 里 —— 不是没地方存，是没接。
 *
 * 更隐蔽的是：即便当时接了库也查不到 —— 两个模型上的字段是 `user_id`，
 * 而 controller 传的是 `req.user.tenantId`，参数名和字段名对不上。
 *
 * 前端那边同时还有 `mockGrowthData` / `mockCompetitors`，
 * 于是前后端各编了一套假数据，谁也不知道真实数据长什么样。
 */

const MODULES_DIR = __dirname;

/** 明显是业务数据的写死字面量（数字 ≥ 1000 或典型指标名配具体值） */
const FABRICATED_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /followers:\s*\d{4,}/, why: '写死的粉丝数' },
  { re: /engagementRate:\s*0?\.\d+/, why: '写死的互动率' },
  { re: /contentCount:\s*\d{2,}/, why: '写死的内容数' },
  { re: /currentPhase:\s*\d/, why: '写死的阶段值' },
];

function serviceFiles(): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (/\.service\.ts$/.test(e.name)) out.push(full);
    }
  };
  visit(MODULES_DIR);
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('service 不得返回编造的业务数据', () => {
  const files = serviceFiles();

  it('扫描到了 service 文件', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(['growth/growth.service.ts', 'competitor/competitor.service.ts'])(
    '%s 真的查库',
    (rel) => {
      const src = fs.readFileSync(path.join(MODULES_DIR, rel), 'utf8');
      // 至少要有一次真实的 prisma 查询，而不是只在构造函数里注入
      const queries = src.match(/this\.prisma\.\w+\.(findMany|findFirst|findUnique|create|update|count)/g);
      expect(queries && queries.length > 0 ? '' : `${rel} 没有任何数据库查询`).toBe('');
    },
  );

  it.each(['growth/growth.service.ts', 'competitor/competitor.service.ts'])(
    '%s 没有写死的业务指标',
    (rel) => {
      const src = stripComments(fs.readFileSync(path.join(MODULES_DIR, rel), 'utf8'));
      const hits = FABRICATED_PATTERNS.filter(({ re }) => re.test(src)).map((p) => p.why);
      expect(hits.length === 0 ? '' : `${rel} 仍含: ${hits.join('、')}`).toBe('');
    },
  );

  it('查询按 user_id 过滤的模型不得传 tenantId', () => {
    // GrowthGoal / CompetitorMonitor 上是 user_id；
    // 传 tenantId 会静默查不到任何记录 —— 表现成「没数据」而非「传错了」
    const offenders: string[] = [];
    for (const rel of ['growth/growth.controller.ts', 'competitor/competitor.controller.ts']) {
      const src = stripComments(fs.readFileSync(path.join(MODULES_DIR, rel), 'utf8'));
      if (/req\.user\.tenantId/.test(src)) offenders.push(rel);
    }
    expect(offenders.length === 0 ? '' : `${offenders.join(', ')} 仍在传 tenantId`).toBe('');
  });

  it('competitor 查询带用户归属，不是只按 id 查', () => {
    // 只按 id 查等于任何人都能读别人的竞品监控
    const src = fs.readFileSync(
      path.join(MODULES_DIR, 'competitor/competitor.service.ts'),
      'utf8',
    );
    const findFirst = src.slice(src.indexOf('findFirst'), src.indexOf('findFirst') + 300);
    expect(findFirst).toContain('user_id');
  });

  it('查不到记录时报 404，不是编一份返回', () => {
    const src = fs.readFileSync(
      path.join(MODULES_DIR, 'competitor/competitor.service.ts'),
      'utf8',
    );
    expect(src).toContain('NotFoundException');
  });

  it.each(['publish/adapters/douyin.adapter.ts', 'publish/adapters/bilibili.adapter.ts'])(
    '%s 未实现真实上传时不得仅凭环境变量宣称已接入',
    (rel) => {
      const src = stripComments(fs.readFileSync(path.join(MODULES_DIR, rel), 'utf8'));
      expect(src).toMatch(/readonly isLive = false/);
      expect(src).not.toMatch(/isLive\s*=\s*Boolean\s*\(/);
    },
  );

  it('发布队列必须有真实消费者并写入外部稿件编号', () => {
    const src = fs.readFileSync(path.join(MODULES_DIR, 'publish/publish.processor.ts'), 'utf8');
    expect(src).toContain("@Processor('publish-queue')");
    expect(src).toContain('adapter.createPost(payload)');
    expect(src).toContain('platform_post_id: result.data.externalId');
  });
});
