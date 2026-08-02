import { Module } from "@nestjs/common";
import { DevicesController, DevicePairingController } from "./devices.controller";
import { DeviceAuthService } from "./device-auth.service";
import { DeviceAuthGuard } from "./device-auth.guard";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [DevicesController, DevicePairingController],
  providers: [DeviceAuthService, DeviceAuthGuard],
  exports: [DeviceAuthService, DeviceAuthGuard],
})
export class DevicesModule {}
