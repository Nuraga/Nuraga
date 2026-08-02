import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DeviceAuthService } from "./device-auth.service";
import { ProvisionDeviceDto } from "./dto/provision-device.dto";
import { PairDeviceDto } from "./dto/pair-device.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/devices")
export class DevicesController {
  constructor(private readonly deviceAuth: DeviceAuthService) {}

  @Post()
  provision(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: ProvisionDeviceDto,
  ) {
    return this.deviceAuth.provision(user, branchId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.deviceAuth.listForBranch(user, branchId);
  }

  @Post(":deviceId/revoke")
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("deviceId") deviceId: string,
  ) {
    return this.deviceAuth.revoke(user, branchId, deviceId);
  }
}

// Separate controller: pairing is performed by the kiosk itself, not an
// authenticated human — it must not sit behind JwtAuthGuard or the
// /branches/:branchId prefix (the kiosk doesn't have a branch-scoped human
// session to route through).
@Controller("devices")
export class DevicePairingController {
  constructor(private readonly deviceAuth: DeviceAuthService) {}

  @Post(":deviceId/pair")
  pair(@Param("deviceId") deviceId: string, @Body() dto: PairDeviceDto) {
    return this.deviceAuth.pair(deviceId, dto.secret);
  }
}
