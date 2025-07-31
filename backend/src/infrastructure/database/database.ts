import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql, eq, and, or, not, desc, asc, isNull, isNotNull, like, ilike } from 'drizzle-orm';
import { databaseConfig } from '../../config/database.config.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';
import * as schema from './schemas/index.js';

/**
 * Database Connection Module
 * 
 * Optimized for PostgreSQL 17 local database with:
 * - Enhanced connection pooling
 * - Performance monitoring
 * - Health checks
 * - Graceful shutdowns
 */

// Validate database configuration
if (!databaseConfig.url) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// Create connection pool with PostgreSQL 17 optimizations
export const pool = new Pool({
  connectionString: databaseConfig.url,
  
  // Enhanced pool configuration for high performance
  min: databaseConfig.pool.min,
  max: databaseConfig.pool.max,
  idleTimeoutMillis: databaseConfig.pool.idleTimeoutMillis,
  connectionTimeoutMillis: databaseConfig.pool.connectionTimeoutMillis,
  // createTimeoutMillis: databaseConfig.pool.createTimeoutMillis, // Not supported in pg PoolConfig
  // destroyTimeoutMillis: databaseConfig.pool.destroyTimeoutMillis, // Not supported in pg PoolConfig
  // reapIntervalMillis: databaseConfig.pool.reapIntervalMillis, // Not supported in pg PoolConfig
  // createRetryIntervalMillis: databaseConfig.pool.createRetryIntervalMillis, // Not supported in pg PoolConfig
  
  // Advanced pool settings for PostgreSQL 17
  // maxUses: databaseConfig.pool.maxUses, // Not supported in pg PoolConfig
  // testOnBorrow: databaseConfig.pool.testOnBorrow, // Not supported in pg PoolConfig
  
  // SSL configuration
  ssl: databaseConfig.ssl,
  
  // PostgreSQL 17 specific connection options
  allowExitOnIdle: false,
  keepAlive: databaseConfig.options.keepAlive,
  keepAliveInitialDelayMillis: databaseConfig.options.keepAliveInitialDelay,
  
  // Application identification
  application_name: databaseConfig.options.application_name,
  
  // Statement and query timeouts for optimal performance
  statement_timeout: databaseConfig.options.statement_timeout,
  query_timeout: databaseConfig.options.query_timeout,
  
  // Connection-specific PostgreSQL settings
  options: `-c search_path=${databaseConfig.options.search_path || 'public'}`,
});

// Create Drizzle instance with schema for PostgreSQL
export const db = drizzle(pool, {
  schema,
  logger: databaseConfig.options.logger,
});

// Connection event handlers
pool.on('connect', (client) => {
  logInfo('Database client connected', {
    // PostgreSQL client connected
  });
});

pool.on('error', (err, client) => {
  logError('Database pool error', {
    error: err.message,
    stack: err.stack,
    // Client error
  });
});

pool.on('acquire', (client) => {
  logInfo('Database client acquired', {
    poolSize: pool.totalCount,
    idleCount: pool.idleCount,
  });
});

pool.on('release', (err, client) => {
  if (err) {
    logError('Database client release error', {
      error: err.message,
    });
  } else {
    logInfo('Database client released', {
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
    });
  }
});

// Database connection health check
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
  poolStats?: {
    total: number;
    idle: number;
    waiting: number;
  };
}> {
  try {
    const start = Date.now();
    
    // Test basic connectivity
    await db.execute(sql`SELECT 1`);
    
    const latency = Date.now() - start;
    
    // Get pool statistics
    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
    
    logInfo('Database health check passed', {
      latency: `${latency}ms`,
      poolStats,
    });
    
    return {
      status: 'healthy',
      latency,
      poolStats,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    
    logError('Database health check failed', {
      error: errorMessage,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    });
    
    return {
      status: 'unhealthy',
      error: errorMessage,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  }
}

// Graceful database shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    logInfo('Closing database connections...');
    await pool.end();
    logInfo('Database connections closed successfully');
  } catch (error) {
    logError('Error closing database connections', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Database metrics collection
export async function getDatabaseMetrics(): Promise<{
  poolStats: {
    total: number;
    idle: number;
    waiting: number;
  };
  connectionString: string;
  ssl: boolean;
}> {
  return {
    poolStats: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
    connectionString: databaseConfig.url.replace(/:\/\/[^@]+@/, '://***:***@'), // Redact credentials
    ssl: !!databaseConfig.ssl,
  };
}

// Re-export commonly used utilities
export { sql, eq, and, or, not, desc, asc, isNull, isNotNull, like, ilike };
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Export database instance as default
export default db;