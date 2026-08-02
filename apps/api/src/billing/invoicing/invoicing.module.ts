import { Module } from "@nestjs/common";
import { InvoicingController } from "./invoicing.controller";
import { InvoicingService } from "./invoicing.service";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [InvoicingController],
  providers: [InvoicingService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
