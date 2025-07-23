import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage for correlation IDs
export const correlationStorage = new AsyncLocalStorage<{ correlationId: string; userId?: string }>();

// Configuration interface
interface LoggerConfig {
  level: string;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDirectory: string;
  maxFileSize: number;
  maxFiles: number;
  datePattern: string;
  environment: string;
}

// Get configuration from environment variables with defaults
const getLoggerConfig = (): LoggerConfig => ({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
  enableConsoleLogging: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
  logDirectory: process.env.LOG_DIRECTORY || path.join(process.cwd(), 'logs'),
  maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB default
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'), // 2 weeks of daily logs
  datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
  environment: process.env.NODE_ENV || 'development',
});

const config = getLoggerConfig();

// Define log levels with more granular options
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5,
};

// Define colors for different log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  trace: 'cyan',
};

winston.addColors(colors);

// Sensitive data patterns to sanitize
const SENSITIVE_PATTERNS = [
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
];

// Function to sanitize sensitive data
const sanitizeData = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Don't log very long strings (potential file contents, etc.)
    if (obj.length > 1000) {
      return `[String too long: ${obj.length} characters]`;
    }
    return obj;
  }
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeData);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeData(value);
    }
  }
  
  return sanitized;
};

// Enhanced format with correlation ID and better structure
const createEnhancedFormat = (includeColors = false) => {
  const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const context = correlationStorage.getStore();
      const correlationId = context?.correlationId || 'no-correlation';
      const userId = context?.userId || 'anonymous';
      
      // Sanitize metadata
      const sanitizedMeta = sanitizeData(meta);
      
      const logObject: any = {
        timestamp,
        level,
        message,
        correlationId,
        userId,
        environment: config.environment,
      };
      
      if (stack) {
        logObject.stack = stack;
      }
      
      if (Object.keys(sanitizedMeta).length > 0) {
        logObject.meta = sanitizedMeta;
      }
      
      if (includeColors) {
        return `${timestamp} [${level}] [${correlationId}] [${userId}]: ${message} ${
          stack ? `\n${stack}` : ''
        } ${Object.keys(sanitizedMeta).length > 0 ? JSON.stringify(sanitizedMeta) : ''}`;
      }
      
      return JSON.stringify(logObject);
    })
  );
  
  if (includeColors) {
    return winston.format.combine(
      winston.format.colorize({ all: true }),
      baseFormat
    );
  }
  
  return baseFormat;
};

// Create transports array with error handling
const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [];
  
  try {
    // Console transport
    if (config.enableConsoleLogging) {
      transports.push(
        new winston.transports.Console({
          level: config.level,
          format: createEnhancedFormat(true),
          handleExceptions: true,
          handleRejections: true,
        })
      );
    }
    
    // File transports (only in production or when explicitly enabled)
    if (config.enableFileLogging && (config.environment === 'production' || process.env.FORCE_FILE_LOGGING === 'true')) {
      // Ensure log directory exists
      if (!fs.existsSync(config.logDirectory)) {
        fs.mkdirSync(config.logDirectory, { recursive: true });
      }
      
      // Error log file
      transports.push(
        new winston.transports.File({
          filename: path.join(config.logDirectory, 'error.log'),
          level: 'error',
          format: createEnhancedFormat(false),
          maxsize: config.maxFileSize,
          maxFiles: config.maxFiles,
          handleExceptions: true,
          handleRejections: true,
        })
      );
      
      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: path.join(config.logDirectory, 'combined.log'),
          format: createEnhancedFormat(false),
          maxsize: config.maxFileSize,
          maxFiles: config.maxFiles,
        })
      );
      
      // HTTP access log file
      transports.push(
        new winston.transports.File({
          filename: path.join(config.logDirectory, 'access.log'),
          level: 'http',
          format: createEnhancedFormat(false),
          maxsize: config.maxFileSize,
          maxFiles: config.maxFiles,
        })
      );
    }
  } catch (error) {
    // Fallback to console if file transport setup fails
    console.error('Failed to setup file transports, falling back to console only:', error);
    if (transports.length === 0) {
      transports.push(
        new winston.transports.Console({
          level: config.level,
          format: createEnhancedFormat(true),
        })
      );
    }
  }
  
  return transports;
};

