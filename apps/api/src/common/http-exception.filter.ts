import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const resp =
      typeof rawResponse === "object" && rawResponse !== null
        ? (rawResponse as Record<string, unknown>)
        : {};
    const message =
      (resp.message as string | string[] | undefined) ??
      (exception instanceof HttpException ? exception.message : "Internal server error");

    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      message: Array.isArray(message) ? message : [message as string],
      error: exception instanceof HttpException ? exception.name : "Error",
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    // Pass through duplicate warning fields for conflict dialogs (e.g. customer create)
    if (resp.duplicateWarning !== undefined) errorResponse.duplicateWarning = resp.duplicateWarning;
    if (resp.matches !== undefined) errorResponse.matches = resp.matches;
    if (resp.code !== undefined) errorResponse.code = resp.code;

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(errorResponse);
  }
}
