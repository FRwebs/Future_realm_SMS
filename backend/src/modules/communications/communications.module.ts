import { Module } from "@nestjs/common";

import { CommunicationCenterController } from "./communication-center.controller";
import { CommunicationCenterService } from "./communication-center.service";
import { CommunicationsController } from "./communications.controller";
import { CommunicationsService } from "./communications.service";
import { FamilyDispatchService } from "./family-dispatch.service";

@Module({
  controllers: [CommunicationsController, CommunicationCenterController],
  providers: [CommunicationsService, CommunicationCenterService, FamilyDispatchService],
  exports: [CommunicationCenterService, FamilyDispatchService]
})
export class CommunicationsModule {}
