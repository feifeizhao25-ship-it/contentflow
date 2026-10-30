import { checkAigcBeforePublish, checkExplicitLabel, checkImplicitMetadata } from './aigc-label';

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
