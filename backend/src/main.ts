import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";

import { env } from "../../src/lib/utils/env";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { enrichOpenApiDocument } from "./common/openapi-docs";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    cors: {
      origin: [env.APP_URL, "http://127.0.0.1:3000"],
      credentials: true
    }
  });

  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("FutureRealm SMS API")
    .setDescription(
      [
        "Backend API for the FutureRealm multi-tenant School Management System.",
        "",
        "OpenAPI is generated from the Nest controllers and enriched with SMS-specific developer notes, response envelopes, auth requirements, filter/query usage, and practical Nigerian school examples."
      ].join("\n")
    )
    .setVersion("1.0.0")
    .addCookieAuth(
      "fr_session",
      {
        type: "apiKey",
        in: "cookie",
        name: "fr_session",
        description:
          "HTTP-only session cookie set by /api/v1/auth/login. Browser clients should send requests with credentials included."
      },
      "fr_session"
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  enrichOpenApiDocument(document);
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs-json"
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
}

bootstrap();
