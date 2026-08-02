import { Module } from "@nestjs/common";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";
import { GroupCapacityService } from "./group-capacity.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupCapacityService],
  exports: [GroupsService, GroupCapacityService],
})
export class GroupsModule {}
