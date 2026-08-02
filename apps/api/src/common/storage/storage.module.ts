import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { FilesController } from "./files.controller";
import { FileUrlService } from "./file-url.service";
import { LocalDiskObjectStorage } from "./local-disk-object-storage.service";
import { OBJECT_STORAGE } from "./object-storage.interface";

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [FilesController],
  providers: [
    FileUrlService,
    { provide: OBJECT_STORAGE, useClass: LocalDiskObjectStorage },
  ],
  exports: [FileUrlService, OBJECT_STORAGE],
})
export class StorageModule {}
