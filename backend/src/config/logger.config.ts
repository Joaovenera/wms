import { z } from 'zod';
import path from 'path';

// Schema para validação das configurações de logging
const loggerEnvSchema = z.object({
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug', 'trace']).default('info'),
  ENABLE_FILE_LOGGING: z.string().transform(val => val !== 'false').default('true'),
  ENABLE_CONSOLE_LOGGING: z.string().transform(val => val !== 'false').default('true'),
  LOG_DIRECTORY: z.string().default('./logs'),
  LOG_MAX_FILE_SIZE: z.string().transform(Number).default('10485760'), // 10MB
  LOG_MAX_FILES: z.string().transform(Number).default('14'), // 2 weeks
  LOG_DATE_PATTERN: z.string().default('YYYY-MM-DD'),
  
  // Performance monitoring
  LOG_PERFORMANCE_INTERVAL: z.string().transform(Number).default('10000'),
  LOG_QUERY_THRESHOLD_MS: z.string().transform(Number).default('100'),
  LOG_REQUEST_THRESHOLD_MS: z.string().transform(Number).default('1000'),
  
  // Log formats
  LOG_FORMAT: z.enum(['json', 'simple', 'detailed']).default('json'),
  LOG_COLORIZE: z.string().transform(val => val === 'true').default('true'),
  
  // Security logging
  LOG_SENSITIVE_DATA: z.string().transform(val => val === 'true').default('false'),
  LOG_IP_ADDRESSES: z.string().transform(val => val !== 'false').default('true'),
  LOG_USER_AGENTS: z.string().transform(val => val !== 'false').default('true'),
});

const env = loggerEnvSchema.parse(process.env);

export const loggerConfig = {
  // Basic configuration
  level: env.LOG_LEVEL,
  enableFileLogging: env.ENABLE_FILE_LOGGING,
  enableConsoleLogging: env.ENABLE_CONSOLE_LOGGING,
  directory: path.resolve(env.LOG_DIRECTORY),
  
  // File rotation
  maxFileSize: env.LOG_MAX_FILE_SIZE,
  maxFiles: env.LOG_MAX_FILES,
  datePattern: env.LOG_DATE_PATTERN,
  
  // Log levels with priorities
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    trace: 5,
  },
  
  // Colors for console output
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    trace: 'cyan',
  },
  
  // File configuration
  files: {
    error: {
      filename: 'error.log',
      level: 'error',
      handleExceptions: true,
      handleRejections: true,
    },
    combined: {
      filename: 'combined.log',
      level: env.LOG_LEVEL,
    },
    access: {
      filename: 'access.log',
      level: 'http',
    },
    debug: {
      filename: 'debug.log',
      level: 'debug',
    },
  },
  
  // Performance monitoring
  performance: {
    interval: env.LOG_PERFORMANCE_INTERVAL,
    queryThreshold: env.LOG_QUERY_THRESHOLD_MS,
    requestThreshold: env.LOG_REQUEST_THRESHOLD_MS,
  },
  
  // Format configuration
  format: {
    type: env.LOG_FORMAT,
    colorize: env.LOG_COLORIZE,
    timestamp: 'YYYY-MM-DD HH:mm:ss.SSS',
    includeStack: true,
    prettyPrint: process.env.NODE_ENV === 'development',
  },
  
  // Security configuration
  security: {
    logSensitiveData: env.LOG_SENSITIVE_DATA,
    logIpAddresses: env.LOG_IP_ADDRESSES,
    logUserAgents: env.LOG_USER_AGENTS,
    maxStringLength: 1000,
    
    // Patterns to redact
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
    
    // Fields to always redact
    redactFields: [
      'password',
      'confirmPassword',
      'secret',
      'token',
      'authorization',
      'cookie',
      'apiKey',
      'api_key',
    ],
  },
  
  // Environment-specific settings
  environment: {
    development: {
      level: 'debug',
      enableConsole: true,
      enableFile: false,
      colorize: true,
      prettyPrint: true,
    },
    production: {
      level: 'info',
      enableConsole: false,
      enableFile: true,
      colorize: false,
      prettyPrint: false,
    },
    test: {
      level: 'error',
      enableConsole: false,
      enableFile: false,
      silent: true,
    },
  },
  
  // Transport options
  transports: {
    console: {
      handleExceptions: true,
      handleRejections: true,
      colorize: env.LOG_COLORIZE,
    },
    file: {
      handleExceptions: true,
      handleRejections: true,
      maxsize: env.LOG_MAX_FILE_SIZE,
      maxFiles: env.LOG_MAX_FILES,
      tailable: true,
      zippedArchive: true,
    },
  },
  
  // Correlation tracking
  correlation: {
    header: 'x-correlation-id',
    property: 'correlationId',
    generator: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  },
  
  // Structured logging fields
  fields: {
    timestamp: '@timestamp',
    level: 'level',
    message: 'message',
    correlationId: 'correlationId',
    userId: 'userId',
    environment: 'environment',
    service: 'wms-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
} as const;

export type LoggerConfig = typeof loggerConfig;