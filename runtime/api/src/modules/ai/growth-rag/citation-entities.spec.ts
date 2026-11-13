import { checkCitationEntities, extractCitationEntities } from './citation-entities';

const GB = '标准号：GB 45438-2025；中文标准名称：网络安全技术 人工智能生成合成内容标识方法。';
const ARTICLE = '第十条 用户使用网络信息内容传播服务发布生成合成内容的，应当主动声明并使用服务提供者提供的标识功能进行标识。';

describe('引用实体校验', () => {
  it('标准号在被引原文里则通过', () => {
    const result = checkCitationEntities('文本标识见 GB 45438-2025。', [GB]);
    expect(result.ok).toBe(true);
    expect(result.checked).toContain('GB45438-2025');
  });

  it('文号不在片段中则 citation 失败', () => {
    const result = checkCitationEntities('见 GB 45438-2025，并执行令第23号。', [GB]);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('令第23号');
    expect(result.missing).not.toContain('GB45438-2025');
  });

  it('条文号必须出现在被引片段', () => {
    expect(checkCitationEntities('第十条要求主动声明。', [ARTICLE]).ok).toBe(true);
    expect(checkCitationEntities('第十七条禁止编造人设。', [ARTICLE]).ok).toBe(false);
  });

  it('平台名不在被引原文里则失败', () => {
    const result = checkCitationEntities('小红书笔记要标明广告。', ['互联网广告应当具有可识别性，能够使消费者辨明其为广告。']);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('小红书');
  });

  it('平台名在原文里则通过，发文字号也要在原文里', () => {
    const cited = '国信办通字〔2025〕2号。哔哩哔哩社区小管家公告：转载需标明来源。';
    expect(checkCitationEntities('依据：国信办通字〔2025〕2号，哔哩哔哩要求标明来源。', [cited]).ok).toBe(true);
    expect(checkCitationEntities('依据：国信办通字〔2025〕2号，抖音要求标明来源。', [cited]).missing).toEqual(['抖音']);
  });

  it('文号紧贴上一句、中间没有标点时，不把句子前半段算进文号', () => {
    const glued = '用户应当主动声明国信办通字〔2025〕2号';
    expect(extractCitationEntities(glued)).toEqual(['国信办通字〔2025〕2号']);
    expect(extractCitationEntities('本产品不代发国信办通字〔2025〕2号')).toEqual(['国信办通字〔2025〕2号']);
    expect(checkCitationEntities(glued, ['国信办通字〔2025〕2号']).ok).toBe(true);
    expect(checkCitationEntities('没有标点国信办通字〔2099〕8号', ['国信办通字〔2025〕2号']).ok).toBe(false);
  });
});
