import { Global, Module } from "@nestjs/common";
import { BranchScopeService } from "./branch-scope.service";
import { RolesGuard } from "./roles.guard";
import { UserContextService } from "./user-context.service";
import { TeacherScopeService } from "./teacher-scope.service";
import { ParentAccessService } from "./parent-access.service";

@Global()
@Module({
  providers: [BranchScopeService, RolesGuard, UserContextService, TeacherScopeService, ParentAccessService],
  exports: [BranchScopeService, RolesGuard, UserContextService, TeacherScopeService, ParentAccessService],
})
export class AccessModule {}
