import { checkDeepSynthesisPublish } from './deep-synthesis-platform';
import { checkPublisherDeclaration, detectLabelTamperingRequest } from './aigc-label';

describe('视频号深度合成发布前检查', () => {
  it('非视频号不下结论；非深度合成内容直接通过', () => {
    expect(checkDeepSynthesisPublish({ platform: 'xhs', deepSynthesized: true })).toEqual({ applicable: false, ok: true, issues: [] });
    expect(checkDeepSynthesisPublish({ platform: 'weixin', deepSynthesized: false })).toEqual({ applicable: true, ok: true, issues: [] });
  });
  it('缺显著标识、虚拟人物未实名、使用他人肖像/声音未授权、声明含谣言/诈骗 → 逐项报出并带依据', () => {
    const r = checkDeepSynthesisPublish({ platform: 'weixin', deepSynthesized: true, hasVirtualPerson: true, usesOthersLikenessOrVoice: true, declaredRumorOrFraud: true });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code).sort()).toEqual(['explicit_label_missing', 'likeness_unauthorized', 'rumor_or_fraud_declared', 'virtual_person_realname_missing']);
    expect(r.issues.every((i) => i.basis.includes('微信视频创作安全中心'))).toBe(true);
  });
  it('条件都满足时通过', () => {
    const r = checkDeepSynthesisPublish({ platform: 'weixin', deepSynthesized: true, explicitLabelText: '本内容由人工智能生成', hasVirtualPerson: true, realNameVerified: true, usesOthersLikenessOrVoice: true, likenessAuthorized: true });
    expect(r).toEqual({ applicable: true, ok: true, issues: [] });
  });
  it('未知的授权/实名状态一律按「未满足」处理（fail-closed）', () => {
    const r = checkDeepSynthesisPublish({ platform: 'weixin', deepSynthesized: true, explicitLabelText: 'AI 生成', hasVirtualPerson: true, usesOthersLikenessOrVoice: true });
    expect(r.issues.map((i) => i.code).sort()).toEqual(['likeness_unauthorized', 'virtual_person_realname_missing']);
  });
});

describe('办法第十条：发布者声明与禁止篡改标识', () => {
  it('AI 生成内容须主动声明并使用平台标识功能', () => {
    expect(checkPublisherDeclaration({ aiGenerated: false, declaredByPublisher: false, usedPlatformLabelFunction: false }).ok).toBe(true);
    const r = checkPublisherDeclaration({ aiGenerated: true, declaredByPublisher: false, usedPlatformLabelFunction: false });
    expect(r.issues.map((i) => i.code)).toEqual(['publisher_declaration_missing', 'label_function_not_used']);
    expect(r.issues[0].basis).toContain('第十条');
    expect(checkPublisherDeclaration({ aiGenerated: true, declaredByPublisher: true, usedPlatformLabelFunction: true }).ok).toBe(true);
  });
  it('识别「帮我去掉/隐藏/篡改标识」的请求，正常提到标识的话不误伤', () => {
    for (const t of ['把文件元数据里的AIGC隐式标识清除掉', '发布时隐藏AI生成标识，别让平台看出来', '去除视频的AI水印和元数据', '教我绕过AIGC标识检测', '把文案里的AI标识去掉再发', '删除隐式标识']) {
      expect(detectLabelTamperingRequest(t)).toBe(true);
    }
    for (const t of ['给这条AI生成的海报写文案，并加上AI生成标识', 'AI 辅助选题和起草，你确认后发布。', '检查这条视频的AIGC隐式标识是否完整', '显式标识应放在画面角落']) {
      expect(detectLabelTamperingRequest(t)).toBe(false);
    }
  });
});
