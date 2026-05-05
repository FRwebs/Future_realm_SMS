import "reflect-metadata";

import type { Request, Response } from "express";

import { createNestVercelServer } from "../backend/src/bootstrap/create-app";

let cachedServer: Awaited<ReturnType<typeof createNestVercelServer>> | null = null;

export default async function handler(req: Request, res: Response) {
  const server = cachedServer ?? (cachedServer = await createNestVercelServer());
  return server(req, res);
}
