import { Module } from "@nestjs/common";
import { NetworkAnalyticsController } from "./network-analytics.controller";
import { NetworkAnalyticsService } from "./network-analytics.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [NetworkAnalyticsController],
  providers: [NetworkAnalyticsService],
})
export class NetworkAnalyticsModule {}
