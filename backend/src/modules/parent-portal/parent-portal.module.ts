import { Module } from "@nestjs/common";

import { FamilyInboxService } from "./family-inbox.service";
import { ParentPortalController } from "./parent-portal.controller";
import { ParentPortalService } from "./parent-portal.service";
import { ParentPrivacyService } from "./parent-privacy.service";
import { ParentCalendarFeedController, ParentWorkspaceController } from "./parent-workspace.controller";
import { ParentWorkspaceService } from "./parent-workspace.service";

@Module({
  controllers: [ParentPortalController, ParentWorkspaceController, ParentCalendarFeedController],
  providers: [ParentPortalService, FamilyInboxService, ParentWorkspaceService, ParentPrivacyService]
})
export class ParentPortalModule {}
