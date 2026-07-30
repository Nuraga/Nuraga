import { Global, Module } from "@nestjs/common";
import { BranchScopeService } from "./branch-scope.service";
import { RolesGuard } from "./roles.guard";
import { UserContextService } from "./user-context.service";
import { TeacherScopeService } from "./teacher-scope.service";

@Global()
@Module({
  providers: [BranchScopeService, RolesGuard, UserContextService, TeacherScopeService],
  exports: [BranchScopeService, RolesGuard, UserContextService, TeacherScopeService],
})
export class AccessModule {}
