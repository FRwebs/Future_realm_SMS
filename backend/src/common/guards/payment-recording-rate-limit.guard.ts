import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";

type FinanceRequest = Request & {
  user?: {
    userId?: string;
  };
  body?: {
    invoiceId?: string;
    amount?: number;
  };
};

const paymentWindowMs = 4000;
const recentPaymentAttempts = new Map<string, number>();

@Injectable()
export class PaymentRecordingRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FinanceRequest>();
    const actorKey = request.user?.userId ?? request.ip ?? "anonymous";
    const invoiceId = request.body?.invoiceId ?? "unknown";
    const amount = request.body?.amount ?? "0";
    const key = `${actorKey}:${invoiceId}:${amount}`;
    const now = Date.now();
    const lastSeen = recentPaymentAttempts.get(key);

    if (lastSeen && now - lastSeen < paymentWindowMs) {
      throw new HttpException("Please wait a moment before recording the same payment again.", HttpStatus.TOO_MANY_REQUESTS);
    }

    recentPaymentAttempts.set(key, now);

    for (const [entryKey, timestamp] of recentPaymentAttempts.entries()) {
      if (now - timestamp > paymentWindowMs) {
        recentPaymentAttempts.delete(entryKey);
      }
    }

    return true;
  }
}
