import { fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'node:fs';
import type { ReactNode } from 'react';
import { ClientProviders } from '@/app/client-providers';
import SettingsPage from '@/app/(main)/settings/page';
import { useAppStore } from '@/store/appStore';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
  useServerInsertedHTML: () => {},
}));

const TABS = ['个人资料', '创作计划偏好', '团队设置', '套餐与用量', '通知设置', '账号与数据'] as const;

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) throw new Error(`无法解析颜色 ${color}`);
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (alpha === 0) return null;
  return 0.2126 * channel(Number(match[1])) + 0.7152 * channel(Number(match[2])) + 0.0722 * channel(Number(match[3]));
}

/** 透明背景按白底算。正文对比度至少 4.5:1。 */
function contrastOnWhite(color: string, background: string) {
  const fg = luminance(color);
  const bg = luminance(background);
  if (fg === null) throw new Error(`前景色透明 ${color}`);
  const back = bg === null ? 1 : bg;
  const [hi, lo] = fg > back ? [fg, back] : [back, fg];
  return (hi + 0.05) / (lo + 0.05);
}

function renderInApp(node: ReactNode) {
  return render(<ClientProviders>{node}</ClientProviders>);
}

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: {} }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))) as typeof fetch;
  useAppStore.setState({
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      tenant_id: '22222222-2222-4222-8222-222222222222',
      email: 'linxiao@example.com',
      phone: '138****5678',
      phone_verified: true,
      real_name_verified: false,
      name: '林晓',
      role: 'owner',
    },
    tenant: { id: '22222222-2222-4222-8222-222222222222', name: '林晓工作室', plan: 'pro' },
  });
});

afterEach(() => {
  useAppStore.setState({ user: null, tenant: null });
});

describe('设置页页签', () => {
  it('tablist 里只有六个页签，没有「更多」按钮，可访问名称不含 safety', () => {
    renderInApp(<SettingsPage />);
    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent?.replace(/\s+/g, ''))).toEqual([...TABS]);
    expect(within(tablist).queryByRole('button')).not.toBeInTheDocument();
    expect(tablist.querySelector('.ant-tabs-nav-more, [aria-haspopup]')).toBeNull();
    expect(tablist).toHaveClass('settings-tablist');
    for (const name of TABS) {
      expect(screen.getByRole('tab', { name })).toHaveAccessibleName(name);
    }
    expect(screen.queryByRole('tab', { name: /safety/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tabpanel', { name: /safety/i })).not.toBeInTheDocument();

    const css = fs.readFileSync(`${process.cwd()}/src/app/globals.css`, 'utf8');
    expect(css).toMatch(/\.settings-tablist\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  });
});

describe('设置页对比度', () => {
  it('已验证、永久删除和注销账号的文字至少 4.5:1', () => {
    renderInApp(<SettingsPage />);
    const tag = screen.getByText('已验证');
    const tagStyle = getComputedStyle(tag);
    expect(contrastOnWhite(tagStyle.color, tagStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);

    fireEvent.click(screen.getByRole('tab', { name: '账号与数据' }));
    const deletion = screen.getByText('永久删除，无法恢复');
    const deletionStyle = getComputedStyle(deletion);
    expect(contrastOnWhite(deletionStyle.color, deletionStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    const button = screen.getByRole('button', { name: '注销账号' });
    const buttonStyle = getComputedStyle(button);
    expect(contrastOnWhite(buttonStyle.color, buttonStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('账号与数据');
  });
});
