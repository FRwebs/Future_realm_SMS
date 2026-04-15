import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as { message?: string | string[] }).message ?? exception.message;

      response.status(status).json({
        ok: false,
        error: Array.isArray(message) ? message.join(", ") : message
      });
      return;
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      ok: false,
      error: exception instanceof Error ? exception.message : "Unexpected error"
    });
  }
}
