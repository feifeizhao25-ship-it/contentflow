import { screenClaim } from '../../ai/compliance/claims';
import { AI_TEXT_LABEL } from '../../../common/ai-content-label';
import { detectLabelTamperingRequest } from '../../ai/compliance/rules/aigc-label';
import { checkCompliance } from '../self-improve/compliance';
import { scanInjection } from '../self-improve/sources';
import { SHARED_REDTEAM, SkillGolden, SkillRedteam, goldenFor, skillById } from './catalog';

const PLATFORM_NAMES: Record<string, string> = {
  xhs: '小红书',
  wechat_mp: '公众号',
  weixin: '视频号',
  douyin: '抖音',
  zhihu: '知乎',
  bilibili: 'B站',
};

export interface SkillDraft {
  skillId: string;
  version: string;
  refused: boolean;
  reason?: string;
  status: 'manual_pending' | 'refused' | 'draft';
  body: string;
}

function inputText(input: Record<string, unknown>): string {
  return typeof input.text === 'string' ? input.text : JSON.stringify(input);
}

function refuseReason(text: string): string | null {
  if (/全自动发布|无人值守|托管运营|自动涨粉/.test(text)) return '不能提供全自动发布、托管运营或自动涨粉的做法。';
  if (/养号|矩阵号|cookie/i.test(text)) return '不能提供养号、矩阵号或 Cookie 登录教程。';
  if (/拉踩|抹黑竞品/.test(text)) return '不能生成竞品拉踩文案。';
  if (/软文/.test(text) && !/标明广告|标注广告/.test(text)) return '商业软文必须标明广告。';
  if (/(无需|不用|不必|绕过|规避|跳过).{0,6}(备案|发行许可|许可证|节目编号|内容审核)/.test(text)) return '微短剧须按分类备案、取得发行许可或节目编号后播出，不能绕过。';
  if (/(批量|群发).{0,6}(私信|加好友|骚扰)/.test(text)) return '不能提供批量私信、骚扰引流的做法。';
  if (/未成年人.{0,10}(酒|医疗|药品|保健|美容).{0,4}广告/.test(text)) return '不得向未成年人投放此类广告。';
  // 2026-10-31（依据：《人工智能生成合成内容标识办法》第十条；视频号《关于创作者规范使用深度合成技术生成内容的建议》）
  if (detectLabelTamperingRequest(text)) return '不能协助删除、篡改或隐匿 AI 生成合成内容标识（《人工智能生成合成内容标识办法》第十条）。';
  if (/(不|无需|不用|不必|别|免).{0,3}(标注|标识|标明).{0,6}(AIGC|AI|人工智能)|(AIGC|AI|人工智能).{0,30}(不用|不必|无需|不要|别).{0,2}(标注|标识|标明)/i.test(text)) return 'AI 生成合成内容发布时须主动声明并标识，不能提供不标识的做法。';
  if (/换脸|克隆.{0,6}(声音|嗓音|人脸|肖像)|(未经|不经|没经过?|无需|不用).{0,4}(授权|同意).{0,10}(声音|人脸|肖像|形象)|(合成|模仿|冒用|盗用).{0,6}(明星|名人|主持人|博主|专家|医生).{0,6}(的)?(声音|口播|形象|人脸|肖像)/.test(text)) return '不得未经授权使用他人肖像、声音生成内容（含换脸、声音克隆）。';
  if (/(AI|深度合成|数字人|虚拟人).{0,10}(造谣|编造谣言|诈骗|欺诈|制造虚假)|(造谣|诈骗|欺诈).{0,6}(视频|音频|话术|内容)/i.test(text)) return '不得利用深度合成技术制作谣言、虚假信息或实施诈骗。';
  if (/(虚拟人|数字人|AI).{0,10}(编|冒充|伪装|假扮).{0,6}(真人|医生|专家|教授|律师)|冒充.{0,4}真人/i.test(text)) return '虚拟人物须显著标识，不能冒充真人或伪造专业身份。';
  if (scanInjection(text).length) return '输入含改写规则的指令，已拒绝。';
  const semantic = checkCompliance(text, ['traffic_promise', 'strip_ai_label', 'investment_advice', 'return_promise', 'medical_claim', 'absolute_claim', 'ad_law_superlative', 'fake_authority']);
  if (!semantic.ok) return `话术未通过合规闸：${semantic.families.join('、')}`;
  const screened = screenClaim(text);
  if (!screened.ok) return `话术未通过合规闸：${screened.hits.join('、')}`;
  return null;
}

function topicOf(input: Record<string, unknown>): string {
  const topic = typeof input.topic === 'string' && input.topic.trim() ? input.topic.trim() : '未命名主题';
  return topic.slice(0, 80);
}

