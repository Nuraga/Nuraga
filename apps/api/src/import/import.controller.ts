import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ChildrenImportService } from "./children-import.service";
import { LeadsImportService } from "./leads-import.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/import")
export class ImportController {
  constructor(
    private readonly childrenImport: ChildrenImportService,
    private readonly leadsImport: LeadsImportService,
  ) {}

  @Post("children")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  importChildren(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query("dryRun") dryRun?: string,
  ) {
    if (!file) throw new BadRequestException("A CSV file is required");
    return this.childrenImport.import(user, branchId, file, dryRun === "true");
  }

  @Post("leads")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  importLeads(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query("dryRun") dryRun?: string,
  ) {
    if (!file) throw new BadRequestException("A CSV file is required");
    return this.leadsImport.import(user, branchId, file, dryRun === "true");
  }
}
