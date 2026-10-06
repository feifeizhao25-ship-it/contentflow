import { BadRequestException, ForbiddenException, HttpException, HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common';
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

  describe('国内版：任何情况下都不把英文原始报错交给界面', () => {
    const run = (exception: unknown) => {
      process.env.MARKET_REGION = 'cn';
      const json = jest.fn();
      new HttpExceptionFilter().catch(exception, hostFor(json, jest.fn()));
      return json.mock.calls[0][0].error;
    };
    const hasCjk = (v: unknown) => /[\u3400-\u9fff]/.test(JSON.stringify(v));

    it('校验管道的英文数组（"email must be an email"）换成中文提示', () => {
      const err = run(new BadRequestException(['email must be an email', 'password must be longer than or equal to 6 characters']));
      expect(hasCjk(err.message)).toBe(true);
      expect(JSON.stringify(err.message)).not.toMatch(/must be|email/);
    });

    it('DTO 里写了中文的校验消息保留，英文的丢掉', () => {
      const err = run(new BadRequestException(['请输入有效的邮箱地址', 'property x should not exist']));
      expect(err.message).toEqual(['请输入有效的邮箱地址']);
    });

    it.each([
      [new UnauthorizedException(), /登录/],
      [new ForbiddenException(), /权限|无权/],
      [new NotFoundException('Cannot GET /api/v1/nope'), /不存在/],
      [new HttpException('ThrottlerException: Too Many Requests', 429), /频繁/],
      [new BadRequestException('Bad Request'), /请求/],
    ])('框架自带的英文 %#：换成对应的中文', (exception, pattern) => {
      const err = run(exception);
      expect(String(err.message)).toMatch(pattern);
      expect(String(err.message)).not.toMatch(/[A-Za-z]{4,}/);
    });

    it('未预期的内部错误（生产环境的 Internal server error）也是中文', () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const err = run(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
        expect(hasCjk(err.message)).toBe(true);
        expect(JSON.stringify(err)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|Internal/);
      } finally {
        process.env.NODE_ENV = previous;
      }
    });

    it('开发环境的内部错误同样不给英文原文（异常细节只进日志）', () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        const err = run(new Error('Cannot read properties of undefined'));
        expect(hasCjk(err.message)).toBe(true);
        expect(JSON.stringify(err)).not.toMatch(/Cannot read/);
      } finally {
        process.env.NODE_ENV = previous;
      }
    });
  });
});

describe('国内版：校验消息去重', () => {
  const previousRegion = process.env.MARKET_REGION;
  afterEach(() => { process.env.MARKET_REGION = previousRegion; });

  it('同一字段两个校验都失败时，同一句中文只返回一次', () => {
    process.env.MARKET_REGION = 'cn';
    const json = jest.fn();
    const status = jest.fn();
    new HttpExceptionFilter().catch(
      new BadRequestException(['请先阅读并同意用户协议和隐私政策', '请先阅读并同意用户协议和隐私政策', 'agreedToTerms must be a boolean value']),
      hostFor(json, status),
    );
    expect(json.mock.calls[0][0].error.message).toEqual(['请先阅读并同意用户协议和隐私政策']);
  });

  it('不同的中文消息都保留', () => {
    process.env.MARKET_REGION = 'cn';
    const json = jest.fn();
    new HttpExceptionFilter().catch(new BadRequestException(['请输入邮箱', '密码至少 8 位', '请输入邮箱']), hostFor(json, jest.fn()));
    expect(json.mock.calls[0][0].error.message).toEqual(['请输入邮箱', '密码至少 8 位']);
  });
});