// Create the logger with enhanced configuration
const logger = winston.createLogger({
  level: config.level,
  levels,
  transports: createTransports(),
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test' && process.env.ENABLE_LOGS !== 'true',
});

// Handle logger errors
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

// Create a stream object for morgan with enhanced formatting
export const morganStream = {
  write: (message: string) => {
    // Remove newlines and extra whitespace from morgan messages
    const cleanMessage = message.trim();
    if (cleanMessage) {
      logger.http(cleanMessage);
    }
  },
};

// Performance monitoring
let logCount = 0;
const LOG_PERFORMANCE_INTERVAL = 10000; // Log performance every 10000 logs

// Enhanced helper functions with performance monitoring
const logWithLevel = (level: string, message: string, meta?: any) => {
  try {
    logCount++;
    
    // Performance monitoring
    if (logCount % LOG_PERFORMANCE_INTERVAL === 0) {
      logger.debug(`Logger performance: ${logCount} logs processed`);
    }
    
    logger.log(level, message, meta);
  } catch (error) {
    // Fallback to console if logger fails
    console.error(`Logger failed for level ${level}:`, error);
    console.log(`${level.toUpperCase()}: ${message}`, meta);
  }
};

// Enhanced helper functions with better error handling
export const logError = (message: string, meta?: any) => {
  logWithLevel('error', message, meta);
};

export const logWarn = (message: string, meta?: any) => {
  logWithLevel('warn', message, meta);
};

export const logInfo = (message: string, meta?: any) => {
  logWithLevel('info', message, meta);
};

export const logHttp = (message: string, meta?: any) => {
  logWithLevel('http', message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logWithLevel('debug', message, meta);
};

export const logTrace = (message: string, meta?: any) => {
  logWithLevel('trace', message, meta);
};

// Utility functions for correlation
export const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const withCorrelation = <T>(correlationId: string, userId: string | undefined, fn: () => T): T => {
  return correlationStorage.run({ correlationId, userId }, fn);
};

// Express middleware for automatic correlation ID
export const correlationMiddleware = (req: any, res: any, next: any) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  const userId = req.user?.id || req.headers['x-user-id'];
  
  // Set correlation ID header
  res.setHeader('x-correlation-id', correlationId);
  
  // Log security context for HTTPS
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const protocol = isSecure ? 'https' : 'http';
  
  // Add security headers for HTTPS
  if (isSecure) {
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
  
  // Log connection security context
  logDebug('Request correlation established', {
    correlationId,
    userId: userId || 'anonymous',
    protocol,
    secure: isSecure,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });
  
  correlationStorage.run({ correlationId, userId }, () => {
    next();
  });
};

// Structured logging helpers
export const logRequest = (req: any, meta?: any) => {
  logHttp('HTTP Request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    ...meta,
  });
};

export const logResponse = (req: any, res: any, responseTime: number, meta?: any) => {
  logHttp('HTTP Response', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ...meta,
  });
};

export const logDatabaseQuery = (query: string, duration: number, meta?: any) => {
  logDebug('Database Query', {
    query: query.length > 200 ? `${query.substring(0, 200)}...` : query,
    duration: `${duration}ms`,
    ...meta,
  });
};

export const logBusinessEvent = (event: string, data?: any) => {
  logInfo('Business Event', {
    event,
    data: sanitizeData(data),
  });
};

// Graceful shutdown
export const closeLogger = (): Promise<void> => {
  return new Promise((resolve) => {
    logger.end(() => {
      resolve();
    });
  });
};

export default logger; 