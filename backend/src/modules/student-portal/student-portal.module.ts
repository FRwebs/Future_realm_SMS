import { Module } from "@nestjs/common";

import { StudentPortalController } from "./student-portal.controller";
import { StudentPortalService } from "./student-portal.service";
import { StudentCalendarFeedController, StudentWorkspaceController } from "./student-workspace.controller";
import { StudentWorkspaceService } from "./student-workspace.service";

@Module({
  controllers: [StudentPortalController, StudentWorkspaceController, StudentCalendarFeedController],
  providers: [StudentPortalService, StudentWorkspaceService]
})
export class StudentPortalModule {}
