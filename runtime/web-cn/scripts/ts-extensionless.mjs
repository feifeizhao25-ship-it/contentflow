// 让 `node --experimental-strip-types` 能加载 src 下不带扩展名的相对导入（'./api-client'），
// 以及没有 exports 映射的 next/server。
// 只给测试脚本用：node --import ./scripts/ts-extensionless.mjs --experimental-strip-types <test>
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[cm]?[jt]sx?$|\\.json$/.test(specifier) && context.parentURL) {
    for (const ext of ['.ts', '.tsx']) {
      const url = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  try {
    return await next(specifier, context);
  } catch (error) {
    // next/server 等包没有 exports 映射，ESM 下要写成 next/server.js
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('next/') && !specifier.endsWith('.js')) {
      return next(specifier + '.js', context);
    }
    throw error;
  }
}
`));