function bodyFor(skillId: string, input: Record<string, unknown>): { status: SkillDraft['status']; body: string } {
  const topic = topicOf(input);
  const platform = PLATFORM_NAMES[String(input.platform ?? 'xhs')] ?? '该平台';
  const lead = `${AI_TEXT_LABEL}\n`;
  switch (skillId) {
    case 'platform-copy':
      return {
        status: 'manual_pending',
        body: `${lead}平台：${platform}\n选题：${topic}\n文案：先写可核对的体验，再列三点要点。发布前请你核对事实。\n发布方式：请人工确认后发布。本产品不代你向平台提交。`,
      };
    case 'title-cover':
      return {
        status: 'manual_pending',
        body: `${lead}选题：${topic}\n标题候选：\n1. ${topic}，只记三件可核对的事\n2. 发布前先人工确认的${topic}\n封面：实拍或已授权图片，避免绝对化用语。请人工确认后使用。`,
      };
    case 'schedule':
      return {
        status: 'manual_pending',
        body: `${lead}选题：${topic}\n建议时段：工作日 12:15、20:30。这只是建议，请人工确认后自己到平台发布。`,
      };
    case 'seo-aso-keywords':
      return {
        status: 'draft',
        body: `${lead}选题：${topic}\n微信搜一搜候选词：${topic}\n百度候选词：${topic} 怎么写\n应用商店候选词：内容草稿 人工确认\n这些词不保证排名。请人工确认后使用。`,
      };
    case 'geo-cn-search':
      return {
        status: 'draft',
        body: `${lead}选题：${topic}\n只写已经核对的事实，并附出处。不要编造概念，不要购买引用投放。页面改动请人工确认。`,
      };
    case 'cn-fenfaxia-template-seo':
      return {
        status: 'draft',
        body: `${lead}模板页草稿：${topic}\n状态：草稿。未人工批准前不上线。请人工确认事实和出处。`,
      };
    case 'cn-fenfaxia-geo-monitor':
      return {
        status: 'draft',
        body: `${lead}监测记录草稿。App 与 Web 分开登记，不抓取、不刷量。请人工确认后录入。`,
      };
    case 'cn-fenfaxia-newterm-radar':
      return {
        status: 'draft',
        body: `${lead}选题草稿：${typeof input.term === 'string' ? input.term : topic}\n只生成草稿，不自动上线页面。请人工确认。`,
      };
    case 'cn-fenfaxia-mp-article-draft':
      return {
        status: 'manual_pending',
        body: `${lead}公众号长文草稿：${topic}\n开头说明这是 AI 辅助起草。请人工确认后发布，不要写成代发教程。`,
      };
    case 'cn-fenfaxia-video-script':
      return {
        status: 'manual_pending',
        body: `${lead}平台：${platform}\n脚本：前三秒给结论，结尾请观众自己判断。请人工确认后发布。`,
      };
    case 'cn-fenfaxia-aso':
      return {
        status: 'draft',
        body: `${lead}应用商店文案草稿：${topic}。副标题写人工确认后发布。不承诺榜单。请人工确认。`,
      };
    case 'cn-growth-compliance-gate':
      return {
        status: 'draft',
        body: `${lead}合规闸：通过。文案未命中禁止话术。对外仍须人工确认后发布。`,
      };
    default:
      return {
        status: 'manual_pending',
        body: `${lead}候选选题：\n1. ${topic}怎么记三件可核对的事\n2. 为什么${topic}发布前要人工确认\n请人工确认后再决定是否使用。`,
      };
  }
}

export function renderSkillDraft(skillId: string, input: Record<string, unknown> = {}): SkillDraft {
  const skill = skillById(skillId);
  if (!skill) {
    return { skillId, version: '0.0.0', refused: true, reason: '未知技能', status: 'refused', body: '' };
  }
  const reason = refuseReason(inputText(input));
  if (reason) {
    return { skillId, version: skill.version, refused: true, reason, status: 'refused', body: reason };
  }
  const rendered = bodyFor(skillId, input);
  const screened = screenClaim(rendered.body);
  if (!screened.ok) {
    return {
      skillId,
      version: skill.version,
      refused: true,
      reason: `草稿含禁止话术：${screened.hits.join('、')}`,
      status: 'refused',
      body: '草稿未通过合规闸',
    };
  }
  return { skillId, version: skill.version, refused: false, status: rendered.status, body: rendered.body };
}

export function evalCases(skillId: string): { golden: SkillGolden[]; redteam: SkillRedteam[] } {
  const skill = skillById(skillId);
  return { golden: skill ? goldenFor(skill) : [], redteam: SHARED_REDTEAM };
}

export function runSkillEvals(skillId: string): { pass: boolean; failures: string[] } {
  const { golden, redteam } = evalCases(skillId);
  const failures: string[] = [];
  for (const item of golden) {
    const draft = renderSkillDraft(skillId, item.input);
    if (draft.refused) failures.push(`${item.id} 被拒绝`);
    for (const piece of item.expect.includes) {
      if (!draft.body.includes(piece)) failures.push(`${item.id} 缺少 ${piece}`);
    }
    for (const piece of item.expect.excludes) {
      if (draft.body.includes(piece)) failures.push(`${item.id} 含有 ${piece}`);
    }
  }
  for (const item of redteam) {
    const draft = renderSkillDraft(skillId, { text: item.input });
    if (!draft.refused) failures.push(`${item.id} 未被拒绝`);
  }
  return { pass: failures.length === 0, failures };
}
