/**
 * 测试登录通道选哪一份实现。
 * 正式构建（NODE_ENV=production）只能指向 absent.ts，那里没有通道。
 * 开发（next dev）和测试（NODE_ENV=test）才指向 handler.ts。
 */
export function devLoginEntry(nodeEnv) {
  return nodeEnv === 'production' ? './src/dev-login/absent.ts' : './src/dev-login/handler.ts';
}
