/**
 * 前端 ↔ NestJS 后端的接口契约检查（静态扫描）。
 *
 * 这类问题在前后端各自的测试里都看不见，但足以让整个页面白屏：
 *
 *   1. **路径前缀**。后端 `main.ts` 里 `setGlobalPrefix('api/v1')`，
 *      而前端多处写的是 `/api/team`、`/api/accounts/authorize` ——
 *      既不匹配后端前缀，web-cn 里也没有对应的本地 route.ts，一直 404。
 *      Next.js 只有 `/api/v1/[...path]` 这一个代理，不带 `v1` 的路径无人承接。
 *
 *   2. **响应信封**。后端全局挂了 `TransformInterceptor`，把每个响应包成
 *      `{ success, data, meta }`。前端多处直接读 `data.plan` / `statusData.level`，
 *      永远是 undefined —— 而且不会报错，只是渲染成空。
 *      付费墙那处尤其隐蔽：读不到 plan 就退到 free，
 *      表现成「买了也用不了」而不是「接口坏了」。
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_SRC = path.resolve(__dirname, '..');
const API_SRC = path.resolve(__dirname, '../../../api/src');

function walk(dir: string, exts = ['.ts', '.tsx']): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      out.push(...walk(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e)) && !entry.name.includes('.spec.')) {
      out.push(full);
    }
  }
  return out;
}

/** web-cn 自己实现的 Next.js API 路由（静态段） */
function localApiRoutes(): string[] {
  const root = path.join(WEB_SRC, 'app', 'api');
  const routes: string[] = [];
  const visit = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const next = `${prefix}/${entry.name}`;
      const full = path.join(dir, entry.name);
      if (fs.existsSync(path.join(full, 'route.ts'))) routes.push(next);
      visit(full, next);
    }
  };
  visit(root, '/api');
  return routes;
}

/** 去掉行注释与块注释，避免把注释里示例性的 fetch 当成真实调用 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** 所有 fetch('/api/...') 调用（不含注释中的） */
function frontendApiCalls(): Array<{ file: string; url: string }> {
  const calls: Array<{ file: string; url: string }> = [];
  for (const file of walk(WEB_SRC)) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    const re = /fetch\(\s*[`'"](\/api\/[^`'"?\s]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      calls.push({ file: path.relative(WEB_SRC, file), url: m[1] });
    }
  }
  return calls;
}

describe('前端调用路径必须有人承接', () => {
  const local = localApiRoutes();

  it('web-cn 提供了 /api/v1 通用代理', () => {
    expect(fs.existsSync(path.join(WEB_SRC, 'app/api/v1/[...path]/route.ts'))).toBe(true);
  });

  it('后端全局前缀是 api/v1', () => {
    const main = fs.readFileSync(path.join(API_SRC, 'main.ts'), 'utf8');
    expect(main).toMatch(/setGlobalPrefix\(\s*['"]api\/v1['"]/);
  });

  // 白名单已清空：原先列在这里的 8 个端点（TTS ×3、字幕、脚本、
  // 单镜视频、拼接、全流程）都已补上实现，见 src/app/api/ai/* 与
  // src/app/api/video/generate。新出现的断链会直接让本条变红。

  it('每个 fetch 的 /api/* 路径要么走 v1 代理，要么有本地 route.ts', () => {
    const orphans = frontendApiCalls().filter(({ url }) => {
      if (url.startsWith('/api/v1/')) return false;              // 走通用代理
      return !local.some((r) => url === r || url.startsWith(`${r}/`));
    });

    const detail = orphans.map((o) => `  ${o.url}  <- ${o.file}`).join('\n');
    expect(
      orphans.length === 0
        ? ''
        : `以下路径既不走 /api/v1 代理，也没有本地 route.ts —— 请求会 404:\n${detail}`,
    ).toBe('');
  });
});

describe('响应信封必须被解开', () => {
  it('后端确实挂了 TransformInterceptor', () => {
    const main = fs.readFileSync(path.join(API_SRC, 'main.ts'), 'utf8');
    expect(main).toContain('TransformInterceptor');

    const interceptor = fs.readFileSync(
      path.join(API_SRC, 'common/interceptors/transform.interceptor.ts'),
      'utf8',
    );
    // 信封形状变了的话，下面这些断言的前提就不成立了
    expect(interceptor).toContain('success: true');
    expect(interceptor).toContain('data,');
  });

  // 曾经直接读字段、绕过信封的位置。修好后不能回退。
  const REGRESSIONS: Array<{ file: string; forbidden: RegExp; why: string }> = [
    {
      file: 'components/membership/PremiumGate.tsx',
      forbidden: /const\s+data\s*=\s*await\s+apiClient\.get<[^>]*>\(\s*['"]\/billing\/subscription/,
      why: '直接把信封当订阅对象用，plan 永远 undefined → 所有付费用户被当成 free',
    },
    {
      file: 'store/gamificationStore.ts',
      forbidden: /statusData\s*=\s*await\s+statusRes\.json\(\)/,
      why: '未解包，等级/经验/连续天数全部渲染成空',
    },
  ];

  REGRESSIONS.forEach(({ file, forbidden, why }) => {
    it(`${file} 不得回退到未解包写法`, () => {
      const full = path.join(WEB_SRC, file);
      if (!fs.existsSync(full)) return;
      const src = fs.readFileSync(full, 'utf8');
      expect(forbidden.test(src) ? why : '').toBe('');
    });
  });

  it('gamification 不再把 userId 拼进查询串', () => {
    const src = fs.readFileSync(path.join(WEB_SRC, 'store/gamificationStore.ts'), 'utf8');
    // 后端已改为从 JWT 取身份；继续传 userId 等于把废弃的越权入口留在前端
    expect(src).not.toMatch(/gamification\/(status|achievements)\?userId=/);
  });
});


// AI 端点（国内版）的规则见 scripts/check-api-contract.mjs 第 3 节（npm test 实际执行的是那份）：
// 语音合成、自动字幕、视频生成原来直连境外服务商，国内版返回 501 NOT_AVAILABLE_IN_CN；
// 分镜脚本转给后端。

describe('运行时依赖已声明', () => {
  it('Dockerfile 安装了 ffmpeg', () => {
    // fluent-ffmpeg 只是调用壳子，真正干活的是系统二进制。
    // 镜像里不装，拼接类端点上线即不可用。
    const dockerfile = fs.readFileSync(path.join(WEB_SRC, '..', 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/apk add[^\n]*ffmpeg/);
  });

  it('.env.example 不包含境外服务商的密钥变量', () => {
    const env = fs.readFileSync(path.join(WEB_SRC, '..', '.env.example'), 'utf8');
    ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AZURE_SPEECH_KEY', 'ELEVENLABS_API_KEY', 'FAL_API_KEY', 'SUPABASE']
      .forEach((key) => expect(env).not.toContain(key));
  });

  it('AI 密钥不带 NEXT_PUBLIC_ 前缀', () => {
    // 带上前缀会被打进客户端 bundle，等于公开密钥
    const env = fs.readFileSync(path.join(WEB_SRC, '..', '.env.example'), 'utf8');
    expect(env).not.toMatch(/NEXT_PUBLIC_(OPENAI|OPENROUTER|AZURE_SPEECH|ELEVENLABS|FAL)_/);
  });
});
