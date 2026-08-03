import { Module } from "@nestjs/common";
import { LeadsController } from "./leads.controller";
import { PublicLeadIntakeController } from "./public-lead-intake.controller";
import { LeadsService } from "./leads.service";
import { AuthModule } from "../../auth/auth.module";
import { GroupsModule } from "../../groups/groups.module";

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [LeadsController, PublicLeadIntakeController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
