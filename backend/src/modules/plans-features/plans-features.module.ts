import { Module } from "@nestjs/common";

import { EntitlementsController, PlansFeaturesController } from "./plans-features.controller";
import { PlansFeaturesService, plansFeatures } from "./plans-features.service";

/** One instance, shared with the code that cannot be injected, so its scheduler runs once. */
@Module({ controllers: [PlansFeaturesController, EntitlementsController], providers: [{ provide: PlansFeaturesService, useValue: plansFeatures }], exports: [PlansFeaturesService] })
export class PlansFeaturesModule {}
