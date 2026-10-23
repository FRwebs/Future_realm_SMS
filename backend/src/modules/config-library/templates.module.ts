import { Module } from "@nestjs/common";

import { LibraryService, library } from "./library.service";
import { TemplatesController } from "./templates.controller";
import { TemplatesService, templates } from "./templates.service";

@Module({ controllers: [TemplatesController], providers: [{ provide: TemplatesService, useValue: templates }, { provide: LibraryService, useValue: library }], exports: [TemplatesService, LibraryService] })
export class TemplatesModule {}
