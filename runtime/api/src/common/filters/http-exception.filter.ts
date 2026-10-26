import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

const CJK = /[\u3400-\u9fff]/;
const containsCjk = (value: unknown): boolean =>
  CJK.test(typeof value === 'string' ? value : JSON.stringify(value ?? ''));

function genericChinese(status: number): string {
  if (status === HttpStatus.UNAUTHORIZED) return '请先登录，或登录已失效，请重新登录';
  if (status === HttpStatus.FORBIDDEN) return '当前账号无权执行该操作';
  if (status === HttpStatus.NOT_FOUND) return '请求的内容不存在';
  if (status === HttpStatus.CONFLICT) return '操作与已有数据冲突，请刷新后重试';
  if (status === HttpStatus.TOO_MANY_REQUESTS) return '操作太频繁，请稍后再试';
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return '服务暂时出错，请稍后重试';
  return '请求参数不正确，请检查后重试';
}

/**
 * 只保留含中文的消息；一条都没有就用该状态码对应的通用中文提示。
 * 同一句只留一次：一个字段挂两个校验（如 @IsBoolean + @Equals(true)）都失败时，
 * 原来把「请先阅读并同意用户协议和隐私政策」返回两遍，界面上用「；」连成一行重复显示。
 */
const COMPLIANCE_LEVELS = new Set(['violation', 'risk', 'clear']);

/** 只转发合规检查已经写好的中文字段，避免把异常对象里的其它内容带给浏览器。 */
function compliancePayload(resp: Record<string, any>) {
  const disclaimer = typeof resp.disclaimer === 'string' && containsCjk(resp.disclaimer) ? resp.disclaimer : undefined;
  const level = COMPLIANCE_LEVELS.has(resp.level) ? String(resp.level) : undefined;
  const hits = Array.isArray(resp.hits)
    ? resp.hits.slice(0, 20).flatMap((hit) => {
        if (!hit || typeof hit !== 'object') return [];
        const reason = typeof hit.reason === 'string' && containsCjk(hit.reason) ? hit.reason.slice(0, 200) : '';
        if (!reason) return [];
        const severity = hit.severity === 'block' || hit.severity === 'review' ? hit.severity : 'review';
        const ruleId = typeof hit.ruleId === 'string' && /^[A-Z0-9-]{3,40}$/.test(hit.ruleId) ? hit.ruleId : '';
        return [{ ruleId, severity, reason }];
      })
    : [];
  if (!disclaimer && !level && !hits.length) return undefined;
  return { ...(disclaimer ? { disclaimer } : {}), ...(level ? { level } : {}), ...(hits.length ? { hits } : {}) };
}

function chineseOnly(message: string | string[], status: number): string | string[] {
  if (Array.isArray(message)) {
    const kept = [...new Set(message.filter((item) => typeof item === 'string' && containsCjk(item)))];
    return kept.length ? kept : genericChinese(status);
  }
  return containsCjk(message) ? message : genericChinese(status);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error = 'Error';
    let details: any;
    let codeOverride: string | undefined;
    let compliance: ReturnType<typeof compliancePayload> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || exception.message;
        error = resp.error || 'Error';
        details = resp.details;
        if (typeof resp.code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(resp.code)) codeOverride = resp.code;
        compliance = compliancePayload(resp);
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      error = 'Internal Server Error';
      
      // 生产环境不暴露详细错误
      if (process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Unknown error';
      error = 'Internal Server Error';
    }

    const globalMarket = process.env.MARKET_REGION === 'global';
    if (globalMarket && containsCjk(message)) {
      message = status === HttpStatus.UNAUTHORIZED
        ? 'Authentication is required or the credentials are invalid'
        : status === HttpStatus.FORBIDDEN
          ? 'This operation is not permitted'
          : status === HttpStatus.NOT_FOUND
            ? 'The requested resource was not found'
            : status === HttpStatus.CONFLICT
              ? 'The request conflicts with existing data'
              : status >= HttpStatus.INTERNAL_SERVER_ERROR
                ? 'Internal server error'
                : 'The request could not be processed';
    }
    if (globalMarket && containsCjk(details)) details = undefined;
    if (globalMarket && compliance && containsCjk(compliance)) compliance = undefined;
    if (!globalMarket) {
      // 国内版：界面只允许中文。框架自带的英文（Unauthorized、Cannot GET /x、
      // "email must be an email"、Internal server error）一律换成对应的中文；
      // 业务代码写的中文原样保留。异常原文只进下面的日志，不进响应。
      message = chineseOnly(message, status);
      if (details !== undefined && !containsCjk(details)) details = undefined;
    }
    const sanitizedMessage = Array.isArray(message) ? message.join('; ') : message;
    const safeStack = exception instanceof Error && !(globalMarket && containsCjk(exception.stack))
      ? exception.stack
      : undefined;
    this.logger.error(`${request.method} ${request.url} - ${status}: ${sanitizedMessage}`, safeStack);

    const errorResponse = {
      success: false,
      error: {
        code: codeOverride || error?.replace(/\s+/g, '_').toUpperCase() || 'ERROR',
        message,
        details,
        ...(compliance ? { compliance } : {}),
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }
}
