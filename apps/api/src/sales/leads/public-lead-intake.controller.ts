import { Body, Controller, Ip, Post } from "@nestjs/common";
import { LeadsService } from "./leads.service";
import { SiteLeadIntakeDto } from "./dto/site-lead-intake.dto";

// No @UseGuards here on purpose — this is the one intentionally
// unauthenticated write path in the API (ТЗ §3.1 "приём заявок с сайта"):
// a prospective parent submitting the kindergarten's public website
// contact form. See LeadsService.siteIntake for the auto-assignment and
// duplicate-flagging it does in place of the normal branch-role check.
//
// No rate-limiting/CAPTCHA is wired up here — this codebase has no such
// infra anywhere yet. A real public deployment of this endpoint would
// need abuse protection at the edge (reverse proxy / API gateway) before
// going live; flagging this rather than silently shipping it unprotected.
@Controller("public/leads")
export class PublicLeadIntakeController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  intake(@Body() dto: SiteLeadIntakeDto, @Ip() ip: string) {
    return this.leads.siteIntake(dto, ip);
  }
}
