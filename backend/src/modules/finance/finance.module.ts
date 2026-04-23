import { Module } from "@nestjs/common";

import { FinanceController, FinanceWebhookController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  controllers: [FinanceController, FinanceWebhookController],
  providers: [FinanceService]
})
export class FinanceModule {}
