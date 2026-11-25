import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { classifyPublicError, fallbackMessage } from '../error-catalog';

const CJK = /[\u3400-\u9fff]/;
const containsCjk = (value: unknown): boolean =>
  CJK.test(typeof value === 'string' ? value : JSON.stringify(value ?? ''));

/**
 * 已经是本市场语言的句子原样保留（同一句只留一次）。
 * 一条都没有时，用错误码对照表里的那一句，不再把没登录、没配置、合规拦截和服务故障说成同一句。
 */
function visibleMessage(message: string | string[], status: number, code: string | undefined, english: boolean): string | string[] {
  const items = (Array.isArray(message) ? message : [message]).filter((item): item is string => typeof item === 'string');
  const kept = [...new Set(items.filter((item) => (english ? item.trim().length > 0 && !containsCjk(item) : containsCjk(item))))];
  if (kept.length) return Array.isArray(message) ? kept : kept[0];
  return fallbackMessage(classifyPublicError(status, code, items.join('\n')), english);
}

const COMPLIANCE_LEVELS = new Set(['violation', 'risk', 'clear']);

/**
 * 只转发合规检查已经写好的字段，避免把异常对象里的其它内容带给浏览器。
 * 国内版只收中文字段；国际版只收不含中文的字段（国际规则集的英文说明）。
 */
function compliancePayload(resp: Record<string, any>, english = false) {
  const marketText = (value: unknown): value is string => typeof value === 'string' && (english ? !containsCjk(value) : containsCjk(value));
  const disclaimer = marketText(resp.disclaimer) ? resp.disclaimer : undefined;
  const level = COMPLIANCE_LEVELS.has(resp.level) ? String(resp.level) : undefined;
  const hits = Array.isArray(resp.hits)
    ? resp.hits.slice(0, 20).flatMap((hit) => {
        if (!hit || typeof hit !== 'object') return [];
        const reason = marketText(hit.reason) ? hit.reason : '';
        if (!reason) return [];
        const severity = hit.severity === 'block' || hit.severity === 'review' ? hit.severity : 'review';
        const ruleId = typeof hit.ruleId === 'string' && /^[A-Z0-9-]{3,40}$/.test(hit.ruleId) ? hit.ruleId : '';
        // 命中的原文片段（让用户知道改哪里）；只取短字符串，最多 5 个。
        const matchedTerms = Array.isArray(hit.matchedTerms)
          ? hit.matchedTerms.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0 && t.length <= (english ? 60 : 30)).slice(0, 5)
          : [];
        return [{ ruleId, severity, reason, ...(matchedTerms.length ? { matchedTerms } : {}) }];
      })
    : [];
  if (!disclaimer && !level && !hits.length) return undefined;
  // 国际版：中文字段被丢掉后只剩 level 时不单独返回，免得界面显示一个没有说明的等级。
  if (english && !disclaimer && !hits.length) return undefined;
  return { ...(disclaimer ? { disclaimer } : {}), ...(level ? { level } : {}), ...(hits.length ? { hits } : {}) };
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
    let stage: 'brief' | 'draft' | undefined;
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
        compliance = compliancePayload(resp, process.env.MARKET_REGION === 'global');
        if (resp.stage === 'brief' || resp.stage === 'draft') stage = resp.stage;
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
    message = visibleMessage(message, status, codeOverride, globalMarket);
    if (globalMarket && containsCjk(details)) details = undefined;
    if (globalMarket && compliance && containsCjk(compliance)) compliance = undefined;
    if (!globalMarket && details !== undefined && !containsCjk(details)) details = undefined;
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
        ...(stage ? { stage } : {}),
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }
}
