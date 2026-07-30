import { Injectable, CanActivate, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { TokenService } from "../token.service";
import { UserContextService } from "../../common/access/user-context.service";

// Verifies the bearer access token and attaches the fully-loaded
// AuthenticatedUser (with branch grants) to the request. Every downstream
// guard/service reads access from req.user — no endpoint re-derives it.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userContext: UserContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException("Missing access token");

    let payload;
    try {
      payload = await this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    const user = await this.userContext.loadById(payload.sub);
    if (!user) throw new UnauthorizedException("User not found or inactive");

    request.user = user;
    return true;
  }

  private extractToken(request: { headers: Record<string, string | undefined> }): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length);
  }
}
