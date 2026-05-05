import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import express, { Express } from "express";

import { env } from "../../../src/lib/utils/env";
import { AppModule } from "../app.module";
import { ApiExceptionFilter } from "../common/api-exception.filter";
import { enrichOpenApiDocument } from "../common/openapi-docs";

function buildAllowedOrigins() {
  const origins = new Set<string>([
    env.APP_URL,
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ]);

  const vercelPreviewUrl = process.env.VERCEL_URL?.trim();
  if (vercelPreviewUrl) {
    origins.add(`https://${vercelPreviewUrl.replace(/^https?:\/\//, "")}`);
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) {
    origins.add(`https://${vercelProductionUrl.replace(/^https?:\/\//, "")}`);
  }

  return Array.from(origins);
}

async function configureNestApp(app: INestApplication) {
  app.enableCors({
    origin: buildAllowedOrigins(),
    credentials: true,
  });
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("FutureRealm SMS API")
    .setDescription(
      [
        "Backend API for the FutureRealm multi-tenant School Management System.",
        "",
        "OpenAPI is generated from the Nest controllers and enriched with SMS-specific developer notes, response envelopes, auth requirements, filter/query usage, and practical Nigerian school examples.",
      ].join("\n"),
    )
    .setVersion("1.0.0")
    .addCookieAuth(
      "fr_session",
      {
        type: "apiKey",
        in: "cookie",
        name: "fr_session",
        description:
          "HTTP-only session cookie set by /api/v1/auth/login. Browser clients should send requests with credentials included.",
      },
      "fr_session",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  enrichOpenApiDocument(document);
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs-json",
  });
}

export async function createNestHttpApp() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  await configureNestApp(app);
  return app;
}

export async function createNestVercelServer(): Promise<Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    rawBody: true,
  });
  await configureNestApp(app);
  await app.init();
  return server;
}
