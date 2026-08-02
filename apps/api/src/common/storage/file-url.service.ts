import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

export interface FileTokenPayload {
  key: string;
  contentType: string;
  fileName: string;
}

const SIGNED_URL_TTL_SECONDS = 300;

// Short-TTL signed download links (NFR 10.3: files live in a private store,
// reachable only through a signed URL with a short TTL — never a public
// path). The token is self-contained so /files/:token needs no DB lookup.
@Injectable()
export class FileUrlService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async sign(payload: FileTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.secret(),
      expiresIn: `${SIGNED_URL_TTL_SECONDS}s`,
    });
  }

  async verify(token: string): Promise<FileTokenPayload> {
    return this.jwt.verifyAsync<FileTokenPayload>(token, { secret: this.secret() });
  }

  private secret(): string {
    return this.config.get<string>("FILE_URL_SECRET") ?? this.config.get<string>("JWT_ACCESS_SECRET")!;
  }
}
