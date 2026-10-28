import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

/**
 * 手机端分开跑。
 * 安卓：Chromium + Pixel 7，以及较小的 Galaxy S8（360 宽）。
 * 苹果：WebKit。这台 Linux 没有 iOS 模拟器。
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'device-display.spec.ts',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: '/tmp/cf-playwright-devices',
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    screenshot: 'off',
    trace: 'off',
  },
  projects: [
    { name: 'android-pixel-7', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'android-galaxy-s24', use: { ...devices['Galaxy S24'], browserName: 'chromium' } },
    { name: 'android-galaxy-s8', use: { ...devices['Galaxy S8'], browserName: 'chromium' } },
    { name: 'ios-iphone-15-pro', use: { ...devices['iPhone 15 Pro'], browserName: 'webkit' } },
    { name: 'ios-iphone-se', use: { ...devices['iPhone SE'], browserName: 'webkit' } },
    { name: 'ios-ipad-pro-11', use: { ...devices['iPad Pro 11'], browserName: 'webkit' } },
  ],
});
