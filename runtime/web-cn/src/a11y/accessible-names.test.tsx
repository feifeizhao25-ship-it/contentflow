import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { ClientProviders } from '@/app/client-providers';
import LoginPage from '@/app/(auth)/login/page';
import SettingsPage from '@/app/(main)/settings/page';
import { DATA_EXPORT_TIMEOUT_MS } from '@/lib/account-service';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
  useServerInsertedHTML: () => {},
}));

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/users/me/export')) return jsonResponse({ success: true, data: { account: {} } });
    return jsonResponse({ success: true, data: {} });
  }) as typeof fetch;
});

function renderInApp(node: ReactNode) {
  return render(<ClientProviders>{node}</ClientProviders>);
}

describe('登录按钮的可访问名称', () => {
  it('是「登录」，不是插了空格的「登 录」，并用字距类保住视觉', () => {
    renderInApp(<LoginPage />);
    const buttons = screen.getAllByRole('button', { name: '登录' });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).toHaveClass('cn-cjk-pair');
    expect(screen.queryByRole('button', { name: '登 录' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '邮箱密码登录' }));
    expect(screen.getByRole('button', { name: '登录' })).toHaveClass('cn-cjk-pair');
    expect(screen.queryByRole('button', { name: '登 录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /eye/i })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '显示密码' })).toBeInTheDocument();
  });
});

describe('图标不进入控件名称', () => {
  it('带图标的按钮名称只有中文，图标名不会混进去', () => {
    renderInApp(
      <>
        <Button type="link">通过</Button>
        <Button className="cn-cjk-pair">重试</Button>
        <Button icon={<DownloadOutlined aria-hidden />}>导出</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: '通过' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toHaveClass('cn-cjk-pair');
    expect(screen.queryByRole('button', { name: '重 试' })).not.toBeInTheDocument();
    const exportButton = screen.getByRole('button', { name: '导出' });
    expect(exportButton).not.toHaveClass('cn-cjk-pair');
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'download' })).not.toBeInTheDocument();
  });

  it('设置页页签和导出按钮只用中文名称', () => {
    renderInApp(<SettingsPage />);
    for (const name of ['个人资料', '创作计划偏好', '团队设置', '套餐与用量', '通知设置', '账号与数据']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('tab', { name: /safety|user|bell|team|credit-card|calendar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '账号与数据' }));
    expect(screen.getByRole('button', { name: '导出' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注销账号' })).toBeInTheDocument();
  });
});

describe('导出失败', () => {
  async function openExport() {
    renderInApp(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: '账号与数据' }));
    return screen.getByRole('button', { name: '导出' });
  }

  it('网络错误时离开加载状态，并显示「导出失败，请稍后重试」', async () => {
    let fail: (error: Error) => void = () => {};
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/users/me/export')) {
        return new Promise((_resolve, reject) => { fail = reject; });
      }
      return jsonResponse({ success: true, data: {} });
    });
    const button = await openExport();
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveClass('ant-btn-loading'));
    fail(new TypeError('Failed to fetch'));
    await waitFor(() => expect(button).not.toHaveClass('ant-btn-loading'));
    expect(button).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('导出失败，请稍后重试');
  });

  it('接口一直不返回时，超时后离开加载状态并显示同一句失败提示', async () => {
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/users/me/export')) {
        return new Promise((_resolve, reject) => {
          const abort = () => reject(new DOMException('aborted', 'AbortError'));
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort, { once: true });
        });
      }
      return jsonResponse({ success: true, data: {} });
    });
    const button = await openExport();
    jest.useFakeTimers();
    try {
      fireEvent.click(button);
      expect(button).toHaveClass('ant-btn-loading');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(DATA_EXPORT_TIMEOUT_MS);
      });
      expect(button).not.toHaveClass('ant-btn-loading');
      expect(button).toBeEnabled();
      expect(screen.getByRole('alert')).toHaveTextContent('导出失败，请稍后重试');
    } finally {
      jest.useRealTimers();
    }
  });
});
