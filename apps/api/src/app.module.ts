import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AccessModule } from "./common/access/access.module";
import { AuditModule } from "./common/audit/audit.module";
import { RolesGuard } from "./common/access/roles.guard";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { BranchesModule } from "./branches/branches.module";
import { GroupsModule } from "./groups/groups.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccessModule,
    AuditModule,
    HealthModule,
    AuthModule,
    BranchesModule,
    GroupsModule,
  ],
  providers: [
    // RolesGuard is applied network-wide; routes without @Roles(...) pass
    // through untouched (see RolesGuard.canActivate). Per-route auth still
    // requires an explicit @UseGuards(JwtAuthGuard) since not every route
    // is protected (e.g. /auth/login itself).
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
