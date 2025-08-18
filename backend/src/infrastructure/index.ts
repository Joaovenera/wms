import { db, pool, checkDatabaseHealth, closeDatabaseConnection, getDatabaseMetrics } from './database/database.js';
import { repositories } from './database/repositories/index.js';
import { cache, cacheService, strategies, strategicCache } from './cache/index.js';
import monitoring from './monitoring/index.js';
/**
 * Infrastructure Layer Barrel Export
 * 
 * Centralizes all infrastructure components:
 * - Database layer with PostgreSQL 17 optimizations
 * - Advanced caching with Redis strategies
 * - Monitoring and health checks
 * - Repository implementations
 */

// Database exports
export { db, pool, checkDatabaseHealth, closeDatabaseConnection, getDatabaseMetrics } from './database/database.js';
export { repositories } from './database/repositories/index.js';
export type { RepositoryContainer } from './database/repositories/index.js';
// Avoid re-exporting database schemas to keep infra barrel lean

// Cache exports
export { cache, cacheService, strategies, strategicCache } from './cache/index.js';
export type { CacheOptions, CacheStats, CacheStrategy } from './cache/index.js';

// Monitoring exports
export { default as monitoring } from './monitoring/index.js';
export type { 
  HealthStatus, 
  HealthCheck, 
  SystemMetrics,
  RequestMetrics,
  ErrorMetrics,
  BusinessMetrics,
  PerformanceMetrics,
  AggregatedMetrics 
} from './monitoring/index.js';

// Legacy compatibility exports
export * from './cache/redis.client.js';

// Unified infrastructure interface
export const infrastructure = {
  // Database operations
  database: {
    connection: db,
    repositories,
    health: checkDatabaseHealth,
    metrics: getDatabaseMetrics,
    close: closeDatabaseConnection,
  },
  
  // Cache operations
  cache: {
    service: cacheService,
    strategic: strategicCache,
    strategies,
    unified: cache,
  },
  
  // Monitoring operations
  monitoring: {
    health: monitoring.health,
    metrics: monitoring.metrics,
    services: {
      health: healthService,
      metrics: metricsService,
    },
  },
} as const;

// Storage exports (future)
// export * from './storage/index.js';

// External integrations (future)
// export * from './external/index.js';

export default infrastructure;