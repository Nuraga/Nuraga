import { Module } from "@nestjs/common";
import { ShiftsController } from "./shifts.controller";
import { ShiftsService } from "./shifts.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
