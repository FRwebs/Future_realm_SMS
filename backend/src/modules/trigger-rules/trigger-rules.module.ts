import { Module } from "@nestjs/common";

import { TriggerRulesController } from "./trigger-rules.controller";
import { TriggerRulesService } from "./trigger-rules.service";

@Module({ controllers: [TriggerRulesController], providers: [TriggerRulesService] })
export class TriggerRulesModule {}
