/**
 * Query Cache Decorator
 * 
 * Decorator for automatic query result caching with intelligent invalidation.
 * Provides declarative caching for database queries and service methods.
 */

import { logInfo, logError, logWarn } from '../../utils/logger.js';

// Decorator options
export interface QueryCacheOptions {
  /** Cache key template (can use parameter placeholders like {0}, {1}) */
  key?: string;
  /** Data volatility level */
  volatility?: 'low' | 'medium' | 'high';
  /** Dependencies for smart invalidation */
  dependencies?: string[];
  /** Use L1 cache */
  useL1Cache?: boolean;
  /** Custom TTL in seconds */
  ttl?: number;
  /** Condition function to determine if result should be cached */
  condition?: (result: any) => boolean;
}

/**
 * Method decorator for automatic query caching
 */
export function QueryCache(options: QueryCacheOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    // Check if this is a method decorator (has descriptor.value)
    if (!descriptor || !descriptor.value) {
      // This might be a class decorator or property decorator, skip it
      return;
    }
    
    const method = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      const {
        key = `${className}.${propertyName}`,
        volatility = 'medium',
        dependencies = [],
        useL1Cache = true,
        condition = () => true,
      } = options;

      // Build cache key from template
      const cacheKey = buildCacheKeyFromTemplate(key, args);
      
      // Always execute the method first, then try to cache if available
      const methodResult = await method.apply(this, args);
      
      // Check if result should be cached
      if (!condition(methodResult)) {
        return methodResult;
      }
      
      // Try to use cache service, but don't fail if not available
      try {
        // Dynamically import the cache service to avoid initialization issues
        const { getIntelligentCache } = await import('./intelligent-cache.service.js');
        const intelligentCache = getIntelligentCache();
        
        if (intelligentCache && typeof intelligentCache.cacheQuery === 'function') {
          // Cache the result asynchronously (don't wait for it)
          intelligentCache.cacheQuery(
            cacheKey,
            args, // Parameters
            async () => methodResult,
            {
              dependencies,
              volatility,
              useL1Cache,
            } as any
          ).catch(error => {
            logError('Cache operation failed', {
              className,
              methodName: propertyName,
              cacheKey,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        }
      } catch (error) {
        // Cache service not available, just log and continue
        logWarn('Cache service not available', {
          className,
          methodName: propertyName,
          cacheKey,
        });
      }

      return methodResult;
    };

    return descriptor;
  };
}

/**
 * Class decorator for automatic cache invalidation on entity changes
 */
export function CacheInvalidation(entityName: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      async invalidateCache(): Promise<void> {
        try {
          // Check if intelligentCache is available
          const { isIntelligentCacheReady } = await import('./intelligent-cache.service.js');
          if (!isIntelligentCacheReady()) {
            logWarn('Intelligent cache not available for invalidation', {
              entityName,
            });
            return;
          }
          
          const { getIntelligentCache } = await import('./intelligent-cache.service.js');
          const intelligentCache = getIntelligentCache();
          const count = await intelligentCache.invalidateByDependency(entityName);
          logInfo('Cache invalidated by entity', {
            entityName,
            invalidatedCount: count,
          });
        } catch (error) {
          logError('Cache invalidation error', {
            entityName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };
  };
}

/**
 * Cache warming decorator for frequently accessed methods
 */
export function CacheWarm(options: {
  priority: 'high' | 'medium' | 'low';
  schedule?: string; // Cron-like schedule
  args?: any[]; // Arguments to use for warming
}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const className = target.constructor.name;

    // Register for warming (this would integrate with a warming scheduler)
    registerWarmingMethod(className, propertyName, options);

    return descriptor;
  };
}

// Helper functions

function buildCacheKeyFromTemplate(template: string, args: any[]): string {
  let key = template;
  
  // Replace parameter placeholders {0}, {1}, etc.
  args.forEach((arg, index) => {
    const placeholder = `{${index}}`;
    if (key.includes(placeholder)) {
      const argString = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      key = key.replace(placeholder, argString);
    }
  });
  
  return key;
}

function registerWarmingMethod(
  className: string,
  methodName: string,
  options: {
    priority: 'high' | 'medium' | 'low';
    schedule?: string;
    args?: any[];
  }
): void {
  // This would register the method for cache warming
  // Implementation would depend on your warming scheduler
  logInfo('Method registered for cache warming', {
    className,
    methodName,
    priority: options.priority,
  });
}

// Advanced caching decorators

/**
 * Conditional caching based on method parameters
 */
export function ConditionalCache(condition: (...args: any[]) => boolean, options: QueryCacheOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    // Check if this is a method decorator (has descriptor.value)
    if (!descriptor || !descriptor.value) {
      // This might be a class decorator or property decorator, skip it
      return;
    }
    
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (condition(...args)) {
        // Apply caching
        const cacheDecorator = QueryCache(options);
        const cachedDescriptor = cacheDecorator(target, propertyName, descriptor);
        if (cachedDescriptor && cachedDescriptor.value) {
          return await cachedDescriptor.value.apply(this, args);
        }
        return await method.apply(this, args);
      } else {
        // Execute without caching
        return await method.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Cache with automatic refresh for frequently accessed data
 */
export function RefreshCache(refreshIntervalSeconds: number, options: QueryCacheOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const className = target.constructor.name;
    let lastRefresh = 0;

    descriptor.value = async function (...args: any[]) {
      const now = Date.now();
      const shouldRefresh = (now - lastRefresh) > (refreshIntervalSeconds * 1000);

      if (shouldRefresh) {
        // Force refresh
        const { getIntelligentCache } = await import('./intelligent-cache.service.js');
        const intelligentCache = getIntelligentCache();
        const result = await intelligentCache.cacheQuery(
          `${className}.${propertyName}`,
          args,
          () => method.apply(this, args),
          options as any
        );
        
        lastRefresh = now;
        return result;
      } else {
        // Normal cached execution
        const cacheDecorator = QueryCache(options);
        const cachedDescriptor = cacheDecorator(target, propertyName, descriptor);
        if (cachedDescriptor && cachedDescriptor.value) {
          return await cachedDescriptor.value.apply(this, args);
        }
        return await method.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Multi-level caching with different strategies for different scenarios
 */
export function MultiLevelCache(configs: {
  [scenario: string]: QueryCacheOptions & { condition: (...args: any[]) => boolean };
}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Find matching scenario
      for (const [scenario, config] of Object.entries(configs)) {
        if (config.condition(...args)) {
          const { condition, ...cacheOptions } = config;
          const cacheDecorator = QueryCache(cacheOptions);
          const cachedDescriptor = cacheDecorator(target, propertyName, descriptor);
          if (cachedDescriptor && cachedDescriptor.value) {
            return await cachedDescriptor.value.apply(this, args);
          }
          return await method.apply(this, args);
        }
      }

      // No scenario matched, execute without caching
      return await method.apply(this, args);
    };

    return descriptor;
  };
}

// Export helper for manual cache operations
export const CacheOperations = {
  /**
   * Manually cache a result
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      dependencies?: string[];
      volatility?: 'low' | 'medium' | 'high';
      useL1Cache?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const { getIntelligentCache } = await import('./intelligent-cache.service.js');
      const intelligentCache = getIntelligentCache();
      if (!intelligentCache || typeof intelligentCache.cacheQuery !== 'function') {
        logWarn('Intelligent cache not available for manual set', { key });
        return;
      }
      await intelligentCache.cacheQuery(
        key,
        [],
        async () => value,
        options as any
      );
    } catch (error) {
      logError('Manual cache set error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  },

  /**
   * Manually get from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const { getIntelligentCache } = await import('./intelligent-cache.service.js');
      const intelligentCache = getIntelligentCache();
      if (!intelligentCache || typeof intelligentCache.cacheQuery !== 'function') {
        logWarn('Intelligent cache not available for manual get', { key });
        return null;
      }
      return await intelligentCache.cacheQuery(
        key,
        [],
        async () => {
          throw new Error('NOT_FOUND');
        }
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return null;
      }
      logError('Manual cache get error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  },

  /**
   * Manually invalidate cache
   */
  async invalidate(dependency: string): Promise<number> {
    try {
      const { getIntelligentCache } = await import('./intelligent-cache.service.js');
      const intelligentCache = getIntelligentCache();
      if (!intelligentCache || typeof intelligentCache.invalidateByDependency !== 'function') {
        logWarn('Intelligent cache not available for manual invalidate', { dependency });
        return 0;
      }
      return await intelligentCache.invalidateByDependency(dependency);
    } catch (error) {
      logError('Manual cache invalidate error', { dependency, error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  },
};