import express from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync } from "fs";
import { join } from "path";
import logger from "./utils/logger.js";
import { initWebSocket } from "./services/websocket.service.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { connectPostgres, disconnectPostgres } from "./config/postgres.js";
import { autoMigrate } from "./scripts/auto-migrate.js";
import { setupCompleteDatabase } from "./scripts/setup-complete-database.js";
import { quickHealthCheck } from "./config/database-health.js";

const app = express();
const server = createServer(app);

// Configuração HTTPS
const httpsOptions = {
  key: readFileSync(join(process.cwd(), 'certs', 'key.pem')),
  cert: readFileSync(join(process.cwd(), 'certs', 'cert.pem'))
};

const httpsServer = createHttpsServer(httpsOptions, app);

const isDevelopment = process.env.NODE_ENV !== "production";

// Trust proxy (movido para o topo para melhor performance)
app.set('trust proxy', 1);

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Custom security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Enhanced compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Optimized CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (isDevelopment) {
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || 
          origin.includes('replit') || origin.includes('69.62.95.146')) {
        return callback(null, true);
      }
    }
    
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    if (isDevelopment) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // Cache preflight for 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Enhanced rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 100,
  message: { message: "Rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  skip: (req) => isDevelopment && req.ip === '127.0.0.1'
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 50 : 5,
  message: { message: "Too many authentication attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Secure default parsers with reasonable limits for most endpoints
// Skip image upload routes to allow custom high payload limits
app.use((req, res, next) => {
  // Skip default body parsing for image upload endpoints
  if (req.path.includes('/photos') && req.method === 'POST') {
    return next();
  }
  
  // Apply default parsing for other routes
  express.json({ 
    limit: '10mb', // Secure default - reduced from 150mb to prevent DoS attacks
    strict: true,
    type: ['application/json', 'application/*+json']
  })(req, res, next);
});

app.use((req, res, next) => {
  // Skip default URL encoding for image upload endpoints
  if (req.path.includes('/photos') && req.method === 'POST') {
    return next();
  }
  
  // Apply default URL encoding for other routes
  express.urlencoded({ 
    extended: false, 
    limit: '10mb', // Secure default - reduced from 150mb
    parameterLimit: 1000
  })(req, res, next);
});

// Optimized request logging with async processing
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    // Use setImmediate for non-blocking logging
    setImmediate(() => {
      const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: Math.round(duration * 100) / 100,
        userAgent: req.get('User-Agent')?.substring(0, 100) || 'Unknown',
        ip: req.ip || 'Unknown',
        contentLength: res.get('content-length') || '0'
      };
      
      // Only log in development or for errors/slow requests
      if (isDevelopment || res.statusCode >= 400 || logData.duration > 1000) {
        logger.http(`${req.method} ${req.path} ${res.statusCode} in ${logData.duration}ms`, logData);
      }
    });
  });
  
  next();
});

// Health check endpoint with performance headers
app.get('/health', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// Keep-alive configuration for better connection reuse
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
httpsServer.keepAliveTimeout = 65000;
httpsServer.headersTimeout = 66000;

(async () => {
  try {
    logger.info('🚀 Starting WMS Backend Server...');
    
    // Conectar ao PostgreSQL
    await connectPostgres();
    
    // Auto-migrate database and setup initial data
    logger.info('🔄 Running auto-migration and database setup...');
    
    const migrationResult = await autoMigrate();
    if (!migrationResult.success) {
      logger.error('💔 Auto-migration failed:', migrationResult.error);
      throw new Error(`Database migration failed: ${migrationResult.error}`);
    }
    
    logger.info(`✅ Migration completed - ${migrationResult.tablesCreated} tables created in ${migrationResult.timeElapsed}ms`);
    
    // Setup initial data for complete WMS functionality
    logger.info('📦 Setting up initial database data...');
    
    const setupResult = await setupCompleteDatabase();
    if (setupResult.success) {
      const totalItems = Object.values(setupResult.itemsCreated).reduce((a, b) => a + b, 0);
      logger.info(`✅ Database setup completed - ${totalItems} items created in ${setupResult.timeElapsed}ms`);
    } else {
      logger.warn(`⚠️ Database setup completed with ${setupResult.errors.length} errors`);
      setupResult.errors.forEach(error => logger.warn(`   - ${error}`));
    }
    
    // Final health check
    const healthCheck = await quickHealthCheck();
    if (!healthCheck.healthy) {
      logger.warn('⚠️ Database health check found issues:', healthCheck.criticalIssues);
    } else {
      logger.info('🏥 Database health check passed - System ready!');
    }
    
    // Conectar ao Redis
    await connectRedis();
    
    // Registrar rotas da API
    const { registerRoutes } = await import("./routes/index.js");
    await registerRoutes(app);
    
    // Erro 404 para rotas não encontradas
    app.use((req, res) => {
      res.status(404).json({ message: 'Endpoint não encontrado' });
    });
    
    // Enhanced error handler with async logging
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Async error logging to not block response
      setImmediate(() => {
        logger.error('Server error:', {
          error: err.message,
          stack: isDevelopment ? err.stack : undefined,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
      });
      
      res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
      });
    });
    
    const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 5000;
    
    // Iniciar o WebSocket Server
    initWebSocket(httpsServer);
    
    httpsServer.listen(HTTPS_PORT, () => {
      logger.info(`HTTPS Server running on port ${HTTPS_PORT}`);
      console.log(`🔒 Servidor HTTPS rodando em https://localhost:${HTTPS_PORT}`);
    });
    
    // Enhanced graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      // Stop accepting new connections
      httpsServer.close(async () => {
        try {
          await disconnectPostgres();
          await disconnectRedis();
          logger.info('HTTPS Server closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
      
      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown');
        process.exit(1);
      }, 30000);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
})();
