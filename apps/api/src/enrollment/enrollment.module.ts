import { Module } from "@nestjs/common";
import { EnrollmentController } from "./enrollment.controller";
import { WaitlistController } from "./waitlist.controller";
import { EnrollmentService } from "./enrollment.service";
import { WaitlistService } from "./waitlist.service";
import { PromotionService } from "./promotion.service";
import { AuthModule } from "../auth/auth.module";
import { ChildrenModule } from "../children/children.module";
import { GroupsModule } from "../groups/groups.module";

@Module({
  imports: [AuthModule, ChildrenModule, GroupsModule],
  controllers: [EnrollmentController, WaitlistController],
  providers: [EnrollmentService, WaitlistService, PromotionService],
  exports: [EnrollmentService, WaitlistService, PromotionService],
})
export class EnrollmentModule {}
