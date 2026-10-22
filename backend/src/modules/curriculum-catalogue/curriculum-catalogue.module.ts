import { Global, Module } from "@nestjs/common";

import { CurriculumCatalogueController, CurriculumCataloguePlatformController } from "./curriculum-catalogue.controller";
import { CurriculumCatalogueService } from "./curriculum-catalogue.service";

@Global()
@Module({ controllers: [CurriculumCatalogueController, CurriculumCataloguePlatformController], providers: [CurriculumCatalogueService], exports: [CurriculumCatalogueService] })
export class CurriculumCatalogueModule {}
