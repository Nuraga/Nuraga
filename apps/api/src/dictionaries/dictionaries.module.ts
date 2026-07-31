import { Module } from "@nestjs/common";
import { GroupTypesController } from "./group-types.controller";
import { DischargeReasonsController } from "./discharge-reasons.controller";
import { DocumentTypesController } from "./document-types.controller";
import { GroupTypesService } from "./group-types.service";
import { DischargeReasonsService } from "./discharge-reasons.service";
import { DocumentTypesService } from "./document-types.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [GroupTypesController, DischargeReasonsController, DocumentTypesController],
  providers: [GroupTypesService, DischargeReasonsService, DocumentTypesService],
  exports: [GroupTypesService, DischargeReasonsService, DocumentTypesService],
})
export class DictionariesModule {}
