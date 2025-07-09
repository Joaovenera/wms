import { Express } from "express";

export async function registerRoutes(app: Express) {
  // Importar e registrar todas as rotas
  const { registerRoutes: registerApiRoutes } = await import("../routes.js");
  await registerApiRoutes(app);
} 