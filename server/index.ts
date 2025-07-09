import express from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";

import { setupVite, serveStatic, log } from "./vite";
import logger, { logInfo } from "./utils/logger";

const app = express();
const server = createServer(app);

// Basic security headers - compatible with Vite
const isDevelopment = process.env.NODE_ENV !== "production";

app.use(helmet({
  // Disable CSP in development to allow Vite to work
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:", "ws:"], // Add ws: for WebSocket
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  // Allow embedding in development
  frameguard: isDevelopment ? false : { action: 'sameorigin' },
  crossOriginEmbedderPolicy: false,
}));

// Basic CORS configuration - enhanced for WebSocket support
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow localhost and replit domains
    if (process.env.NODE_ENV !== "production") {
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('replit')) {
        return callback(null, true);
      }
    }
    
    // Allow configured frontend URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    // For development, allow any origin as fallback
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// Simple rate limiting - very lenient in development
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // Very lenient in development
  message: { message: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting only to API routes
app.use('/api', apiLimiter);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

// Enhanced compression with logging
app.use(compression({
  level: 6,
  threshold: 1000,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';
    
    logger.http(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent,
      ip
    });
  });
  
  next();
});

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

(async () => {
  // Register API routes BEFORE Vite middleware
  const { registerRoutes } = await import("./routes");
  await registerRoutes(app);

  if (isDevelopment) {
    log("Running in development mode");
    await setupVite(app, server);
  } else {
    log("Running in production mode");
    await serveStatic(app);
  }

  const PORT = Number(process.env.PORT) || 5001;
  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on port ${PORT}`);
    logInfo(`Server running on port ${PORT}`);
  });
})();
