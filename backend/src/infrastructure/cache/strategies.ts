/**
 * Cache Strategies for Different Data Types
 * 
 * Provides specialized caching strategies for WMS entities:
 * - User cache with session integration
 * - Product cache with inventory updates
 * - Pallet cache with position tracking
 * - UCP cache with item transfers
 */

import { cacheService, CacheOptions } from './cache.service.js';
import { logInfo } from '../../utils/logger.js';

/**
 * Cache strategy configuration
 */
export interface CacheStrategy {
  /** Default TTL in seconds */
  defaultTtl: number;
  /** Cache key prefix */
  prefix: string;
  /** Default tags */
  tags: string[];
  /** Whether to use compression */
  compress: boolean;
}

/**
 * Cache strategies for different entities
 */
export const cacheStrategies = {
  // User data - longer TTL for profile data, shorter for session data
  user: {
    profile: {
      defaultTtl: 3600, // 1 hour
      prefix: 'user:profile',
      tags: ['users'],
      compress: false,
    } as CacheStrategy,
    
    session: {
      defaultTtl: 1800, // 30 minutes
      prefix: 'user:session',
      tags: ['users', 'sessions'],
      compress: false,
    } as CacheStrategy,
    
    preferences: {
      defaultTtl: 7200, // 2 hours
      prefix: 'user:preferences',
      tags: ['users'],
      compress: false,
    } as CacheStrategy,
  },

  // Product data - medium TTL, invalidated on inventory changes
  product: {
    details: {
      defaultTtl: 1800, // 30 minutes
      prefix: 'product:details',
      tags: ['products'],
      compress: true,
    } as CacheStrategy,
    
    stock: {
      defaultTtl: 300, // 5 minutes - frequently updated
      prefix: 'product:stock',
      tags: ['products', 'inventory'],
      compress: false,
    } as CacheStrategy,
    
    search: {
      defaultTtl: 600, // 10 minutes
      prefix: 'product:search',
      tags: ['products', 'search'],
      compress: true,
    } as CacheStrategy,
  },

  // Pallet data - short TTL due to frequent movement
  pallet: {
    details: {
      defaultTtl: 600, // 10 minutes
      prefix: 'pallet:details',
      tags: ['pallets'],
      compress: false,
    } as CacheStrategy,
    
    position: {
      defaultTtl: 300, // 5 minutes - frequently updated
      prefix: 'pallet:position',
      tags: ['pallets', 'positions'],
      compress: false,
    } as CacheStrategy,
    
    history: {
      defaultTtl: 3600, // 1 hour - historical data
      prefix: 'pallet:history',
      tags: ['pallets', 'history'],
      compress: true,
    } as CacheStrategy,
  },

  // UCP data - very short TTL due to item transfers
  ucp: {
    details: {
      defaultTtl: 300, // 5 minutes
      prefix: 'ucp:details',
      tags: ['ucps'],
      compress: false,
    } as CacheStrategy,
    
    items: {
      defaultTtl: 180, // 3 minutes - frequently updated
      prefix: 'ucp:items',
      tags: ['ucps', 'items'],
      compress: false,
    } as CacheStrategy,
    
    transfers: {
      defaultTtl: 600, // 10 minutes
      prefix: 'ucp:transfers',
      tags: ['ucps', 'transfers'],
      compress: true,
    } as CacheStrategy,
  },

  // Position data - medium TTL, invalidated on structure changes
  position: {
    details: {
      defaultTtl: 1800, // 30 minutes
      prefix: 'position:details',
      tags: ['positions'],
      compress: false,
    } as CacheStrategy,
    
    occupancy: {
      defaultTtl: 300, // 5 minutes - frequently updated
      prefix: 'position:occupancy',
      tags: ['positions', 'occupancy'],
      compress: false,
    } as CacheStrategy,
    
    structure: {
      defaultTtl: 7200, // 2 hours - rarely changes
      prefix: 'position:structure',
      tags: ['positions', 'structure'],
      compress: true,
    } as CacheStrategy,
  },

  // System data - longer TTL for configuration
  system: {
    config: {
      defaultTtl: 7200, // 2 hours
      prefix: 'system:config',
      tags: ['system'],
      compress: false,
    } as CacheStrategy,
    
    metrics: {
      defaultTtl: 60, // 1 minute
      prefix: 'system:metrics',
      tags: ['system', 'metrics'],
      compress: false,
    } as CacheStrategy,
  },
} as const;

/**
 * Cache service with strategy helpers
 */
