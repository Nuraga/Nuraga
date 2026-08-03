import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { PhotosService } from "./photos.service";
import { UploadPhotoDto } from "./dto/upload-photo.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/photos")
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("groupId") groupId: string,
  ) {
    return this.photos.list(user, branchId, groupId);
  }

  @Get("consent-gaps")
  consentGaps(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("groupId") groupId: string,
  ) {
    return this.photos.consentGaps(user, branchId, groupId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: UploadPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.photos.upload(user, branchId, dto, file);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string, @Param("id") id: string) {
    return this.photos.remove(user, branchId, id);
  }
}
