import { createServer, Server } from 'node:http';
import { AIService, AI_UNAVAILABLE_MESSAGE, DOMESTIC_CHAT_ENDPOINTS } from './ai.service';

function service(twoProviders = false) {
  const env: Record<string, string> = { MARKET_REGION: 'cn', QWEN_API_KEY: 'test-only', ...(twoProviders ? { DEEPSEEK_API_KEY: 'test-only' } : {}) };
  return new AIService({} as never, { get: (key: string, fallback: unknown) => env[key] ?? fallback } as never);
}

describe('domestic text request deadline', () => {
  const realFetch = global.fetch;
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);
  let server: Server | undefined;
  afterEach(async () => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server!.close(() => resolve()));
      server = undefined;
    }
  });

  it.each([false, true])('aborts a real local HTTP response stalled after headers=%s', async (sendHeaders) => {
    server = createServer((_req, res) => {
      if (sendHeaders) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"choices":');
      }
      // Deliberately never completes; the caller must cancel transport/body reading.
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address() as {port:number};
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(100));
    global.fetch = jest.fn((_url, init) => realFetch(`http://127.0.0.1:${address.port}`, init)) as typeof fetch;
    await expect(service().generateText({prompt:'测试'})).rejects.toThrow(AI_UNAVAILABLE_MESSAGE);
    expect(timeout).toHaveBeenCalledWith(30000);
    expect((global.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('uses a fresh deadline for the domestic fallback after a timeout', async () => {
    jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(50));
    let firstSignal: AbortSignal;
    global.fetch = jest.fn()
      .mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
        firstSignal = init.signal;
        init.signal.addEventListener('abort', () => reject(init.signal.reason), {once:true});
      }))
      .mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:'有效结果'}}],usage:{prompt_tokens:1,completion_tokens:2,total_tokens:3}})});
    const result = await service(true).generateText({prompt:'测试'});
    expect(result.provider).toBe('deepseek');
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls.map(c=>c[0])).toEqual([DOMESTIC_CHAT_ENDPOINTS.qwen, DOMESTIC_CHAT_ENDPOINTS.deepseek]);
    expect(calls[1][1].signal).not.toBe(firstSignal!);
    expect(firstSignal!.aborted).toBe(true);
    expect(calls[1][1].signal.aborted).toBe(false);
  });
});
