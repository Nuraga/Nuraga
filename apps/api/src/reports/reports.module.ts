import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { AuthModule } from "../auth/auth.module";
import { GroupsModule } from "../groups/groups.module";

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
