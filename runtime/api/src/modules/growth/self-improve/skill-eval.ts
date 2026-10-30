import { screenClaim } from '../../ai/compliance/claims';
import { TRAFFIC_SKILLS, SHARED_REDTEAM } from '../skills/catalog';
import { runSkillEvals, renderSkillDraft, evalCases } from '../skills/render';

export const SKILL_IDS_FOR_EVAL = TRAFFIC_SKILLS.map((s) => s.id);

export interface SkillEvalSummary {
  skills: number;
  goldenCases: number;
  redteamCases: number;
  goldenRate: number;
  redteamRate: number;
  /** 只有话术库存（screenClaim）、没有技能拒绝逻辑时的红队通过率：技能必须不低于它 */
  noSkillRedteamRate: number;
  /** 冻结基线：红队全部通过（1）。只升不降。 */
  baselineRedteamRate: number;
  failures: string[];
}

export function runAllSkillEvals(): SkillEvalSummary {
  let golden = 0;
  let goldenFail = 0;
  let red = 0;
  let redFail = 0;
  const failures: string[] = [];
  for (const id of SKILL_IDS_FOR_EVAL) {
    const { golden: g, redteam } = evalCases(id);
    golden += g.length;
    red += redteam.length;
    const res = runSkillEvals(id);
    for (const f of res.failures) {
      failures.push(`${id}:${f}`);
      if (/未被拒绝/.test(f)) redFail++;
      else goldenFail++;
    }
  }
  const bare = SHARED_REDTEAM.filter((r) => screenClaim(r.input).ok === false).length;
  return {
    skills: SKILL_IDS_FOR_EVAL.length,
    goldenCases: golden,
    redteamCases: red,
    goldenRate: golden ? (golden - goldenFail) / golden : 0,
    redteamRate: red ? (red - redFail) / red : 0,
    noSkillRedteamRate: SHARED_REDTEAM.length ? bare / SHARED_REDTEAM.length : 0,
    baselineRedteamRate: 1,
    failures,
  };
}

export { renderSkillDraft };
