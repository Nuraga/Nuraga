import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ChildrenService } from "./children.service";
import { ChildMedicalService } from "./child-medical.service";
import { DocumentsService } from "./documents.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";
import { UpsertChildMedicalDto } from "./dto/upsert-child-medical.dto";
import { SetChildAllergensDto } from "./dto/set-child-allergens.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class ChildrenController {
  constructor(
    private readonly children: ChildrenService,
    private readonly medical: ChildMedicalService,
    private readonly documents: DocumentsService,
  ) {}

  @Post("families/:familyId/children")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("familyId") familyId: string,
    @Body() dto: CreateChildDto,
  ) {
    return this.children.create(user, branchId, familyId, dto);
  }

  @Get("children")
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("familyId") familyId?: string,
    @Query("groupId") groupId?: string,
    @Query("status") status?: string,
  ) {
    return this.children.findAllForBranch(user, branchId, { familyId, groupId, status });
  }

  @Get("documents/expiring")
  listExpiringDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("days") days?: string,
  ) {
    return this.documents.listExpiring(user, branchId, days ? Number(days) : undefined);
  }

  @Get("children/:id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.children.findOne(user, branchId, id);
  }

  @Patch("children/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.children.update(user, branchId, id, dto);
  }

  @Get("children/:id/history")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.children.history(user, branchId, id);
  }

  @Get("children/:id/medical")
  getMedical(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.medical.getForUser(user, branchId, id);
  }

  @Put("children/:id/medical")
  upsertMedical(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpsertChildMedicalDto,
  ) {
    return this.medical.upsert(user, branchId, id, dto);
  }

  @Put("children/:id/allergens")
  setAllergens(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: SetChildAllergensDto,
  ) {
    return this.medical.setAllergens(user, branchId, id, dto.allergenIds);
  }

  @Get("children/:id/documents")
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.documents.list(user, branchId, id);
  }

  @Post("children/:id/documents")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documents.upload(user, branchId, id, dto, file);
  }

  @Delete("children/:id/documents/:documentId")
  removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documents.remove(user, branchId, id, documentId);
  }
}
