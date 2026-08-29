import { Module } from "@nestjs/common";

import { WebAddressRegistryController } from "./web-address-registry.controller";
import { WebAddressRegistryService } from "./web-address-registry.service";

@Module({
  controllers: [WebAddressRegistryController],
  providers: [WebAddressRegistryService]
})
export class WebAddressRegistryModule {}
