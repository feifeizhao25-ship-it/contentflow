/**
 * 部署配置：国内版 api 容器必须把短信、实名开关的环境变量接进去，
 * 示例文件里只能有占位、不能有真实值，也不能把开发用的固定验证码实现写成默认。
 */
import * as fs from 'fs';
import * as path from 'path';

const RUNTIME = path.join(__dirname, '../../../../..');
const read = (rel: string) => fs.readFileSync(path.join(RUNTIME, rel), 'utf8');

const SMS_ENV = [
  'SMS_PROVIDER',
  'SMS_CODE_HMAC_SECRET',
  'ALIYUN_SMS_ACCESS_KEY_ID',
  'ALIYUN_SMS_ACCESS_KEY_SECRET',
  'ALIYUN_SMS_SIGN_NAME',
  'ALIYUN_SMS_TEMPLATE_CODE',
  'REAL_NAME_REQUIRED_FOR_PUBLISH',
];

describe('短信与实名配置接入部署文件', () => {
  const compose = read('docker-compose.production.yml');
  const cnBlock = compose.slice(compose.indexOf('  api-cn:'), compose.indexOf('  web-cn:'));

  it.each(SMS_ENV)('docker-compose.production.yml 的 api-cn 传入 %s', (name) => {
    expect(cnBlock).toMatch(new RegExp(`^\\s+${name}:`, 'm'));
  });

  it('不配时是空值（短信服务未配置），不是 dev', () => {
    expect(cnBlock).not.toMatch(/SMS_PROVIDER:\s*["']?dev/i);
    expect(cnBlock).toMatch(/SMS_PROVIDER:\s*\$\{CN_SMS_PROVIDER:-\}/);
  });

  it.each([['.env.production.example'], ['api/.env.example']])('%s 列出这些变量，且都是占位', (file) => {
    const text = read(file);
    for (const name of SMS_ENV) {
      const key = file.startsWith('api/') ? name : `CN_${name}`;
      expect(text).toMatch(new RegExp(`^${key}=`, 'm'));
    }
    expect(text).not.toMatch(/^(CN_)?SMS_PROVIDER=dev/m);
    // 密钥类只能为空或明显的占位
    for (const secret of ['ALIYUN_SMS_ACCESS_KEY_ID', 'ALIYUN_SMS_ACCESS_KEY_SECRET']) {
      const m = text.match(new RegExp(`^(?:CN_)?${secret}=(.*)$`, 'm'));
      expect(m && (m[1] === '' || /replace|your/i.test(m[1]))).toBeTruthy();
    }
  });
});
