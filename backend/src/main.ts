import "reflect-metadata";

import { createNestHttpApp } from "./bootstrap/create-app";

async function bootstrap() {
  const app = await createNestHttpApp();
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
}

bootstrap();
