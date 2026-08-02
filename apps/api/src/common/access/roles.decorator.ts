import { SetMetadata } from "@nestjs/common";
import type { Role } from "@prisma/client";

export const ROLES_KEY = "roles";

/** Endpoint requires the caller to hold at least one of these roles, in any branch. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
