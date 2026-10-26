/**
 * 分发侠国内模型路由（文档 12）。
 *
 * 便宜模型跑量，强模型守关。写稿用 DeepSeek，评审用千问，两家分开。
 * 产品服务器密钥用 FENFAXIA_*，与 OpenClaw 主机的密钥不是同一把。
 * 旧的 DEEPSEEK_API_KEY / QWEN_API_KEY / DASHSCOPE_API_KEY 仍作为同名别名，避免已部署环境突然断掉。
 *
 * 模型 ID 取自官方文档（2026-10-26）：
 * - DeepSeek：https://api-docs.deepseek.com/  deepseek-flash、deepseek-v4-pro
 * - 百炼：qwen3.5-plus、qwen-flash、text-embedding-v4、qwen3-rerank、qwen-image-2.0、wan2.5-t2i-preview、wan2.5-t2v-preview
 * - 方舟：doubao-seed-2-0-mini-260428、doubao-seed-2-0-lite-260428、doubao-seedream-5-0-flash-260915、doubao-seedance-2-0-mini-260615
 * 文档 12 里的营销名（qwen-image、Seedream 5.0-flash）与上述版本化 ID 不一致的，以官方模型列表为准，并允许环境变量覆盖。
 */

export const FENFAXIA_CHAT_ENDPOINTS = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  ark: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
} as const;

export const FENFAXIA_ARK_IMAGE = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
export const FENFAXIA_ARK_VIDEO = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
export const FENFAXIA_DASHSCOPE_EMBED = 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings';
export const FENFAXIA_DASHSCOPE_RERANK = 'https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank';
export const FENFAXIA_DASHSCOPE_VIDEO = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis';

export const FENFAXIA_MODELS = {
  bulk: 'deepseek-flash',
  bulkFallback: 'doubao-seed-2-0-lite-260428',
  title: 'doubao-seed-2-0-mini-260428',
  titleFallback: 'qwen-flash',
  review: 'qwen3.5-plus',
  plan: 'deepseek-v4-pro',
  image: 'doubao-seedream-5-0-flash-260915',
  imagePoster: 'qwen-image-2.0',
  imageWan: 'wan2.5-t2i-preview',
  video: 'doubao-seedance-2-0-mini-260615',
  videoWan: 'wan2.5-t2v-preview',
  embed: 'text-embedding-v4',
  rerank: 'qwen3-rerank',
} as const;

export type FenfaxiaProvider = 'deepseek' | 'qwen' | 'ark';
export type FenfaxiaTextRoute = 'bulk' | 'title' | 'review';

export interface FenfaxiaKeys {
  deepseek: string;
  dashscope: string;
  ark: string;
  klingAccess: string;
  klingSecret: string;
}

/** 可灵基址只接受这些境内后缀。没核对过的主机一律不发。 */
const DOMESTIC_HOST_SUFFIXES = [
  'aliyuncs.com',
  'volces.com',
  'volcengine.com',
  'volcengineapi.com',
  'klingai.com',
  'deepseek.com',
  'myqcloud.com',
  'qcloud.com',
  'baidu.com',
  'bcebos.com',
];

/** 产品侧只接受 https，并且主机名落在上面的境内后缀里。 */
export function isDomesticHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return DOMESTIC_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export interface TextCandidate {
  provider: FenfaxiaProvider;
  model: string;
  key: string;
  endpoint: string;
}

function first(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

export function resolveFenfaxiaKeys(env: Record<string, string | undefined>): FenfaxiaKeys {
  return {
    deepseek: first(env.FENFAXIA_DEEPSEEK_API_KEY, env.DEEPSEEK_API_KEY),
    dashscope: first(env.FENFAXIA_DASHSCOPE_API_KEY, env.DASHSCOPE_API_KEY, env.QWEN_API_KEY),
    ark: first(env.FENFAXIA_ARK_API_KEY, env.ARK_API_KEY),
    klingAccess: first(env.FENFAXIA_KLING_ACCESS_KEY, env.KLING_ACCESS_KEY),
    klingSecret: first(env.FENFAXIA_KLING_SECRET_KEY, env.KLING_SECRET_KEY),
  };
}

/**
 * 长文走 Flash，失败再走豆包 lite。只有两家都没配时，才退回千问，避免已有的千问部署直接不能写。
 * 标题走豆包 mini，再退回 qwen-flash。评审只用 qwen3.5-plus，不退回写稿模型。
 */
export function textCandidates(route: FenfaxiaTextRoute, keys: FenfaxiaKeys, models: Partial<Record<keyof typeof FENFAXIA_MODELS, string>> = {}): TextCandidate[] {
  const id = { ...FENFAXIA_MODELS, ...models };
  const chain: TextCandidate[] = [];
  if (route === 'bulk') {
    if (keys.deepseek) chain.push({ provider: 'deepseek', model: id.bulk, key: keys.deepseek, endpoint: FENFAXIA_CHAT_ENDPOINTS.deepseek });
    if (keys.ark) chain.push({ provider: 'ark', model: id.bulkFallback, key: keys.ark, endpoint: FENFAXIA_CHAT_ENDPOINTS.ark });
    if (!chain.length && keys.dashscope) chain.push({ provider: 'qwen', model: id.titleFallback, key: keys.dashscope, endpoint: FENFAXIA_CHAT_ENDPOINTS.qwen });
  } else if (route === 'title') {
    if (keys.ark) chain.push({ provider: 'ark', model: id.title, key: keys.ark, endpoint: FENFAXIA_CHAT_ENDPOINTS.ark });
    if (keys.dashscope) chain.push({ provider: 'qwen', model: id.titleFallback, key: keys.dashscope, endpoint: FENFAXIA_CHAT_ENDPOINTS.qwen });
    if (!chain.length && keys.deepseek) chain.push({ provider: 'deepseek', model: id.bulk, key: keys.deepseek, endpoint: FENFAXIA_CHAT_ENDPOINTS.deepseek });
  } else if (route === 'review') {
    if (keys.dashscope) chain.push({ provider: 'qwen', model: id.review, key: keys.dashscope, endpoint: FENFAXIA_CHAT_ENDPOINTS.qwen });
  }
  return chain;
}

export function chatBody(candidate: TextCandidate, prompt: string, maxTokens: number, temperature: number) {
  const body: Record<string, unknown> = {
    model: candidate.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
  };
  if (candidate.provider === 'deepseek' || candidate.provider === 'ark') body.thinking = { type: 'disabled' };
  if (candidate.model.startsWith('qwen3')) body.enable_thinking = false;
  return body;
}
