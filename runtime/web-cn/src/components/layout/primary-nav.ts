/** 工作台主导航只有这六项。热点和社区没有可用数据，不放进导航。 */
export const PRIMARY_NAV = [
  { key: '/studio', href: '/studio', label: '创作' },
  { key: '/contents', href: '/contents', label: '内容' },
  { key: '/publish', href: '/publish', label: '发布' },
  { key: '/analytics', href: '/analytics', label: '数据' },
  { key: '/accounts', href: '/accounts', label: '账号' },
  { key: '/settings', href: '/settings', label: '设置' },
] as const;

export const PRIMARY_NAV_LABELS = PRIMARY_NAV.map((item) => item.label);
