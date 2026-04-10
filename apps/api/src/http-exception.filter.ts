import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException
} from "@nestjs/common";
import type { Response } from "express";

function isContractBody(
  value: string | Record<string, unknown>
): value is { code: string; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value["code"] === "string" &&
    typeof value["message"] === "string"
  );
}

@Catch(HttpException)
export class ContractHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse() as string | Record<string, unknown>;

    if (isContractBody(body)) {
      response.status(status).json(body);
      return;
    }

    const message =
      typeof body === "string"
        ? body
        : Array.isArray((body as { message?: unknown }).message)
          ? String((body as { message: unknown[] }).message[0])
          : String((body as { message?: unknown }).message ?? exception.message);

    response.status(status).json({
      code: `HTTP_${status}`,
      message
    });
  }
}
