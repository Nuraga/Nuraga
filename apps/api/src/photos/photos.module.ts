import { Module } from "@nestjs/common";
import { PhotosController } from "./photos.controller";
import { PhotosService } from "./photos.service";
import { PhotoAccessService } from "./photo-access.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [PhotosController],
  providers: [PhotosService, PhotoAccessService],
  exports: [PhotosService],
})
export class PhotosModule {}
