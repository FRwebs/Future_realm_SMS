import { Module } from "@nestjs/common";

import { CurriculumExtrasController } from "./curriculum-extras.controller";
import { CurriculumExtrasService } from "./curriculum-extras.service";

@Module({
  controllers: [CurriculumExtrasController],
  providers: [CurriculumExtrasService]
})
export class CurriculumExtrasModule {}
