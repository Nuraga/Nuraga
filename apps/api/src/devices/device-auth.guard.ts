import { Injectable, CanActivate, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { TokenService } from "../auth/token.service";
import { DeviceAuthService } from "./device-auth.service";

// Parallel to JwtAuthGuard but verifies a device token (its own secret,
// its own `purpose` claim — see TokenService.signDeviceToken) and attaches
// request.device instead of request.user, so a device can never be accepted
// where @CurrentUser() is expected and vice versa.
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly deviceAuth: DeviceAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException("Missing device token");

    let payload;
    try {
      payload = await this.tokenService.verifyDeviceToken(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired device token");
    }

    await this.deviceAuth.assertActive(payload.deviceId, payload.branchId);

    request.device = { id: payload.deviceId, branchId: payload.branchId };
    return true;
  }

  private extractToken(request: { headers: Record<string, string | undefined> }): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length);
  }
}
