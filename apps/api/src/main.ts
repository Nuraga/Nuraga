import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.use(helmet());

  // CORS_ORIGIN unset (local dev, Vite proxy) => allow any origin, matching
  // prior behavior. In production set it to the exact web origin(s) so the
  // API isn't callable cross-origin from arbitrary sites.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    corsOrigin ? { origin: corsOrigin.split(",").map((o) => o.trim()) } : undefined,
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
