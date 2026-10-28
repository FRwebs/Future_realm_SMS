import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";

/** What a refused input says, in words: the field and what is wrong with it — not the validator's own report. */
export function sayWhatIsWrong(error: ZodError): string {
  const lines = error.issues.slice(0, 3).map((issue) => {
    const field = issue.path.length ? String(issue.path[issue.path.length - 1]) : "";
    return field ? `${field}: ${issue.message}` : issue.message;
  });
  return lines.join("; ") + (error.issues.length > 3 ? ` (and ${error.issues.length - 3} more)` : "");
}

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
      error: exception instanceof ZodError ? sayWhatIsWrong(exception) : exception instanceof Error ? exception.message : "Unexpected error"
    });
  }
}
