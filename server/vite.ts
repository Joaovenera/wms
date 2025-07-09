import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const viteLogger = createLogger();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: {
        port: 24678, // Use a different port for HMR
        server: server,
      },
    },
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Don't exit on error in development
        if (process.env.NODE_ENV === "production") {
          process.exit(1);
        }
      },
    },
    appType: "spa", // Explicitly set as SPA
    optimizeDeps: {
      exclude: ['@tanstack/react-query'], // Prevent bundling issues
    },
  });

  app.use(vite.middlewares);
  
  // Catch-all handler for SPA routing - serve index.html for all non-API routes
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip if this is an API route
    if (url.startsWith('/api/')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // Always reload the index.html file from disk
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      
      // Transform the HTML through Vite
      const page = await vite.transformIndexHtml(url, template);
      
      res.status(200).set({ 
        "Content-Type": "text/html",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files
  app.use(express.static(distPath));

  // Catch-all handler for SPA routing - serve index.html for all non-API routes
  app.use("*", (req, res) => {
    // Skip if this is an API route (should not happen due to middleware order, but safety check)
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(404).json({ message: 'API route not found' });
    }
    
    // Serve index.html for all other routes (SPA routing)
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}


