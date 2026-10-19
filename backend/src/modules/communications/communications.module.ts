import { Module } from "@nestjs/common";

import { CommunicationCenterController } from "./communication-center.controller";
import { CommunicationCenterService } from "./communication-center.service";
import { CommunicationsController } from "./communications.controller";
import { CommunicationsService } from "./communications.service";

@Module({
  controllers: [CommunicationsController, CommunicationCenterController],
  providers: [CommunicationsService, CommunicationCenterService],
  exports: [CommunicationCenterService]
})
export class CommunicationsModule {}
