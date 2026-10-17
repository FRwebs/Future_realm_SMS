import { Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { AccountService } from "./account.service";
import { CreditsService } from "./credits.service";
import { PaymentsService } from "./payments.service";
import { PlanService } from "./plan.service";
import { SubscriptionBillingController } from "./subscription-billing.controller";

@Module({
  imports: [RolesManagementModule],
  controllers: [SubscriptionBillingController],
  providers: [PlanService, CreditsService, AccountService, PaymentsService, PermissionsGuard]
})
export class SubscriptionBillingModule {}
