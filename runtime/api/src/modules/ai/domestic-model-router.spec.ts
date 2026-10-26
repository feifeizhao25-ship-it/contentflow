import { AIService, AI_UNAVAILABLE_MESSAGE } from './ai.service';
import {
  FENFAXIA_ARK_IMAGE,
  FENFAXIA_ARK_VIDEO,
  FENFAXIA_CHAT_ENDPOINTS,
  FENFAXIA_DASHSCOPE_EMBED,
  FENFAXIA_DASHSCOPE_RERANK,
  FENFAXIA_DASHSCOPE_VIDEO,
  FENFAXIA_MODELS,
  isDomesticHttpUrl,
  resolveFenfaxiaKeys,
  textCandidates,
} from './domestic-model-router';
import { embedWithFallback } from './growth-rag/embedder';
import { rerankWithFallback } from './growth-rag/reranker';

function service(env: Record<string, unknown>) {
  const config = { get: jest.fn((key: string, fallback: unknown) => (key in env ? env[key] : fallback)) };
  return new AIService({} as never, config as never);
}

function chatOk(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 } }) };
}

describe('分发侠国内模型路由', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('长文优先 deepseek-flash，失败再走豆包 lite，不访问境外', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(chatOk('豆包正文')) as jest.Mock;
    const result = await service({
      MARKET_REGION: 'cn',
      FENFAXIA_DEEPSEEK_API_KEY: 'product-deepseek',
      FENFAXIA_ARK_API_KEY: 'product-ark',
      QWEN_API_KEY: 'qk',
    }).generateArticle({ topic: '咖啡', style: '专业', platform: 'xhs' });
    expect(result.model).toBe(FENFAXIA_MODELS.bulkFallback);
    expect(result.content).toContain('豆包正文');
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe(FENFAXIA_CHAT_ENDPOINTS.deepseek);
    expect(JSON.parse(calls[0][1].body).model).toBe('deepseek-flash');
    expect(JSON.parse(calls[0][1].body).thinking).toEqual({ type: 'disabled' });
    expect(calls[1][0]).toBe(FENFAXIA_CHAT_ENDPOINTS.ark);
    expect(calls.map((call) => String(call[0])).join(' ')).not.toMatch(/fal\.|openrouter/);
  });

  it('标题走豆包 mini，失败退回 qwen-flash', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce(chatOk('秋日咖啡笔记')) as jest.Mock;
    const result = await service({
      MARKET_REGION: 'cn',
      DEEPSEEK_API_KEY: 'dk',
      FENFAXIA_ARK_API_KEY: 'ak',
      QWEN_API_KEY: 'qk',
    }).generateTitlesWithUsage('秋天', 'xhs', 1);
    expect(result.titles).toEqual(['秋日咖啡笔记']);
    expect(result.model).toBe('qwen-flash');
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(JSON.parse(calls[0][1].body).model).toBe(FENFAXIA_MODELS.title);
    expect(calls[1][0]).toBe(FENFAXIA_CHAT_ENDPOINTS.qwen);
  });

  it('评审只用 qwen3.5-plus，不退回写稿模型', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }) as jest.Mock;
    await expect(service({
      MARKET_REGION: 'cn',
      DEEPSEEK_API_KEY: 'dk',
      FENFAXIA_ARK_API_KEY: 'ak',
      QWEN_API_KEY: 'qk',
    }).generateText({ prompt: '审这篇', route: 'review' })).rejects.toThrow(AI_UNAVAILABLE_MESSAGE);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(FENFAXIA_CHAT_ENDPOINTS.qwen);
    const body = JSON.parse(calls[0][1].body);
    expect(body.model).toBe('qwen3.5-plus');
    expect(body.enable_thinking).toBe(false);
  });

  it('封面优先 Seedream，国内环境不调用 fal', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://ark-content.volces.com/a.png' }] }),
    }) as jest.Mock;
    const result = await service({
      MARKET_REGION: 'cn',
      DEEPSEEK_API_KEY: 'dk',
      FENFAXIA_ARK_API_KEY: 'ak',
      FAL_API_KEY: 'fal',
    }).generateImage({ prompt: '一杯咖啡' });
    expect(result.provider).toBe('ark');
    expect(result.model).toBe(FENFAXIA_MODELS.image);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(FENFAXIA_ARK_IMAGE);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).not.toContain('fal.');
  });

  it('视频供应商都失败时只留脚本', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }) as jest.Mock;
    const result = await service({
      MARKET_REGION: 'cn',
      FENFAXIA_ARK_API_KEY: 'ak',
      QWEN_API_KEY: 'qk',
      DEEPSEEK_API_KEY: 'dk',
      FAL_API_KEY: 'fal',
    }).generateDomesticVideo({ prompt: '咖啡', seconds: 8 });
    expect(result.mode).toBe('script_only');
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toBe(FENFAXIA_ARK_VIDEO);
    expect(urls).toContain(FENFAXIA_DASHSCOPE_VIDEO);
    expect(urls.join(' ')).not.toMatch(/fal\.|openrouter/);
  });

  it('产品密钥名 FENFAXIA_DEEPSEEK_API_KEY 优先于旧名', () => {
    const keys = resolveFenfaxiaKeys({ FENFAXIA_DEEPSEEK_API_KEY: 'product-key', DEEPSEEK_API_KEY: 'legacy' });
    expect(keys.deepseek).toBe('product-key');
    expect(textCandidates('bulk', keys).map((item) => item.model)).toEqual(['deepseek-flash']);
    expect(textCandidates('review', { ...keys, dashscope: '' })).toEqual([]);
  });

  it('可灵基址只接受 https 且主机在境内后缀内', () => {
    expect(isDomesticHttpUrl('https://api.klingai.com/v1')).toBe(true);
    expect(isDomesticHttpUrl('http://api.klingai.com/v1')).toBe(false);
    expect(isDomesticHttpUrl('https://example.com/v1')).toBe(false);
  });
});

describe('百炼向量与重排', () => {
  it('text-embedding-v4 走百炼兼容接口', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }) });
    const result = await embedWithFallback('选题', { GROWTH_EMBEDDING_PROVIDER: 'text-embedding-v4', FENFAXIA_DASHSCOPE_API_KEY: 'sk' }, fetchImpl as never);
    expect(result).toMatchObject({ embedder: 'text-embedding-v4', fallback: false });
    expect(fetchImpl.mock.calls[0][0]).toBe(FENFAXIA_DASHSCOPE_EMBED);
    expect(String(fetchImpl.mock.calls[0][1].headers.authorization)).toBe('Bearer sk');
  });

  it('没配密钥时不请求', async () => {
    const fetchImpl = jest.fn();
    const result = await embedWithFallback('选题', { GROWTH_EMBEDDING_PROVIDER: 'text-embedding-v4' }, fetchImpl);
    expect(result.fallback).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('qwen3-rerank 按原文顺序还原分数', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output: { results: [{ index: 1, relevance_score: 0.2 }, { index: 0, relevance_score: 0.9 }] } }),
    });
    const result = await rerankWithFallback('问', ['甲', '乙'], { GROWTH_RERANKER_PROVIDER: 'qwen3-rerank', QWEN_API_KEY: 'sk' }, fetchImpl as never);
    expect(result.reranker).toBe('qwen3-rerank');
    expect(result.scores).toEqual([0.9, 0.2]);
    expect(fetchImpl.mock.calls[0][0]).toBe(FENFAXIA_DASHSCOPE_RERANK);
  });
});
