import { Module } from "@nestjs/common";

import { PaymentRecordingRateLimitGuard } from "../../common/guards/payment-recording-rate-limit.guard";
import { BursaryController } from "./bursary.controller";
import { FinanceController, FinanceWebhookController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  controllers: [FinanceController, FinanceWebhookController, BursaryController],
  providers: [FinanceService, PaymentRecordingRateLimitGuard]
})
export class FinanceModule {}
