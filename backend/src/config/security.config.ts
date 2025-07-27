import { z } from 'zod';

// Schema para validação das configurações de segurança
const securityEnvSchema = z.object({
  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET deve ter pelo menos 32 caracteres'),
  SESSION_MAX_AGE: z.string().transform(Number).default('86400000'), // 24 hours
  
  // CORS
  CORS_ORIGIN: z.string().optional(),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),
  
  // Security Headers
  HSTS_MAX_AGE: z.string().transform(Number).default('31536000'), // 1 year
  CSP_ENABLED: z.string().transform(val => val !== 'false').default('true'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  AUTH_RATE_LIMIT_MAX: z.string().transform(Number).default('5'),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default('157286400'), // 150MB
  MAX_FILE_COUNT: z.string().transform(Number).default('10'),
  ALLOWED_MIME_TYPES: z.string().default('image/jpeg,image/png,image/webp,application/pdf'),
  
  // Password Policy
  MIN_PASSWORD_LENGTH: z.string().transform(Number).default('8'),
  REQUIRE_PASSWORD_UPPERCASE: z.string().transform(val => val === 'true').default('false'),
  REQUIRE_PASSWORD_LOWERCASE: z.string().transform(val => val === 'true').default('false'),
  REQUIRE_PASSWORD_NUMBERS: z.string().transform(val => val === 'true').default('false'),
  REQUIRE_PASSWORD_SYMBOLS: z.string().transform(val => val === 'true').default('false'),
  
  // JWT (for future use)
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRY: z.string().default('1h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
});

const env = securityEnvSchema.parse(process.env);

export const securityConfig = {
  // Session configuration
  session: {
    secret: env.SESSION_SECRET,
    maxAge: env.SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
  },
  
  // CORS configuration
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, postman, etc.)
      if (!origin) return callback(null, true);
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        // In development, allow localhost and common development hosts
        if (origin.includes('localhost') || 
            origin.includes('127.0.0.1') || 
            origin.includes('replit') || 
            origin.includes('69.62.95.146')) {
          return callback(null, true);
        }
      }
      
      // Check against configured origin
      if (env.CORS_ORIGIN && origin === env.CORS_ORIGIN) {
        return callback(null, true);
      }
      
      // Allow all in development
      if (isDevelopment) {
        return callback(null, true);
      }
      
      // Reject in production
      callback(new Error('Not allowed by CORS'));
    },
    credentials: env.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  },
  
  // Security headers
  headers: {
    hsts: {
      maxAge: env.HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: true,
    },
    contentSecurityPolicy: env.CSP_ENABLED ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' as const },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    max: env.RATE_LIMIT_MAX,
    message: { message: "Rate limit exceeded. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.ip || req.connection?.remoteAddress || 'unknown',
    skip: (req: any) => process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1',
  },
  
  // Auth rate limiting
  authRateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    max: env.AUTH_RATE_LIMIT_MAX,
    message: { message: "Too many authentication attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // File upload security
  fileUpload: {
    maxSize: env.MAX_FILE_SIZE,
    maxCount: env.MAX_FILE_COUNT,
    allowedMimeTypes: env.ALLOWED_MIME_TYPES.split(',').map(type => type.trim()),
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    sanitizeFilename: true,
    preservePath: false,
  },
  
  // Password policy
  password: {
    minLength: env.MIN_PASSWORD_LENGTH,
    requireUppercase: env.REQUIRE_PASSWORD_UPPERCASE,
    requireLowercase: env.REQUIRE_PASSWORD_LOWERCASE,
    requireNumbers: env.REQUIRE_PASSWORD_NUMBERS,
    requireSymbols: env.REQUIRE_PASSWORD_SYMBOLS,
    
    // Password strength patterns
    patterns: {
      uppercase: /[A-Z]/,
      lowercase: /[a-z]/,
      numbers: /[0-9]/,
      symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    },
  },
  
  // JWT configuration (for future use)
  jwt: env.JWT_SECRET ? {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRY,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRY,
    issuer: 'wms-backend',
    audience: 'wms-frontend',
  } : null,
  
  // Sensitive data patterns for logging
  sensitivePatterns: [
    /password/i,
    /passwd/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /cookie/i,
    /api[_-]?key/i,
    /credit[_-]?card/i,
    /ssn/i,
    /social[_-]?security/i,
  ],
  
  // Trusted proxy settings
  proxy: {
    trust: process.env.NODE_ENV === 'production' ? 1 : false,
  },
} as const;

export type SecurityConfig = typeof securityConfig;