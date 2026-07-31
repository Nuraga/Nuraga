import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { DocumentTypesService } from "./document-types.service";
import { CreateDocumentTypeDto } from "./dto/create-document-type.dto";
import { UpdateDocumentTypeDto } from "./dto/update-document-type.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("document-types")
export class DocumentTypesController {
  constructor(private readonly documentTypes: DocumentTypesService) {}

  @Get()
  findAll() {
    return this.documentTypes.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentTypeDto) {
    return this.documentTypes.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateDocumentTypeDto,
  ) {
    return this.documentTypes.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.documentTypes.archive(user, id);
  }
}
