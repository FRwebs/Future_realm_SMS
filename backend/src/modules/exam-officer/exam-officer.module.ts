import { Module } from "@nestjs/common";

import { ExamOfficerController } from "./exam-officer.controller";
import { ExamOfficerService } from "./exam-officer.service";

@Module({
  controllers: [ExamOfficerController],
  providers: [ExamOfficerService],
})
export class ExamOfficerModule {}
