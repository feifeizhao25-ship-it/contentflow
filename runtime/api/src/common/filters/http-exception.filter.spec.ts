import { BadRequestException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function hostFor(json: jest.Mock, status: jest.Mock) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: (code: number) => ({ json: (body: unknown) => { status(code); json(body); } }) }),
      getRequest: () => ({ method: 'POST', url: '/api/v1/test' }),
    }),
  } as any;
}

describe('HttpExceptionFilter language isolation', () => {
  const previousRegion = process.env.MARKET_REGION;

  afterEach(() => {
    process.env.MARKET_REGION = previousRegion;
  });

  it('never exposes CJK exception text in the global API', () => {
    process.env.MARKET_REGION = 'global';
    const json = jest.fn();
    const status = jest.fn();
    new HttpExceptionFilter().catch(new BadRequestException('请先登录'), hostFor(json, status));
    const body = json.mock.calls[0][0];
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(JSON.stringify(body)).not.toMatch(/[\u3400-\u9fff]/);
    expect(body.error.message).toBe('The request could not be processed');
  });

  it('uses an English authentication fallback for the global API', () => {
    process.env.MARKET_REGION = 'global';
    const json = jest.fn();
    const status = jest.fn();
    new HttpExceptionFilter().catch(new UnauthorizedException('邮箱或密码错误'), hostFor(json, status));
    expect(json.mock.calls[0][0].error.message).toContain('Authentication');
  });

  it('preserves Chinese responses for the CN API', () => {
    process.env.MARKET_REGION = 'cn';
    const json = jest.fn();
    const status = jest.fn();
    new HttpExceptionFilter().catch(new BadRequestException('请先登录'), hostFor(json, status));
    expect(json.mock.calls[0][0].error.message).toBe('请先登录');
  });
});
