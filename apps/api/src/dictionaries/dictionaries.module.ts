import { Module } from "@nestjs/common";
import { GroupTypesController } from "./group-types.controller";
import { DischargeReasonsController } from "./discharge-reasons.controller";
import { DocumentTypesController } from "./document-types.controller";
import { LeadSourcesController } from "./lead-sources.controller";
import { LeadRejectionReasonsController } from "./lead-rejection-reasons.controller";
import { GroupTypesService } from "./group-types.service";
import { DischargeReasonsService } from "./discharge-reasons.service";
import { DocumentTypesService } from "./document-types.service";
import { LeadSourcesService } from "./lead-sources.service";
import { LeadRejectionReasonsService } from "./lead-rejection-reasons.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [
    GroupTypesController,
    DischargeReasonsController,
    DocumentTypesController,
    LeadSourcesController,
    LeadRejectionReasonsController,
  ],
  providers: [
    GroupTypesService,
    DischargeReasonsService,
    DocumentTypesService,
    LeadSourcesService,
    LeadRejectionReasonsService,
  ],
  exports: [
    GroupTypesService,
    DischargeReasonsService,
    DocumentTypesService,
    LeadSourcesService,
    LeadRejectionReasonsService,
  ],
})
export class DictionariesModule {}
