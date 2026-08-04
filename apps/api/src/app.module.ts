import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AccessModule } from "./common/access/access.module";
import { AuditModule } from "./common/audit/audit.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { StorageModule } from "./common/storage/storage.module";
import { ExportModule } from "./common/export/export.module";
import { RolesGuard } from "./common/access/roles.guard";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { BranchesModule } from "./branches/branches.module";
import { GroupsModule } from "./groups/groups.module";
import { StaffModule } from "./staff/staff.module";
import { DictionariesModule } from "./dictionaries/dictionaries.module";
import { ImportModule } from "./import/import.module";
import { ReportsModule } from "./reports/reports.module";
import { TariffsModule } from "./billing/tariffs/tariffs.module";
import { ServicesModule } from "./billing/services/services.module";
import { DiscountsModule } from "./billing/discounts/discounts.module";
import { ContractsModule } from "./billing/contracts/contracts.module";
import { InvoicingModule } from "./billing/invoicing/invoicing.module";
import { PaymentsModule } from "./billing/payments/payments.module";
import { FamiliesModule } from "./families/families.module";
import { ChildrenModule } from "./children/children.module";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { LeadsModule } from "./sales/leads/leads.module";
import { TasksModule } from "./sales/tasks/tasks.module";
import { ParentPortalModule } from "./parent-portal/parent-portal.module";
import { DevicesModule } from "./devices/devices.module";
import { StaffAttendanceModule } from "./staff-attendance/staff-attendance.module";
import { MenuModule } from "./menu/menu.module";
import { PhotosModule } from "./photos/photos.module";
import { NetworkAnalyticsModule } from "./analytics/network-analytics.module";
import { ShiftsModule } from "./shifts/shifts.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccessModule,
    AuditModule,
    CryptoModule,
    StorageModule,
    ExportModule,
    HealthModule,
    AuthModule,
    BranchesModule,
    GroupsModule,
    StaffModule,
    DictionariesModule,
    ImportModule,
    ReportsModule,
    TariffsModule,
    ServicesModule,
    DiscountsModule,
    ContractsModule,
    InvoicingModule,
    PaymentsModule,
    FamiliesModule,
    ChildrenModule,
    EnrollmentModule,
    AttendanceModule,
    LeadsModule,
    TasksModule,
    ParentPortalModule,
    DevicesModule,
    StaffAttendanceModule,
    MenuModule,
    PhotosModule,
    NetworkAnalyticsModule,
    ShiftsModule,
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
