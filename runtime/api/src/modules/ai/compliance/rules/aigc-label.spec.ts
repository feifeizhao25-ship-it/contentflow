import { checkAigcBeforePublish, checkExplicitLabel, checkImplicitMetadata, checkLabelTextHeight, checkVideoLabelWindow, minLabelTextHeightPx } from './aigc-label';

const good = {
  AIGC: { Label: '1', ContentProducer: 'contentflow', ProduceID: 'p-001', ContentPropagator: 'contentflow', PropagateID: 'p-001' },
};

describe('AIGC 显式标识', () => {
  it('空提示被拦下', () => {
    expect(checkExplicitLabel('').issues[0].code).toBe('explicit_missing');
    expect(checkExplicitLabel(undefined).ok).toBe(false);
  });
  it('同时含人工智能/AI 与生成/合成才通过', () => {
    expect(checkExplicitLabel('本内容由人工智能生成').ok).toBe(true);
    expect(checkExplicitLabel('AI合成').ok).toBe(true);
    expect(checkExplicitLabel('本内容由人工智能辅助').issues.map((i) => i.code)).toEqual(['explicit_missing_generation_element']);
    expect(checkExplicitLabel('内容为生成合成').issues.map((i) => i.code)).toEqual(['explicit_missing_ai_element']);
  });
  it('角标只要求含 AI', () => {
    expect(checkExplicitLabel('AI', { allowCornerMark: true }).ok).toBe(true);
    expect(checkExplicitLabel('AI').ok).toBe(false);
  });
  it('每条问题都带条款出处', () => {
    for (const issue of checkExplicitLabel('').issues) expect(issue.basis).toContain('GB 45438');
  });
});

describe('AIGC 元数据隐式标识', () => {
  it('附录 E 整体格式与内层对象都能通过', () => {
    expect(checkImplicitMetadata(JSON.stringify(good)).ok).toBe(true);
    expect(checkImplicitMetadata(JSON.stringify(good.AIGC)).ok).toBe(true);
  });
  it('缺失或不是 JSON', () => {
    expect(checkImplicitMetadata(null).issues[0].code).toBe('implicit_missing');
    expect(checkImplicitMetadata('not json').issues[0].code).toBe('implicit_not_json');
    expect(checkImplicitMetadata('[1]').issues[0].code).toBe('implicit_not_json');
    expect(checkImplicitMetadata('{"foo":1}').issues[0].code).toBe('implicit_missing_aigc_key');
  });
  it('Label 只能是字符串 1/2/3', () => {
    expect(checkImplicitMetadata(JSON.stringify({ AIGC: { ...good.AIGC, Label: '4' } })).issues[0].code).toBe('implicit_label_invalid');
    expect(checkImplicitMetadata(JSON.stringify({ AIGC: { ...good.AIGC, Label: 1 } })).issues[0].code).toBe('implicit_field_not_string');
    for (const label of ['1', '2', '3']) {
      expect(checkImplicitMetadata(JSON.stringify({ AIGC: { ...good.AIGC, Label: label } })).ok).toBe(true);
    }
  });
  it('制作要素必填，传播要素按需', () => {
    const noProducer = { AIGC: { Label: '1', ProduceID: 'x' } };
    expect(checkImplicitMetadata(JSON.stringify(noProducer)).issues[0].message).toContain('ContentProducer');
    const productionOnly = { AIGC: { Label: '1', ContentProducer: 'a', ProduceID: 'b' } };
    expect(checkImplicitMetadata(JSON.stringify(productionOnly)).ok).toBe(true);
    const strict = checkImplicitMetadata(JSON.stringify(productionOnly), { requirePropagation: true });
    expect(strict.issues.map((i) => i.message).join()).toContain('ContentPropagator');
    expect(strict.issues.map((i) => i.message).join()).toContain('PropagateID');
  });
  it('字段类型必须是字符串', () => {
    const bad = { AIGC: { Label: '1', ContentProducer: 'a', ProduceID: 7 } };
    expect(checkImplicitMetadata(JSON.stringify(bad)).issues[0].code).toBe('implicit_field_not_string');
  });
});

describe('GB 45438 可检查的显式标识尺寸和视频时长', () => {
  it('文字高度至少是最短边的 5%，相等通过、差一点不通过', () => {
    expect(minLabelTextHeightPx(1000)).toBe(50);
    expect(checkLabelTextHeight(50, 1000).ok).toBe(true);
    expect(checkLabelTextHeight(49.9, 1000).issues[0].code).toBe('explicit_label_too_small');
    expect(checkLabelTextHeight(18, 1080).ok).toBe(false);
    expect(checkLabelTextHeight(10, 0).ok).toBe(false);
  });
  it('视频标识须在起始画面且不少于 2 秒', () => {
    expect(checkVideoLabelWindow({ startsAtSeconds: 0, visibleSeconds: 2 }).ok).toBe(true);
    expect(checkVideoLabelWindow({ startsAtSeconds: 0.5, visibleSeconds: 3 }).issues.map((i) => i.code)).toEqual(['video_label_not_at_start']);
    expect(checkVideoLabelWindow({ startsAtSeconds: 0, visibleSeconds: 1.9 }).issues.map((i) => i.code)).toEqual(['video_label_too_brief']);
    expect(checkVideoLabelWindow(null).issues.map((i) => i.code)).toEqual(['video_label_not_at_start', 'video_label_too_brief']);
  });
  it('发布检查在调用方给出尺寸或时长时执行这两条，没给则不额外拦截', () => {
    const base = { kind: 'video' as const, aiGenerated: true, explicitLabelText: '内容由AI生成', implicitMetadata: JSON.stringify(good) };
    expect(checkAigcBeforePublish(base).ok).toBe(true);
    expect(checkAigcBeforePublish({ ...base, shortestSidePx: 200, labelTextHeightPx: 9 }).issues.map((i) => i.code)).toContain('explicit_label_too_small');
    expect(checkAigcBeforePublish({ ...base, shortestSidePx: 200, labelTextHeightPx: 10, videoLabelStartsAtSeconds: 0, videoLabelVisibleSeconds: 2 }).ok).toBe(true);
    expect(checkAigcBeforePublish({ ...base, videoLabelVisibleSeconds: 1 }).issues.map((i) => i.code)).toEqual(expect.arrayContaining(['video_label_not_at_start', 'video_label_too_brief']));
  });
});

describe('发布前标识检查', () => {
  it('非 AI 内容直接通过', () => {
    expect(checkAigcBeforePublish({ kind: 'video', aiGenerated: false }).ok).toBe(true);
  });
  it('AI 内容缺任何一类标识都不通过', () => {
    const none = checkAigcBeforePublish({ kind: 'video', aiGenerated: true });
    expect(none.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['explicit_missing', 'implicit_missing']));
    expect(checkAigcBeforePublish({ kind: 'video', aiGenerated: true, explicitLabelText: '内容由AI生成' }).ok).toBe(false);
    expect(checkAigcBeforePublish({ kind: 'video', aiGenerated: true, implicitMetadata: JSON.stringify(good) }).ok).toBe(false);
  });
  it('两类标识齐全才通过', () => {
    expect(
      checkAigcBeforePublish({ kind: 'video', aiGenerated: true, explicitLabelText: '内容由AI生成', implicitMetadata: JSON.stringify(good), requirePropagation: true }).ok,
    ).toBe(true);
  });
});
