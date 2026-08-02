import { Module } from "@nestjs/common";
import { ImportController } from "./import.controller";
import { ChildrenImportService } from "./children-import.service";
import { LeadsImportService } from "./leads-import.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ImportController],
  providers: [ChildrenImportService, LeadsImportService],
  exports: [ChildrenImportService, LeadsImportService],
})
export class ImportModule {}
