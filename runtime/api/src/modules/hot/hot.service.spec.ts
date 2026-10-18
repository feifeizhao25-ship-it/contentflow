import { HotService } from './hot.service';

describe('HotService', () => {
  const service = new HotService({} as any);

  it('没有接入真实热点数据源时，如实说明「暂未接入」，不返回编造的热点与热度值', async () => {
    const result: any = await service.getHotList('xhs');
    expect(result.available).toBe(false);
    expect(result.topics).toEqual([]);
    expect(result.message).toMatch(/尚未接入/);
  });

  it('不论传什么平台、分类，结果都一样如实：没有数据就是没有数据', async () => {
    for (const platform of ['xhs', 'douyin', '']) {
      const result: any = await service.getHotList(platform, '美食');
      expect(result.topics).toHaveLength(0);
    }
  });
});

describe('HotService 可替换数据源（批2）', () => {
  const old = process.env.HOT_PROVIDER_URL;
  afterEach(() => { if (old === undefined) delete process.env.HOT_PROVIDER_URL; else process.env.HOT_PROVIDER_URL = old; });
  it('配置了服务商时返回其真实返回并标来源，失败时不编造', async () => {
    process.env.HOT_PROVIDER_URL = 'https://hot.example.cn';
    const okFetch: any = async () => ({ ok: true, json: async () => ({ topics: [{ id: '1', topic: '城市骑行', heat: 123, platform: 'xhs' }, { bad: true }] }) });
    const svc = new HotService({} as any, okFetch);
    const r: any = await svc.getHotList('xhs');
    expect(r.available).toBe(true); expect(r.topics).toHaveLength(1); expect(r.topics[0].topic).toBe('城市骑行');
    const bad = new HotService({} as any, (async () => { throw new Error('down'); }) as any);
    const r2: any = await bad.getHotList('xhs');
    expect(r2.available).toBe(false); expect(r2.topics).toEqual([]);
  });
});
