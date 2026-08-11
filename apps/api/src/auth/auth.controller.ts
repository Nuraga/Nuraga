import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Verify2faDto } from "./dto/verify-2fa.dto";
import { Enable2faDto } from "./dto/enable-2fa.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.identifier, dto.password, req.ip);
  }

  @Post("2fa/verify")
  verify2fa(@Body() dto: Verify2faDto) {
    return this.auth.verifyMfa(dto.mfaToken, dto.code);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.oldPassword, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/setup")
  setup2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.setup2fa(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/enable")
  async enable2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: Enable2faDto) {
    await this.auth.enable2fa(user.id, dto.code);
    return { ok: true };
  }
}
