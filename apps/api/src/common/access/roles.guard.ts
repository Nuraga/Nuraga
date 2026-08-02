import {
  Injectable,
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { ROLES_KEY } from "./roles.decorator";
import { BranchScopeService } from "./branch-scope.service";
import type { AuthenticatedUser } from "./branch-access.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly branchScope: BranchScopeService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    // @Roles(...) without a preceding @UseGuards(JwtAuthGuard) is a wiring
    // bug, not an authorization decision — fail closed rather than crash.
    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    if (!this.branchScope.hasAnyRole(user, requiredRoles)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
