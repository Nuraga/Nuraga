import { Module } from "@nestjs/common";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
