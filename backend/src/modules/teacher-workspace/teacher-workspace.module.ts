import { Global, Module } from "@nestjs/common";

import { PermissionsGuard } from "../../auth/permissions.guard";
import { RolesManagementModule } from "../roles-management/roles-management.module";
import { StudentRecordsModule } from "../student-records/student-records.module";
import { StaffAccessModule } from "../staff-access/staff-access.module";
import { AttendanceManagementModule } from "../attendance-management/attendance-management.module";

import { TeacherCalendarService } from "./calendar.service";
import { MyDayService } from "./day.service";
import { PeriodRegistersService } from "./period-registers.service";
import { RegisterHistoryService } from "./register-history.service";
import { TeacherRemarksService } from "./remarks.service";
import { TeacherScoresService } from "./scores.service";
import { TeacherStudentsService } from "./students.service";
import { TeacherConcernsService } from "./concerns.service";
import { TeacherFamiliesService } from "./families.service";
import { TeacherObservationsService } from "./observations.service";
import { LearningManageController, LearningPublicController } from "./learning.controller";
import { LearningService } from "./learning.service";
import { TeacherEmploymentService } from "./employment.service";
import { TeacherNotesService } from "./lesson-notes/notes.service";
import { TeacherSchemeService } from "./lesson-notes/scheme.service";
import { TeacherMessagesService } from "./messages.service";
import { TeacherQuestionsService } from "./questions.service";
import { TeacherTimetableService } from "./timetable.service";
import { TeacherWorkspaceController } from "./teacher-workspace.controller";
import { TeacherWorkspaceService } from "./workspace.service";

@Global()
@Module({
  imports: [AttendanceManagementModule, StaffAccessModule, RolesManagementModule, StudentRecordsModule],
  controllers: [TeacherWorkspaceController, LearningManageController, LearningPublicController],
  providers: [TeacherWorkspaceService, MyDayService, TeacherTimetableService, TeacherQuestionsService, TeacherCalendarService, PeriodRegistersService, RegisterHistoryService, TeacherScoresService, TeacherRemarksService, TeacherStudentsService, TeacherConcernsService, TeacherFamiliesService, TeacherMessagesService, TeacherSchemeService, TeacherNotesService, TeacherEmploymentService, LearningService, PermissionsGuard, TeacherObservationsService],
  exports: [TeacherWorkspaceService, MyDayService, TeacherTimetableService, TeacherQuestionsService, TeacherCalendarService, PeriodRegistersService, RegisterHistoryService, TeacherScoresService, TeacherRemarksService, TeacherStudentsService, TeacherConcernsService, TeacherFamiliesService, TeacherSchemeService, TeacherNotesService]
})
export class TeacherWorkspaceModule {}
