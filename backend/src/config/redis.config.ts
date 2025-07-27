import { z } from 'zod';

// Schema para validação das configurações do Redis
const redisEnvSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),
  
  // Connection settings
  REDIS_CONNECT_TIMEOUT: z.string().transform(Number).default('10000'),
  REDIS_COMMAND_TIMEOUT: z.string().transform(Number).default('5000'),
  REDIS_RETRY_DELAY_ON_FAILURE: z.string().transform(Number).default('100'),
  REDIS_MAX_RETRY_ATTEMPTS: z.string().transform(Number).default('10'),
  REDIS_RETRY_TIME_LIMIT: z.string().transform(Number).default('3600000'), // 1 hour
  
  // Pool settings
  REDIS_POOL_MIN: z.string().transform(Number).default('2'),
  REDIS_POOL_MAX: z.string().transform(Number).default('10'),
  
  // Cache settings
  REDIS_DEFAULT_TTL: z.string().transform(Number).default('3600'), // 1 hour
  REDIS_SESSION_TTL: z.string().transform(Number).default('86400'), // 24 hours
});

const env = redisEnvSchema.parse(process.env);

export const redisConfig = {
  // Connection
  url: env.REDIS_URL,
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  database: env.REDIS_DB,
  
  // Socket configuration
  socket: {
    connectTimeout: env.REDIS_CONNECT_TIMEOUT,
    commandTimeout: env.REDIS_COMMAND_TIMEOUT,
    lazyConnect: true,
    reconnectStrategy: (retries: number) => {
      if (retries > env.REDIS_MAX_RETRY_ATTEMPTS) {
        return false; // Stop retrying
      }
      return Math.min(retries * env.REDIS_RETRY_DELAY_ON_FAILURE, 3000);
    },
  },
  
  // Pool configuration
  pool: {
    min: env.REDIS_POOL_MIN,
    max: env.REDIS_POOL_MAX,
  },
  
  // Cache TTL defaults
  ttl: {
    default: env.REDIS_DEFAULT_TTL,
    session: env.REDIS_SESSION_TTL,
    shortTerm: 300, // 5 minutes
    mediumTerm: 1800, // 30 minutes
    longTerm: 86400, // 24 hours
  },
  
  // Retry configuration
  retry: {
    maxAttempts: env.REDIS_MAX_RETRY_ATTEMPTS,
    delayOnFailure: env.REDIS_RETRY_DELAY_ON_FAILURE,
    timeLimit: env.REDIS_RETRY_TIME_LIMIT,
  },
  
  // Key prefixes for organization
  keyPrefixes: {
    session: 'sess:',
    cache: 'cache:',
    lock: 'lock:',
    queue: 'queue:',
    metrics: 'metrics:',
    user: 'user:',
    product: 'product:',
    ucp: 'ucp:',
  },
} as const;

export type RedisConfig = typeof redisConfig;