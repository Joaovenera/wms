import { z } from 'zod';

/**
 * Database Configuration Schema
 * Optimized for PostgreSQL 17 on NVMe production environments
 */
const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida'),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().transform(Number).optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  
  // Connection Pool Settings - Optimized for high performance
  DB_POOL_MIN: z.string().transform(Number).default('5'),
  DB_POOL_MAX: z.string().transform(Number).default('50'),
  DB_POOL_IDLE_TIMEOUT: z.string().transform(Number).default('10000'),
  DB_CONNECTION_TIMEOUT: z.string().transform(Number).default('5000'),
  DB_ACQUIRE_TIMEOUT: z.string().transform(Number).default('10000'),
  DB_CREATE_TIMEOUT: z.string().transform(Number).default('5000'),
  DB_DESTROY_TIMEOUT: z.string().transform(Number).default('5000'),
  
  // PostgreSQL 17 Performance Settings
  DB_MAX_USES: z.string().transform(Number).default('7500'),
  DB_EVICTION_RUN_INTERVAL: z.string().transform(Number).default('0'),
  DB_SOFT_IDLE_TIMEOUT: z.string().transform(Number).default('5000'),
  
  // SSL settings
  DB_SSL: z.string().transform(val => val === 'true').default('false'),
  DB_SSL_REJECT_UNAUTHORIZED: z.string().transform(val => val !== 'false').default('true'),
  
  // Performance flags
  NODE_ENV: z.string().default('development'),
  DB_ENABLE_QUERY_LOGGING: z.string().transform(val => val === 'true').default('false'),
  DB_STATEMENT_TIMEOUT: z.string().transform(Number).default('30000'),
  DB_QUERY_TIMEOUT: z.string().transform(Number).default('10000'),
});

const env = databaseEnvSchema.parse(process.env);

/**
 * Optimized Database Configuration for PostgreSQL 17 on NVMe
 * 
 * Performance optimizations:
 * - Larger connection pools for high throughput
 * - Shorter timeouts leveraging NVMe speed
 * - Disabled connection eviction for stable performance
 * - Optimized for high-frequency operations
 */
export const databaseConfig = {
  // Connection
  url: env.DATABASE_URL,
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  
  // Pool configuration - Optimized for PostgreSQL 17 + NVMe
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT,
    acquireTimeoutMillis: env.DB_ACQUIRE_TIMEOUT,
    createTimeoutMillis: env.DB_CREATE_TIMEOUT,
    destroyTimeoutMillis: env.DB_DESTROY_TIMEOUT,
    reapIntervalMillis: env.DB_EVICTION_RUN_INTERVAL,
    softIdleTimeoutMillis: env.DB_SOFT_IDLE_TIMEOUT,
    maxUses: env.DB_MAX_USES,
    
    // NVMe-specific optimizations
    createRetryIntervalMillis: 100,
    
    // Pool validation
    testOnBorrow: true,
    testWhileIdle: false,
  },
  
  // SSL configuration
  ssl: env.DB_SSL ? {
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
  } : false,
  
  // PostgreSQL 17 local database options
  options: {
    // Logging configuration
    logger: env.DB_ENABLE_QUERY_LOGGING,
    
    // Connection settings optimized for local PostgreSQL
    connectionTimeoutMS: env.DB_CONNECTION_TIMEOUT,
    socketTimeoutMS: 0, // Disable socket timeout for local connection
    keepAlive: true,
    keepAliveInitialDelay: 0,
    
    // Query optimization
    statement_timeout: env.DB_STATEMENT_TIMEOUT,
    query_timeout: env.DB_QUERY_TIMEOUT,
    
    // PostgreSQL 17 performance parameters
    application_name: 'wms-backend',
    search_path: 'public',
    
    // Connection pool settings
    maxPoolSize: env.DB_POOL_MAX,
    minPoolSize: env.DB_POOL_MIN,
    
    // Performance flags for local PostgreSQL
    prepare: true, // Use prepared statements for performance
    binary: false, // Text format for compatibility
    
    // Local network optimized settings
    tcp_keepalives_idle: 300, // Shorter for local connections
    tcp_keepalives_interval: 15,
    tcp_keepalives_count: 3,
    
    // Additional PostgreSQL settings
    client_encoding: 'UTF8',
    timezone: 'UTC',
  },
  
  // Production performance settings for PostgreSQL 17
  postgres: {
    // Connection parameters optimized for NVMe storage
    shared_preload_libraries: 'pg_stat_statements',
    max_connections: 200,
    shared_buffers: '256MB', // Adjust based on available RAM
    effective_cache_size: '1GB',
    maintenance_work_mem: '64MB',
    checkpoint_completion_target: 0.9,
    wal_buffers: '16MB',
    default_statistics_target: 100,
    random_page_cost: 1.1, // Lower for NVMe SSDs
    effective_io_concurrency: 200, // Higher for NVMe
    work_mem: '4MB',
    
    // PostgreSQL 17 specific optimizations
    max_parallel_workers_per_gather: 2,
    max_parallel_workers: 8,
    max_parallel_maintenance_workers: 2,
    
    // WAL settings for NVMe performance
    wal_compression: 'on',
    wal_level: 'replica',
    max_wal_size: '1GB',
    min_wal_size: '80MB',
    
    // Checkpointing for NVMe
    checkpoint_timeout: '5min',
    checkpoint_warning: '30s',
    
    // Background writer
    bgwriter_delay: '200ms',
    bgwriter_lru_maxpages: 100,
    bgwriter_lru_multiplier: 2.0,
    
    // Vacuum settings
    autovacuum: 'on',
    log_autovacuum_min_duration: 0,
    autovacuum_max_workers: 3,
    autovacuum_naptime: '1min',
    autovacuum_vacuum_threshold: 50,
    autovacuum_analyze_threshold: 50,
    
    // Logging for monitoring
    log_duration: env.NODE_ENV === 'production' ? 'off' : 'on',
    log_statement: env.NODE_ENV === 'production' ? 'none' : 'all',
    log_min_duration_statement: env.NODE_ENV === 'production' ? 1000 : -1,
  },
} as const;

export type DatabaseConfig = typeof databaseConfig;