import { createClient, RedisClientType } from 'redis';
import { redisConfig } from '../../config/redis.config.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';

// Create Redis client with enhanced configuration
export const redisClient: RedisClientType = createClient({
  url: redisConfig.url,
  database: redisConfig.database,
  password: redisConfig.password,
  socket: redisConfig.socket,
});

// Connection event listeners
redisClient.on('connect', () => {
  logInfo('Redis client connecting...', {
    host: redisConfig.host,
    port: redisConfig.port,
    database: redisConfig.database,
  });
});

redisClient.on('ready', () => {
  logInfo('Redis client ready', {
    status: 'connected',
    isReady: redisClient.isReady,
    isOpen: redisClient.isOpen,
  });
});

redisClient.on('error', (err) => {
  logError('Redis client error', {
    error: err.message,
    stack: err.stack,
    isReady: redisClient.isReady,
    isOpen: redisClient.isOpen,
  });
});

redisClient.on('end', () => {
  logInfo('Redis client disconnected', {
    status: 'disconnected',
  });
});

redisClient.on('reconnecting', () => {
  logWarn('Redis client reconnecting...', {
    status: 'reconnecting',
  });
});

// Connection management functions
export async function connectRedis(): Promise<void> {
  try {
    if (!redisClient.isReady) {
      await redisClient.connect();
      logInfo('Redis connected successfully', {
        host: redisConfig.host,
        port: redisConfig.port,
        database: redisConfig.database,
      });
    }
  } catch (error) {
    logError('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
      host: redisConfig.host,
      port: redisConfig.port,
    });
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient.isReady) {
      await redisClient.quit();
      logInfo('Redis disconnected successfully');
    }
  } catch (error) {
    logError('Failed to disconnect from Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function isRedisConnected(): boolean {
  return redisClient.isReady;
}

// Redis health check
export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
  info?: {
    connected: boolean;
    ready: boolean;
    memory?: string;
    dbsize?: number;
  };
}> {
  try {
    if (!isRedisConnected()) {
      return {
        status: 'unhealthy',
        error: 'Redis not connected',
        info: {
          connected: redisClient.isOpen,
          ready: redisClient.isReady,
        },
      };
    }

    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    // Get additional info
    const info = await redisClient.info('memory');
    const dbsize = await redisClient.dbSize();

    // Extract memory usage
    const memoryLine = info.split('\r\n').find(line => line.includes('used_memory_human'));
    const memory = memoryLine ? memoryLine.split(':')[1] : 'N/A';

    logInfo('Redis health check passed', {
      latency: `${latency}ms`,
      memory,
      dbsize,
    });

    return {
      status: 'healthy',
      latency,
      info: {
        connected: redisClient.isOpen,
        ready: redisClient.isReady,
        memory,
        dbsize,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logError('Redis health check failed', {
      error: errorMessage,
    });

    return {
      status: 'unhealthy',
      error: errorMessage,
      info: {
        connected: redisClient.isOpen,
        ready: redisClient.isReady,
      },
    };
  }
}

// Cache operations with improved error handling and logging
export async function setCache(key: string, value: any, ttl?: number): Promise<boolean> {
  try {
    if (!isRedisConnected()) {
      logWarn('Redis not connected, skipping cache set', { key });
      return false;
    }

    const prefixedKey = `${redisConfig.keyPrefixes.cache}${key}`;
    const serializedValue = JSON.stringify(value);
    const effectiveTtl = ttl || redisConfig.ttl.default;

    await redisClient.setEx(prefixedKey, effectiveTtl, serializedValue);
    
    logInfo('Cache set successfully', {
      key: prefixedKey,
      ttl: effectiveTtl,
      valueSize: serializedValue.length,
    });

    return true;
  } catch (error) {
    logError('Error setting cache', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (!isRedisConnected()) {
      logWarn('Redis not connected, skipping cache get', { key });
      return null;
    }

    const prefixedKey = `${redisConfig.keyPrefixes.cache}${key}`;
    const value = await redisClient.get(prefixedKey);

    if (value) {
      const parsedValue = JSON.parse(value) as T;
      logInfo('Cache hit', {
        key: prefixedKey,
        valueSize: value.length,
      });
      return parsedValue;
    }

    logInfo('Cache miss', { key: prefixedKey });
    return null;
  } catch (error) {
    logError('Error getting cache', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  try {
    if (!isRedisConnected()) {
      logWarn('Redis not connected, skipping cache delete', { key });
      return false;
    }

    const prefixedKey = `${redisConfig.keyPrefixes.cache}${key}`;
    const result = await redisClient.del(prefixedKey);
    
    logInfo('Cache deleted', {
      key: prefixedKey,
      deleted: result > 0,
    });

    return result > 0;
  } catch (error) {
    logError('Error deleting cache', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

export async function clearCache(pattern?: string): Promise<number> {
  try {
    if (!isRedisConnected()) {
      logWarn('Redis not connected, skipping cache clear');
      return 0;
    }

    let deletedCount = 0;

    if (pattern) {
      // Delete keys matching pattern
      const prefixedPattern = `${redisConfig.keyPrefixes.cache}${pattern}`;
      const keys = await redisClient.keys(prefixedPattern);
      
      if (keys.length > 0) {
        deletedCount = await redisClient.del(keys);
      }
      
      logInfo('Cache cleared by pattern', {
        pattern: prefixedPattern,
        deletedCount,
      });
    } else {
      // Clear all cache keys
      const keys = await redisClient.keys(`${redisConfig.keyPrefixes.cache}*`);
      
      if (keys.length > 0) {
        deletedCount = await redisClient.del(keys);
      }
      
      logInfo('All cache cleared', { deletedCount });
    }

    return deletedCount;
  } catch (error) {
    logError('Error clearing cache', {
      pattern,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

// Advanced cache operations
export async function getCacheKeys(pattern = '*'): Promise<string[]> {
  try {
    if (!isRedisConnected()) {
      return [];
    }

    const prefixedPattern = `${redisConfig.keyPrefixes.cache}${pattern}`;
    const keys = await redisClient.keys(prefixedPattern);
    
    // Remove prefix from keys for cleaner output
    return keys.map(key => key.replace(redisConfig.keyPrefixes.cache, ''));
  } catch (error) {
    logError('Error getting cache keys', {
      pattern,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

export async function getCacheStats(): Promise<{
  totalKeys: number;
  cacheKeys: number;
  sessionKeys: number;
  memory: string;
  dbsize: number;
}> {
  try {
    if (!isRedisConnected()) {
      return {
        totalKeys: 0,
        cacheKeys: 0,
        sessionKeys: 0,
        memory: 'N/A',
        dbsize: 0,
      };
    }

    const dbsize = await redisClient.dbSize();
    const cacheKeys = await redisClient.keys(`${redisConfig.keyPrefixes.cache}*`);
    const sessionKeys = await redisClient.keys(`${redisConfig.keyPrefixes.session}*`);
    
    const info = await redisClient.info('memory');
    const memoryLine = info.split('\r\n').find(line => line.includes('used_memory_human'));
    const memory = memoryLine ? memoryLine.split(':')[1] : 'N/A';

    return {
      totalKeys: dbsize,
      cacheKeys: cacheKeys.length,
      sessionKeys: sessionKeys.length,
      memory,
      dbsize,
    };
  } catch (error) {
    logError('Error getting cache stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      totalKeys: 0,
      cacheKeys: 0,
      sessionKeys: 0,
      memory: 'N/A',
      dbsize: 0,
    };
  }
}

// Export client for direct access if needed
export default redisClient;