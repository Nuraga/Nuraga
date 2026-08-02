import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedDevice } from "./device.types";

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedDevice => {
    const request = ctx.switchToHttp().getRequest();
    return request.device;
  },
);
