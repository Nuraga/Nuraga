import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "./branch-access.types";

// Parent-portal counterpart to BranchScopeService — a parent session has no
// branch grants at all, it's scoped to exactly one family via Parent.userId
// (see UserContextService.loadById). Kept as a separate service rather than
// folded into BranchScopeService since the two auth models don't overlap.
@Injectable()
export class ParentAccessService {
  /** Throws unless the caller is an authenticated parent; returns their family id. */
  assertFamilyId(user: AuthenticatedUser): string {
    if (!user.parentProfile) {
      throw new ForbiddenException("This endpoint is only available to parent accounts");
    }
    return user.parentProfile.familyId;
  }
}
