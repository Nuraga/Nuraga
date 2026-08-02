import { Module } from "@nestjs/common";
import { DiscountsController } from "./discounts.controller";
import { DiscountsService } from "./discounts.service";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [DiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
