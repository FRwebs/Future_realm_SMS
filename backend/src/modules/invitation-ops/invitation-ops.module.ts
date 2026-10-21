import { Module } from "@nestjs/common";

import { InvitationOpsController } from "./invitation-ops.controller";
import { InvitationOpsService } from "./invitation-ops.service";

@Module({ controllers: [InvitationOpsController], providers: [InvitationOpsService] })
export class InvitationOpsModule {}
