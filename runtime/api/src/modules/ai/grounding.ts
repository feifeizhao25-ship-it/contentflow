import { findUnverifiedClaims } from './unverified-claims';

/**
 * Brand-claim grounding to user-supplied material. The generator has no product database, so the only
 * thing a specific figure or brand name can be matched against is text the user supplied. This is a
 * text match, not a fact check: "supported" means the figure or name appears in the material the user
 * pasted (the user is responsible for that material being true); "unverified" means it appears in
 * neither the topic nor the material.
 */
export const MATERIAL_MAX_CHARS = 4000;

export interface Grounding {
  materialSupplied: boolean;
  supportedByMaterial: string[];
  unverified: string[];
}

export function groundClaims(content: string, userText: string, material?: string | null): Grounding {
  const mat = String(material ?? '').trim().slice(0, MATERIAL_MAX_CHARS);
  const withoutMaterial = findUnverifiedClaims(content, userText);
  if (!mat) return { materialSupplied: false, supportedByMaterial: [], unverified: withoutMaterial };
  const unverified = findUnverifiedClaims(content, `${userText} ${mat}`);
  return {
    materialSupplied: true,
    supportedByMaterial: withoutMaterial.filter((c) => !unverified.includes(c)),
    unverified,
  };
}

export function materialPromptBlock(material: string | null | undefined, global: boolean): string {
  const mat = String(material ?? '').trim().slice(0, MATERIAL_MAX_CHARS);
  if (!mat) return '';
  return global
    ? `\n\nBrand / product material supplied by the user (the only source for specific figures, ingredients, prices, brand or product names; do not add any that are not here):\n"""\n${mat}\n"""`
    : `\n\n用户提供的品牌/产品资料（具体数字、成分、价格、品牌或产品名只能来自这里，资料里没有的不要写）：\n"""\n${mat}\n"""`;
}

export const GROUNDING_NOTICE_ZH = '“有资料依据”只表示该数据或品牌名出现在你提供的资料里，系统没有核实资料本身；“未核实”的请逐条确认或删除。';
export const GROUNDING_NOTICE_EN = '"Supported" only means the figure or name appears in the material you supplied; the system did not verify the material itself. Confirm or remove each "unverified" item before publishing.';
