import { Module } from "@nestjs/common";
import { ChildrenController } from "./children.controller";
import { ChildrenService } from "./children.service";
import { ChildAccessService } from "./child-access.service";
import { ChildMedicalService } from "./child-medical.service";
import { DocumentsService } from "./documents.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ChildrenController],
  providers: [ChildrenService, ChildAccessService, ChildMedicalService, DocumentsService],
  exports: [ChildrenService, ChildAccessService, ChildMedicalService, DocumentsService],
})
export class ChildrenModule {}