export class StrategicCacheService {
  /**
   * Get with strategy
   */
  static async get<T>(
    strategy: CacheStrategy,
    key: string,
    customOptions?: Partial<CacheOptions>
  ): Promise<T | null> {
    const options: CacheOptions = {
      prefix: strategy.prefix,
      tags: strategy.tags,
      compress: strategy.compress,
      ...customOptions,
    };

    return cacheService.get<T>(key, options);
  }

  /**
   * Set with strategy
   */
  static async set<T>(
    strategy: CacheStrategy,
    key: string,
    value: T,
    customTtl?: number,
    customOptions?: Partial<CacheOptions>
  ): Promise<void> {
    const options: CacheOptions = {
      ttl: customTtl || strategy.defaultTtl,
      prefix: strategy.prefix,
      tags: strategy.tags,
      compress: strategy.compress,
      ...customOptions,
    };

    return cacheService.set(key, value, options);
  }

  /**
   * Get or set with strategy
   */
  static async getOrSet<T>(
    strategy: CacheStrategy,
    key: string,
    fetchFn: () => Promise<T>,
    customTtl?: number,
    customOptions?: Partial<CacheOptions>
  ): Promise<T> {
    const options: CacheOptions = {
      ttl: customTtl || strategy.defaultTtl,
      prefix: strategy.prefix,
      tags: strategy.tags,
      compress: strategy.compress,
      ...customOptions,
    };

    return cacheService.getOrSet(key, fetchFn, options);
  }

  /**
   * Delete with strategy
   */
  static async delete(strategy: CacheStrategy, key: string): Promise<boolean> {
    return cacheService.delete(key, strategy.prefix);
  }

  /**
   * Invalidate by entity type
   */
  static async invalidateEntity(entityType: keyof typeof cacheStrategies): Promise<number> {
    const strategies = cacheStrategies[entityType];
    const allTags = new Set<string>();

    // Collect all tags from entity strategies
    Object.values(strategies).forEach(strategy => {
      strategy.tags.forEach(tag => allTags.add(tag));
    });

    const tags = Array.from(allTags);
    const deletedCount = await cacheService.invalidateByTags(tags);

    logInfo('Cache invalidation by entity', {
      entityType,
      tags,
      deletedCount,
    });

    return deletedCount;
  }

  /**
   * Preload frequently accessed data
   */
  static async preloadCache(
    preloadFunctions: Array<{
      strategy: CacheStrategy;
      key: string;
      fetchFn: () => Promise<any>;
    }>
  ): Promise<void> {
    logInfo('Starting cache preload', {
      itemCount: preloadFunctions.length,
    });

    const promises = preloadFunctions.map(async ({ strategy, key, fetchFn }) => {
      try {
        // Check if already cached
        const existing = await this.get(strategy, key);
        
        if (existing === null) {
          // Preload the data
          const data = await fetchFn();
          await this.set(strategy, key, data);
          
          logInfo('Cache preloaded', {
            strategy: strategy.prefix,
            key,
          });
        }
      } catch (error) {
        logInfo('Cache preload failed', {
          strategy: strategy.prefix,
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(promises);
    
    logInfo('Cache preload completed');
  }

  /**
   * Warm up cache for specific user
   */
  static async warmUpUserCache(userId: number): Promise<void> {
    // This would typically load user profile, preferences, recent activity, etc.
    const userKey = userId.toString();
    
    await Promise.allSettled([
      // Example preload operations - implement based on your needs
      this.getOrSet(
        cacheStrategies.user.profile,
        userKey,
        async () => {
          // Load user profile from database
          return { id: userId, loadedAt: new Date().toISOString() };
        }
      ),
      this.getOrSet(
        cacheStrategies.user.preferences,
        userKey,
        async () => {
          // Load user preferences from database
          return { userId, preferences: {}, loadedAt: new Date().toISOString() };
        }
      ),
    ]);

    logInfo('User cache warmed up', { userId });
  }

  /**
   * Cache warming for warehouse operations
   */
  static async warmUpWarehouseCache(): Promise<void> {
    await Promise.allSettled([
      // Preload frequently accessed warehouse data
      this.getOrSet(
        cacheStrategies.position.structure,
        'warehouse:structure',
        async () => {
          // Load warehouse structure from database
          return { structure: 'warehouse', loadedAt: new Date().toISOString() };
        }
      ),
      this.getOrSet(
        cacheStrategies.system.config,
        'warehouse:config',
        async () => {
          // Load system configuration
          return { config: {}, loadedAt: new Date().toISOString() };
        }
      ),
    ]);

    logInfo('Warehouse cache warmed up');
  }
}

// Export cache strategies and service
export { cacheStrategies as strategies, StrategicCacheService as strategicCache };