import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
    const containsCjk = (value: unknown) => /[\u3400-\u9fff]/.test(
      typeof value === 'string' ? value : JSON.stringify(value ?? ''),
    );
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
    const sanitizedMessage = Array.isArray(message) ? message.join('; ') : message;
    const safeStack = exception instanceof Error && !(globalMarket && containsCjk(exception.stack))
      ? exception.stack
      : undefined;
    this.logger.error(`${request.method} ${request.url} - ${status}: ${sanitizedMessage}`, safeStack);

    const errorResponse = {
      success: false,
      error: {
        code: error?.replace(/\s+/g, '_').toUpperCase() || 'ERROR',
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorResponse);
  }
}
