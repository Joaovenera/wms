import express from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import logger from "./utils/logger.js";

const app = express();
const server = createServer(app);

const isDevelopment = process.env.NODE_ENV !== "production";

// CORS desabilitado momentaneamente para testes
// app.use(cors({
//   origin: true, // Permitir qualquer origem em desenvolvimento
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
//   exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
// }));

// Configurações de segurança
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitar CSP pois é uma API
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 100,
  message: { message: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// Parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Debug CORS em desenvolvimento
  if (isDevelopment) {
    const origin = req.get('Origin');
    const method = req.method;
    logger.info(`CORS Debug - Origin: ${origin}, Method: ${method}, Path: ${req.path}`);
  }
  
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

// Trust proxy
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

(async () => {
  try {
    // Registrar rotas da API
    const { registerRoutes } = await import("./routes/index.js");
    await registerRoutes(app);
    
    // Erro 404 para rotas não encontradas
    app.use((req, res) => {
      res.status(404).json({ message: 'Endpoint não encontrado' });
    });
    
    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Erro no servidor:', err);
      res.status(err.status || 500).json({
        message: err.message || 'Erro interno do servidor',
        ...(isDevelopment && { stack: err.stack })
      });
    });
    
    const PORT = Number(process.env.PORT) || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`Backend rodando na porta ${PORT}`);
      console.log(`🚀 Backend API rodando em http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
})();
