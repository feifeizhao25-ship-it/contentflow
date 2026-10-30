/**
 * 规则包：微短剧发布前检查。
 *
 * 依据：国家广播电视总局令第16号《微短剧发展管理办法》（2026-07-30 公布，2026-09-01 起施行）：
 * - 第二条：微短剧指单集时长少于二十分钟的剧集。
 * - 第五条：按投资额度、题材分一类 / 二类 / 三类；分类标准由国务院广播电视主管部门制定并适时调整，
 *   所以本模块不判断「一个片子属于哪一类」，类别由调用方传入（来自备案或平台审核结果）。
 * - 第十七条：一类取得《微短剧发行许可证》；二类取得批准文件；三类由播出单位播前审核并标注节目编号。
 *   未取得的，不得播出。
 * - 第二十七条：片头明显位置标注剧名及许可证号 / 批准文件编号 / 节目编号；编剧、导演署名位于首集片头或末集片尾。
 * - 第三十四条：使用人工智能技术生成、制作的微短剧，每集明显位置添加提示标识。
 *
 * 2025 年旧通知（广电办发〔2024〕35号）的「重点/普通/其他」分类和备案号格式已被新办法替代，这里不再使用。
 * 纯函数；不联网，不做任何内容好坏的判断。
 */

export type MicroDramaCategory = 'class1' | 'class2' | 'class3';

export type MicroDramaIssueCode =
  | 'episode_too_long'
  | 'category_unknown'
  | 'license_missing'
  | 'approval_missing'
  | 'program_number_missing'
  | 'opening_info_missing'
  | 'credits_missing'
  | 'ai_label_missing_episode';

export interface MicroDramaIssue {
  code: MicroDramaIssueCode;
  message: string;
  basis: string;
  /** 哪一集有问题（仅 AI 标识检查用）。 */
  episode?: number;
}

export interface MicroDramaEpisode {
  number: number;
  minutes: number;
  /** 这一集在明显位置是否有 AI 生成提示标识。 */
  hasAiLabel?: boolean;
}

export interface MicroDramaPublishInput {
  title: string;
  category: MicroDramaCategory | null | undefined;
  /** 《微短剧发行许可证》号（一类）。 */
  licenseNo?: string | null;
  /** 批准文件编号（二类）。 */
  approvalNo?: string | null;
  /** 播出单位标注的节目编号（三类）。 */
  programNo?: string | null;
  /** 片头明显位置是否已标注剧名和对应编号。 */
  openingShowsTitleAndNumber: boolean;
  /** 编剧、导演署名是否在首集片头或末集片尾醒目位置。 */
  creditsOnFirstOpeningOrLastEnding: boolean;
  usesAiGeneration: boolean;
  episodes: MicroDramaEpisode[];
}

export interface MicroDramaCheckResult {
  ok: boolean;
  issues: MicroDramaIssue[];
}

const BASIS = {
  definition: '《微短剧发展管理办法》第二条',
  category: '《微短剧发展管理办法》第五条',
  permit: '《微短剧发展管理办法》第十七条',
  labelling: '《微短剧发展管理办法》第二十七条',
  ai: '《微短剧发展管理办法》第三十四条',
} as const;

const filled = (value: string | null | undefined): boolean => typeof value === 'string' && value.trim().length > 0;

export function checkMicroDramaBeforePublish(input: MicroDramaPublishInput): MicroDramaCheckResult {
  const issues: MicroDramaIssue[] = [];

  for (const episode of input.episodes) {
    if (episode.minutes >= 20) {
      issues.push({
        code: 'episode_too_long',
        message: `第 ${episode.number} 集时长 ${episode.minutes} 分钟，达到或超过 20 分钟，不属于微短剧定义范围。`,
        basis: BASIS.definition,
        episode: episode.number,
      });
    }
  }

  switch (input.category) {
    case 'class1':
      if (!filled(input.licenseNo)) {
        issues.push({ code: 'license_missing', message: '一类微短剧缺少《微短剧发行许可证》号，未取得不得播出。', basis: BASIS.permit });
      }
      break;
    case 'class2':
      if (!filled(input.approvalNo)) {
        issues.push({ code: 'approval_missing', message: '二类微短剧缺少批准文件编号，未取得不得播出。', basis: BASIS.permit });
      }
      break;
    case 'class3':
      if (!filled(input.programNo)) {
        issues.push({ code: 'program_number_missing', message: '三类微短剧缺少播出单位标注的节目编号，未标注不得播出。', basis: BASIS.permit });
      }
      break;
    default:
      issues.push({ code: 'category_unknown', message: '未提供微短剧类别（一类/二类/三类），无法确定需要哪种许可或编号。', basis: BASIS.category });
  }

  if (!input.openingShowsTitleAndNumber || !filled(input.title)) {
    issues.push({ code: 'opening_info_missing', message: '片头明显位置需要标注剧名和对应的许可证号 / 批准文件编号 / 节目编号。', basis: BASIS.labelling });
  }
  if (!input.creditsOnFirstOpeningOrLastEnding) {
    issues.push({ code: 'credits_missing', message: '编剧、导演署名需放在首集片头或末集片尾字幕的醒目位置。', basis: BASIS.labelling });
  }

  if (input.usesAiGeneration) {
    for (const episode of input.episodes) {
      if (episode.hasAiLabel !== true) {
        issues.push({
          code: 'ai_label_missing_episode',
          message: `第 ${episode.number} 集使用了 AI 生成，但没有在明显位置添加提示标识。`,
          basis: BASIS.ai,
          episode: episode.number,
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
