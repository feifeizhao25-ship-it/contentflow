import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ERROR_CATALOG } from './error-catalog';

const CJK = /[\u3400-\u9fff]/;
const ENGLISH_SENTENCE = /[A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){2,}/;

function allowlist() {
  const text = readFileSync(join(__dirname, 'response-language-allow.txt'), 'utf8');
  const [tokenPart, hanPart] = text.split('# han-allowed');
  const tokens = tokenPart.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const han = (hanPart || '').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  return { tokens, han };
}

function withoutTokens(value: string, tokens: string[]): string {
  return tokens.reduce((text, token) => text.split(token).join(''), value);
}

function withoutHan(value: string, han: string[]): string {
  return han.reduce((text, token) => text.split(token).join(''), value);
}

function respond(exception: unknown, region: 'cn' | 'global') {
  const previous = process.env.MARKET_REGION;
  process.env.MARKET_REGION = region;
  const json = jest.fn();
  new HttpExceptionFilter().catch(exception as any, {
    switchToHttp: () => ({
      getResponse: () => ({ status: () => ({ json }) }),
      getRequest: () => ({ method: 'POST', url: '/api/v1/language-check' }),
    }),
  } as any);
  if (previous === undefined) delete process.env.MARKET_REGION;
  else process.env.MARKET_REGION = previous;
  return json.mock.calls[0][0];
}

describe('响应语言', () => {
  const { tokens, han } = allowlist();

  it('国内响应没有成句英文，国际响应没有白名单以外的汉字', () => {
    const samples = [
      new BadRequestException(['email must be an email', 'password must be longer than or equal to 8 characters']),
      new BadRequestException('Bad Request'),
      new UnauthorizedException(),
      new BadRequestException({ message: '内容未通过检查', code: 'CONTENT_COMPLIANCE_BLOCKED' }),
      new BadRequestException('请先登录'),
    ];
    for (const sample of samples) {
      const cn = respond(sample, 'cn');
      const cnText = withoutTokens(JSON.stringify(cn.error.message), tokens);
      expect(cnText).not.toMatch(ENGLISH_SENTENCE);
      expect(CJK.test(JSON.stringify(cn.error.message))).toBe(true);
      const global = respond(sample, 'global');
      expect(withoutHan(JSON.stringify(global), han)).not.toMatch(CJK);
    }
  });

  it('校验器的英文句子译成对应中文，而不是原句', () => {
    const body = respond(new BadRequestException(['email must be an email', 'name should not be empty']), 'cn');
    expect(body.error.message).toEqual(['请输入有效的邮箱地址', '这一项不能为空']);
  });

  it('对照表本身也满足这条语言规则', () => {
    for (const row of Object.values(ERROR_CATALOG)) {
      expect(withoutTokens(row.zh, tokens)).not.toMatch(ENGLISH_SENTENCE);
      expect(CJK.test(row.zh)).toBe(true);
      expect(withoutHan(row.en, han)).not.toMatch(CJK);
    }
  });
});
