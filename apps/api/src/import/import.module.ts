import { Module } from "@nestjs/common";
import { ImportController } from "./import.controller";
import { ChildrenImportService } from "./children-import.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ImportController],
  providers: [ChildrenImportService],
  exports: [ChildrenImportService],
})
export class ImportModule {}
