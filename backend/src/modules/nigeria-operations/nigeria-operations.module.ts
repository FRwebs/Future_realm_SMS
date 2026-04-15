import { Module } from "@nestjs/common";

import { NigeriaOperationsController } from "./nigeria-operations.controller";
import { NigeriaOperationsService } from "./nigeria-operations.service";

@Module({
  controllers: [NigeriaOperationsController],
  providers: [NigeriaOperationsService]
})
export class NigeriaOperationsModule {}
