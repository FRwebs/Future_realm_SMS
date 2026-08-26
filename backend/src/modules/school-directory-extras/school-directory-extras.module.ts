import { Module } from "@nestjs/common";

import { SchoolDirectoryExtrasController } from "./school-directory-extras.controller";
import { SchoolDirectoryExtrasService } from "./school-directory-extras.service";

@Module({
  controllers: [SchoolDirectoryExtrasController],
  providers: [SchoolDirectoryExtrasService]
})
export class SchoolDirectoryExtrasModule {}
