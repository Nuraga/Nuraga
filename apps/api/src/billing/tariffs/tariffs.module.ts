import { Module } from "@nestjs/common";
import { TariffsController } from "./tariffs.controller";
import { TariffsService } from "./tariffs.service";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [TariffsController],
  providers: [TariffsService],
  exports: [TariffsService],
})
export class TariffsModule {}
