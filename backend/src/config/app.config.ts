import { z } from 'zod';

// Schema para validação das variáveis de ambiente
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  HTTPS_PORT: z.string().transform(Number).default('5000'),
  
  // Frontend
  FRONTEND_URL: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  
  // Security
  SESSION_SECRET: z.string().default('mws-secret-key-development'),
  
  // Logging
  LOG_LEVEL: z.string().default('info'),
  ENABLE_FILE_LOGGING: z.string().transform(val => val !== 'false').default('true'),
  ENABLE_CONSOLE_LOGGING: z.string().transform(val => val !== 'false').default('true'),
  LOG_DIRECTORY: z.string().default('./logs'),
  LOG_MAX_FILE_SIZE: z.string().transform(Number).default('104857600'), //alteração manual para 100mb
  LOG_MAX_FILES: z.string().transform(Number).default('14'),
  
  // Performance
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  AUTH_RATE_LIMIT_MAX: z.string().transform(Number).default('5'),
});

// Validar e exportar configurações
const env = envSchema.parse(process.env);

export const appConfig = {
  // Environment
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Server
  port: env.PORT,
  httpsPort: env.HTTPS_PORT,
  
  // URLs
  frontendUrl: env.FRONTEND_URL,
  cookieDomain: env.COOKIE_DOMAIN,
  
  // Security
  sessionSecret: env.SESSION_SECRET,
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
    enableFileLogging: env.ENABLE_FILE_LOGGING,
    enableConsoleLogging: env.ENABLE_CONSOLE_LOGGING,
    directory: env.LOG_DIRECTORY,
    maxFileSize: env.LOG_MAX_FILE_SIZE,
    maxFiles: env.LOG_MAX_FILES,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    authMaxRequests: env.AUTH_RATE_LIMIT_MAX,
  },
  
  // SSL/TLS
  ssl: {
    keyPath: './certs/key.pem',
    certPath: './certs/cert.pem',
  },
} as const;

export type AppConfig = typeof appConfig;