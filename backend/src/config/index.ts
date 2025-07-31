// Central configuration exports
export { appConfig, type AppConfig } from './app.config';
export { databaseConfig, type DatabaseConfig } from './database.config';
export { redisConfig, type RedisConfig } from './redis.config';
export { securityConfig, type SecurityConfig } from './security.config';
export { loggerConfig, type LoggerConfig } from './logger.config';

// Import configs for combined object
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { securityConfig } from './security.config';
import { loggerConfig } from './logger.config';

// Combined configuration object for easy access
export const config = {
  app: appConfig,
  database: databaseConfig,
  redis: redisConfig,
  security: securityConfig,
  logger: loggerConfig,
} as const;

export type Config = typeof config;

// Configuration validation function
export function validateConfig(): void {
  // Validate critical configuration values
  if (!config.app.sessionSecret || config.app.sessionSecret === 'mws-secret-key-development') {
    if (config.app.isProduction) {
      throw new Error('SESSION_SECRET must be set in production');
    }
    console.warn('⚠️  Using default SESSION_SECRET - change this in production!');
  }
  
  if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
  }
  
  if (config.app.isProduction && !config.security.cors.origin) {
    console.warn('⚠️  CORS_ORIGIN not set in production - this may cause CORS issues');
  }
  
  // Validate database URL format
  try {
    new URL(config.database.url);
  } catch (error) {
    throw new Error('DATABASE_URL must be a valid URL');
  }
  
  // Log configuration status
  console.log('✅ Configuration validated successfully');
  console.log(`📊 Environment: ${config.app.env}`);
  console.log(`🔌 Database: ${new URL(config.database.url).hostname}`);
  console.log(`💾 Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`📝 Log Level: ${config.logger.level}`);
}

// Environment helpers
export const isDevelopment = config.app.isDevelopment;
export const isProduction = config.app.isProduction;
export const isTest = config.app.isTest;