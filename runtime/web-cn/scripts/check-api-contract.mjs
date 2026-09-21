#!/usr/bin/env node
/**
 * 前端 ↔ NestJS 后端的接口契约检查。
 *
 * 为什么是独立脚本而不是 jest：**web-cn 里根本没有 jest**
 * （`package.json` 只有 `lint` 脚本，devDependencies 里没有任何测试框架）。
 * 同目录下的 `src/lib/api-contract.spec.ts` 因此从来跑不起来 ——
 * 又是一处「写了没人跑」。本脚本只用 Node 内置模块，`node` 直接可执行。
 *
 * 检查两类跨层问题，它们在前后端各自的测试里都看不见，却足以让页面白屏：
 *
 *   1. **路径前缀。** 后端 `main.ts` 里 `setGlobalPrefix('api/v1')`，
 *      而前端曾多处写 `/api/team`、`/api/accounts/authorize` ——
 *      既不匹配后端前缀，web-cn 里也没有对应的本地 route.ts，一直 404。
 *
 *   2. **响应信封。** 后端全局挂 `TransformInterceptor`，把响应包成
 *      `{ success, data, meta }`。前端多处直接读 `data.plan`，永远 undefined，
 *      而且不报错、只渲染成空。付费墙那处尤其隐蔽：读不到 plan 就退到 free，
 *      表现成「买了也用不了」而不是「接口坏了」。
 *
 * 退出码：0 通过，1 有问题。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, '..', 'src');
const API_SRC = path.resolve(HERE, '..', '..', 'api', 'src');

const failures = [];
const fail = (msg) => failures.push(msg);

// ─── 工具 ───

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(spec|test)\./.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** 剥离注释：修复说明里会引用旧路径，不剥离会产生误报 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function localRoutes() {
  const root = path.join(WEB_SRC, 'app', 'api');
  const routes = [];
  const visit = (dir, prefix) => {
    if (!fs.existsSync(dir)) return;
    if (fs.existsSync(path.join(dir, 'route.ts'))) routes.push(prefix);
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) visit(path.join(dir, e.name), `${prefix}/${e.name}`);
    }
  };
  visit(root, '/api');
  return routes;
}

/** Next 动态段：[id] 一段，[...slug] 多段 */
const routeToRegex = (route) =>
  new RegExp(
    '^/' +
      route
        .replace(/^\//, '')
        .split('/')
        .map((seg) =>
          /^\[\.\.\..+\]$/.test(seg)
            ? '.+'
            : /^\[.+\]$/.test(seg)
              ? '[^/]+'
              : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('/') +
      '(/|$)',
  );

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

// ─── 1. 每个调用都要有人承接 ───

{
  const matchers = localRoutes().map(routeToRegex);
  if (matchers.length < 5) fail(`本地路由只扫到 ${matchers.length} 个，疑似扫描路径不对`);

  for (const file of walk(WEB_SRC)) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    const re = /fetch\(\s*[`'"](\/api\/[^`'"?\s]*)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const url = m[1].replace(/\$\{[^}]*\}/g, 'X');
      if (url.startsWith('/api/v1/')) continue; // 走通用代理
      if (!matchers.some((rx) => rx.test(url))) {
        fail(`断链: ${m[1]}  <- ${path.relative(WEB_SRC, file)}`);
      }
    }
  }

  // 基础设施本身
  if (!read(path.join(WEB_SRC, 'app/api/v1/[...path]/route.ts'))) {
    fail('缺少 /api/v1 通用代理');
  }
  // 前缀配置在 bootstrap.ts（main.ts 与测试共用）；两处都认
  const main = (read(path.join(API_SRC, 'main.ts')) || '') + (read(path.join(API_SRC, 'bootstrap.ts')) || '');
  if (!main || !/setGlobalPrefix\(\s*['"]api\/v1['"]/.test(main)) {
    fail('后端全局前缀不是 api/v1，本脚本的前提已不成立');
  }
}

// ─── 2. 响应信封必须被解开 ───

{
  const interceptor = read(
    path.join(API_SRC, 'common/interceptors/transform.interceptor.ts'),
  );
  if (!interceptor || !interceptor.includes('success: true')) {
    fail('TransformInterceptor 的信封形状变了，下列断言的前提已不成立');
  }

  // 修好后不能回退的位置
  const regressions = [
    {
      file: 'components/membership/PremiumGate.tsx',
      bad: /const\s+data\s*=\s*await\s+apiClient\.get<[^>]*>\(\s*['"]\/billing\/subscription/,
      why: '把信封当订阅对象用 → plan 永远 undefined → 所有付费用户被当成 free',
    },
    {
      file: 'store/gamificationStore.ts',
      bad: /statusData\s*=\s*await\s+statusRes\.json\(\)/,
      why: '未解包 → 等级/经验/连续天数全部渲染成空',
    },
  ];
  for (const { file, bad, why } of regressions) {
    const src = read(path.join(WEB_SRC, file));
    if (src && bad.test(src)) fail(`${file} 回退到未解包写法：${why}`);
  }

  const gam = read(path.join(WEB_SRC, 'store/gamificationStore.ts'));
  if (gam && /gamification\/(status|achievements)\?userId=/.test(gam)) {
    fail('gamificationStore 仍把 userId 拼进查询串 —— 后端已改为从 JWT 取身份');
  }
}

// ─── 3. AI 端点（国内版） ───
//
// 国内版只接境内服务商。语音合成、自动字幕、视频生成原来直连 OpenAI / Azure /
// ElevenLabs / fal.ai（境外），现在一律返回 501 NOT_AVAILABLE_IN_CN；
// 分镜脚本转给后端（境内模型 + 预算 + AIGC 标识）。

{
  const NOT_IN_CN = [
    'ai/tts/openai',
    'ai/tts/azure',
    'ai/tts/elevenlabs',
    'ai/subtitle/generate',
    'ai/generate-video',
    'video/generate',
  ];
  const OFFSHORE = /openai\.com|openrouter\.ai|elevenlabs\.io|microsoft\.com|fal\.(run|media|ai)|@fal-ai|pollinations\.ai/i;

  for (const route of NOT_IN_CN) {
    const src = read(path.join(WEB_SRC, 'app/api', route, 'route.ts'));
    if (!src) { fail(`${route}: 未实现`); continue; }
    if (!src.includes('notAvailableInChina')) fail(`${route}: 国内版应返回 NOT_AVAILABLE_IN_CN`);
    if (OFFSHORE.test(src)) fail(`${route}: 国内版源码里出现境外服务`);
  }

  const script = read(path.join(WEB_SRC, 'app/api/ai/generate-script/route.ts'));
  if (!script || !script.includes('/api/v1/ai/generate/script')) fail('ai/generate-script: 应转给后端生成');
  if (script && OFFSHORE.test(script)) fail('ai/generate-script: 国内版源码里出现境外服务');

  for (const route of ['ai/merge-videos', 'ai/export-image']) {
    const src = read(path.join(WEB_SRC, 'app/api', route, 'route.ts'));
    // 只看 cookie 在不在等于没鉴权：必须向后端校验
    if (src && !src.includes('await requireAuth')) fail(`${route}: 未向后端校验登录态`);
    if (src && /\bmock\b|\bfake\b|假数据|模拟结果/i.test(src)) fail(`${route}: 出现假数据字样`);
  }

  const merge = read(path.join(WEB_SRC, 'app/api/ai/merge-videos/route.ts'));
  // 服务层有「失败退回第一段」的兜底；用户主动点成片时拿到 5 秒视频比报错更糟
  if (merge && !merge.includes('MERGE_FAILED')) fail('merge-videos: 缺失败码');

  const provider = read(path.join(WEB_SRC, 'app/api/_lib/provider.ts'));
  if (provider && !/auth\/profile/.test(provider)) fail('requireAuth: 未向后端校验令牌');
}

// ─── 3b. 平台账号只走官方授权 ───
//
// 红线：不向用户索要平台的账号密码或 Cookie，不模拟登录。
// 账号管理页原来让用户「粘贴网页版登录后的 Cookie」。

{
  const page = read(path.join(WEB_SRC, 'app/(main)/accounts/page.tsx')) || '';
  const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/cookieInput|请粘贴 Cookie|sessionid=|Input\.Password/.test(code)) {
    fail('账号管理页: 仍在索要平台 Cookie 或密码');
  }
  if (!/\/auth-url/.test(code)) fail('账号管理页: 未走官方授权地址');
}

// ─── 4. 运行时依赖 ───

{
  const dockerfile = read(path.resolve(HERE, '..', 'Dockerfile'));
  // fluent-ffmpeg 只是调用壳子，真正干活的是系统二进制
  if (dockerfile && !/apk add[^\n]*ffmpeg/.test(dockerfile)) {
    fail('Dockerfile 未安装 ffmpeg —— 拼接类端点上线即不可用');
  }

  const env = read(path.resolve(HERE, '..', '.env.example'));
  // 国内版不应再出现境外服务商的密钥变量——配上就等于准备出境
  for (const key of ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AZURE_SPEECH_KEY', 'ELEVENLABS_API_KEY', 'FAL_API_KEY', 'SUPABASE']) {
    if (env && env.includes(key)) fail(`.env.example 不应包含境外服务变量 ${key}`);
  }
}

// ─── 结果 ───

if (failures.length > 0) {
  console.error(`接口契约检查失败：${failures.length} 项\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log('接口契约检查通过');
