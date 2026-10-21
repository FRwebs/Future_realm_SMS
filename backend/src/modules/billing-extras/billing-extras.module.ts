import { Module } from "@nestjs/common";

import { BillingExtrasController } from "./billing-extras.controller";
import { BillingExtrasService, billingExtras } from "./billing-extras.service";

@Module({ controllers: [BillingExtrasController], providers: [{ provide: BillingExtrasService, useValue: billingExtras }] })
export class BillingExtrasModule {}
