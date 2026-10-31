/**
 * 规则包：虚假人设预检（关键词级，不判断真假）。
 *
 * 依据：中央网信办《关于开展“清朗·整治短视频虚假人设乱象”专项行动》（2026-09-30 发布，为期 2 个月，
 * https://www.cac.gov.cn/2026-09/30/c_1792520301987752.htm，2026-10-31 全文已读）列出的五类问题：
 *   1 假扮弱势群体博同情；2 虚构职业资质（假医生、假律师、假教师等）；3 AI 仿冒真人或虚构真人身份；
 *   4 包装豪门 / 鼓吹奢靡与迷信（含风水、占星、玄学“改运消灾”）；5 编造冲突剧情（家暴、弃养、失散、人性测试等）。
 * 专项明确：不得借“虚构演绎”“AI 生成”等标签规避——加了标签也不算合规，所以结果里 labelDoesNotExempt 恒为 true。
 *
 * 这是发布前提醒，不是法律结论：命中说明文案“像”这五类，必须人工看；没命中不等于合规。
 * 纯函数；不联网。平台处置案例（抖音 / 小红书公告）只作背景，不进规则依据。
 */

export type FalsePersonaCode = 'fake_vulnerable' | 'fake_credential' | 'ai_impersonation' | 'luxury_superstition' | 'fabricated_conflict';

export interface FalsePersonaIssue {
  code: FalsePersonaCode;
  message: string;
  basis: string;
  matched: string;
}

export interface FalsePersonaResult {
  ok: boolean;
  issues: FalsePersonaIssue[];
  /** 标注“虚构演绎 / AI 生成”不免除上述问题（清朗专项明确）。 */
  labelDoesNotExempt: true;
}

export const FALSE_PERSONA_BASIS = '中央网信办“清朗·整治短视频虚假人设乱象”专项行动（2026-09-30）';

const RULES: { code: FalsePersonaCode; message: string; patterns: RegExp[] }[] = [
  {
    code: 'fake_vulnerable',
    message: '疑似假扮弱势群体博取同情（摆拍、编造身份或遭遇）。',
    patterns: [
      /(假扮|扮演|摆拍|伪装|装成|冒充|编造|虚构|设定).{0,8}(送外卖|外卖员|外卖小哥|快递员|环卫|残疾|重病|癌症|留守|孤寡|贫困|农民工|单亲|卖惨)/,
      /(高学历|博士|硕士|名校).{0,6}(假装|扮成|人设).{0,6}(送外卖|摆摊|扫街)/,
      /(卖惨|博同情).{0,6}(人设|剧本|文案|引流|带货)/,
    ],
  },
  {
    code: 'fake_credential',
    message: '疑似虚构职业资质（没有资质却以医生、律师、教师、专家等身份出镜或背书）。',
    patterns: [
      /(假扮|冒充|伪装|包装|虚构|编造|伪造).{0,8}(医生|主任医师|律师|教师|老师|专家|教授|心理咨询师|营养师|药师)/,
      /(没有|无|不具备).{0,4}(资质|执业证|资格证).{0,8}(自称|对外说|以).{0,6}(医生|律师|专家|咨询师)/,
      /(伪造|购买|买).{0,4}(职称|执业证|资格证|学历).{0,4}(证书|证明)?/,
    ],
  },
  {
    code: 'ai_impersonation',
    message: '疑似用 AI 仿冒真人或为虚拟形象编造真人身份。',
    patterns: [
      /(AI|人工智能|数字人|虚拟人|合成).{0,14}(冒充|假扮|伪装|扮成|扮演|编造).{0,10}(真人|医生|专家|明星|名人|网红|主播|老师|律师)/i,
      /(给|为).{0,8}(AI|数字人|虚拟人|虚拟形象).{0,8}(编|设定|写).{0,6}(真人|真实).{0,4}(身份|履历|简历)/i,
    ],
  },
  {
    code: 'luxury_superstition',
    message: '疑似包装豪门 / 鼓吹奢靡，或以风水、占星、玄学“改运消灾”牟利。',
    patterns: [
      /(租|借|摆拍|伪装|包装).{0,6}(豪车|豪宅|名表|奢侈品|豪门).{0,10}(炫富|人设|吸引|引流|带货|身份)/,
      /(包装|假扮|扮成|自称|打造).{0,6}(风水|玄学|命理|占卜|占星|算命).{0,4}(大师|老师|导师)/,
      /(付费|收费|转账|红包).{0,8}(改运|消灾|化煞|转运|开光|解厄)/,
      /(风水|占星|玄学|命理).{0,10}(改运|消灾|化煞|转运)/,
    ],
  },
  {
    code: 'fabricated_conflict',
    message: '疑似编造冲突剧情（家暴、虐待、遗弃、弃养、失散、人性测试等）冒充真实事件。',
    patterns: [
      /(编造|虚构|自导自演|摆拍|剧本).{0,10}(家暴|虐待|遗弃|弃养|辍学|失散|绑架|被拐|寻亲|救助|助人|出轨|人性测试)/,
      /(人性测试|当街|路人).{0,6}(摆拍|剧本|自导自演)/,
    ],
  },
];

/** 逐条返回命中项。同一类只报第一处命中。 */
export function checkFalsePersona(text: string): FalsePersonaResult {
  const issues: FalsePersonaIssue[] = [];
  const body = String(text ?? '');
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = re.exec(body);
      if (m) {
        issues.push({ code: rule.code, message: rule.message, basis: FALSE_PERSONA_BASIS, matched: m[0] });
        break;
      }
    }
  }
  return { ok: issues.length === 0, issues, labelDoesNotExempt: true };
}

/** 供技能草稿拒答用：用户明确要求“做”这类内容时返回拒答原因。 */
export function detectFalsePersonaRequest(text: string): string | null {
  const r = checkFalsePersona(text);
  if (r.ok) return null;
  return `不能协助生成虚假人设内容（${r.issues.map((i) => i.code).join('、')}）；标注“虚构演绎”或“AI 生成”也不能规避（${FALSE_PERSONA_BASIS}）。`;
}
