import { Controller, Get, Inject, Param, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { FileUrlService } from "./file-url.service";
import { OBJECT_STORAGE, type ObjectStorage } from "./object-storage.interface";

// Deliberately outside JwtAuthGuard: the signed, short-TTL token in the URL
// *is* the credential (NFR 10.3). Anyone without a valid token gets 401.
@Controller("files")
export class FilesController {
  constructor(
    private readonly fileUrls: FileUrlService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get(":token")
  async download(@Param("token") token: string, @Res() res: Response) {
    let payload;
    try {
      payload = await this.fileUrls.verify(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired file link");
    }

    const data = await this.storage.read(payload.key);
    res.setHeader("Content-Type", payload.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(payload.fileName)}"`,
    );
    res.send(data);
  }
}
