/**
 * Advanced Caching Service
 * 
 * Provides multiple caching strategies with Redis:
 * - TTL-based caching for data
 * - Cache invalidation patterns
 * - Distributed locking
 * - Performance monitoring
 */

import { redisClient } from './redis.client.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';
import { CacheError } from '../../utils/exceptions/index.js';

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Cache tags for bulk invalidation */
  tags?: string[];
  /** Prefix for cache key */
  prefix?: string;
  /** Whether to compress large values */
  compress?: boolean;
  /** Callback for cache miss */
  onMiss?: () => void;
  /** Callback for cache hit */
  onHit?: () => void;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgLatency: number;
}

export class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    avgLatency: 0,
  };

  private latencySum = 0;
  private operationCount = 0;

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const start = Date.now();
    const fullKey = this.buildKey(key, options.prefix);

    try {
      const value = await redisClient.get(fullKey);
      const latency = Date.now() - start;
      this.updateLatencyStats(latency);

      if (value === null) {
        this.stats.misses++;
        options.onMiss?.();
        
        logInfo('Cache miss', {
          key: fullKey,
          latency: `${latency}ms`,
        });
        
        return null;
      }

      this.stats.hits++;
      options.onHit?.();

      logInfo('Cache hit', {
        key: fullKey,
        latency: `${latency}ms`,
      });

      // Parse JSON value
      try {
        return JSON.parse(value) as T;
      } catch {
        // Return as string if not valid JSON
        return value as unknown as T;
      }
    } catch (error) {
      this.stats.errors++;
      const latency = Date.now() - start;
      this.updateLatencyStats(latency);

      logError('Cache get error', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: `${latency}ms`,
      });

      throw new CacheError(`Failed to get cache key ${fullKey}`);
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const start = Date.now();
    const fullKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl || 3600; // Default 1 hour

    try {
      // Serialize value
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      // Set with TTL
      await redisClient.setEx(fullKey, ttl, serializedValue);

      // Set tags for bulk invalidation
      if (options.tags && options.tags.length > 0) {
        await this.setTags(fullKey, options.tags);
      }

      this.stats.sets++;
      const latency = Date.now() - start;
      this.updateLatencyStats(latency);

      logInfo('Cache set', {
        key: fullKey,
        ttl: `${ttl}s`,
        tags: options.tags,
        latency: `${latency}ms`,
      });
    } catch (error) {
      this.stats.errors++;
      const latency = Date.now() - start;
      this.updateLatencyStats(latency);

      logError('Cache set error', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: `${latency}ms`,
      });

      throw new CacheError(`Failed to set cache key ${fullKey}`);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, prefix?: string): Promise<boolean> {
    const start = Date.now();
    const fullKey = this.buildKey(key, prefix);

    try {
      const result = await redisClient.del(fullKey);
      this.stats.deletes++;
      const latency = Date.now() - start;
      this.updateLatencyStats(latency);

      logInfo('Cache delete', {
        key: fullKey,
        found: result > 0,
        latency: `${latency}ms`,
      });

      return result > 0;
    } catch (error) {
      this.stats.errors++;
      const latency = Date.now() - start;
      this.updateLatencyStats(latency);

      logError('Cache delete error', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: `${latency}ms`,
      });

      throw new CacheError(`Failed to delete cache key ${fullKey}`);
    }
  }

  /**
   * Get or set pattern - get from cache, or fetch and cache if not found
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const value = await fetchFn();
    
    // Cache the result
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const start = Date.now();
    let deletedCount = 0;

    try {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keys = await redisClient.sMembers(tagKey);
        
        if (keys.length > 0) {
          // Delete all keys with this tag
          const deleted = await redisClient.del(keys);
          deletedCount += deleted;
          
          // Remove the tag set
          await redisClient.del(tagKey);
        }
      }

      const latency = Date.now() - start;
      
      logInfo('Cache invalidation by tags', {
        tags,
        deletedCount,
        latency: `${latency}ms`,
      });

      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      const latency = Date.now() - start;
      this.updateLatencyStats(latency);

      logError('Cache invalidation error', {
        tags,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: `${latency}ms`,
      });

      throw new CacheError(`Failed to invalidate cache by tags: ${tags.join(', ')}`);
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(): Promise<void> {
    const start = Date.now();

    try {
      await redisClient.flushDb();
      
      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        avgLatency: 0,
      };
      this.latencySum = 0;
      this.operationCount = 0;

      const latency = Date.now() - start;

      logWarn('Cache cleared', {
        latency: `${latency}ms`,
      });
    } catch (error) {
      this.stats.errors++;

      logError('Cache clear error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new CacheError('Failed to clear cache');
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Check if cache is healthy
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();
    const testKey = 'health:check';
    const testValue = Date.now().toString();

    try {
      // Test set
      await redisClient.setEx(testKey, 10, testValue);
      
      // Test get
      const retrieved = await redisClient.get(testKey);
      
      // Test delete
      await redisClient.del(testKey);

      const latency = Date.now() - start;

      if (retrieved === testValue) {
        return {
          status: 'healthy',
          latency,
        };
      } else {
        return {
          status: 'unhealthy',
          error: 'Value mismatch in health check',
        };
      }
    } catch (error) {
      const latency = Date.now() - start;
      
      return {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Distributed lock implementation
   */
  async acquireLock(
    resource: string,
    ttl: number = 30000,
    timeout: number = 5000
  ): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        // Try to acquire lock
        const result = await redisClient.set(lockKey, lockValue, {
          PX: ttl,
          NX: true
        });
        
        if (result === 'OK') {
          logInfo('Lock acquired', {
            resource,
            lockValue,
            ttl: `${ttl}ms`,
          });
          
          return lockValue;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logError('Lock acquisition error', {
          resource,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        throw new CacheError(`Failed to acquire lock for resource: ${resource}`);
      }
    }

    logWarn('Lock acquisition timeout', {
      resource,
      timeout: `${timeout}ms`,
    });

    return null;
  }

  /**
   * Release distributed lock
   */
  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;

    try {
      // Lua script to atomically check and delete lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redisClient.eval(script, {
        keys: [lockKey],
        arguments: [lockValue]
      });
      const released = result === 1;

      if (released) {
        logInfo('Lock released', {
          resource,
          lockValue,
        });
      } else {
        logWarn('Lock release failed - value mismatch', {
          resource,
          lockValue,
        });
      }

      return released;
    } catch (error) {
      logError('Lock release error', {
        resource,
        lockValue,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new CacheError(`Failed to release lock for resource: ${resource}`);
    }
  }

  /**
   * Build cache key with optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const basePrefix = 'wms';
    const fullPrefix = prefix ? `${basePrefix}:${prefix}` : basePrefix;
    return `${fullPrefix}:${key}`;
  }

  /**
   * Set tags for cache key
   */
  private async setTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      await redisClient.sAdd(tagKey, key);
    }
  }

  /**
   * Update latency statistics
   */
  private updateLatencyStats(latency: number): void {
    this.operationCount++;
    this.latencySum += latency;
    this.stats.avgLatency = Math.round(this.latencySum / this.operationCount);
  }
}

// Export singleton instance
export const cacheService = new CacheService();