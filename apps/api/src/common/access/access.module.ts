import { Global, Module } from "@nestjs/common";
import { BranchScopeService } from "./branch-scope.service";
import { RolesGuard } from "./roles.guard";
import { UserContextService } from "./user-context.service";

@Global()
@Module({
  providers: [BranchScopeService, RolesGuard, UserContextService],
  exports: [BranchScopeService, RolesGuard, UserContextService],
})
export class AccessModule {}
