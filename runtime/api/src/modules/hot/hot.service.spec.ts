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
