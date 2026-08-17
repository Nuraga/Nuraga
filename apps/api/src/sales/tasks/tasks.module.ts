import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { TaskReportCleanupService } from "./task-report-cleanup.service";
import { AuthModule } from "../../auth/auth.module";
import { NotificationsModule } from "../../notifications/notifications.module";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, TaskReportCleanupService],
  exports: [TasksService],
})
export class TasksModule {}
