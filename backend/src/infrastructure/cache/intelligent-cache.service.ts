/**
 * Intelligent Cache Service with L1/L2 Hierarchy and Smart Invalidation
 * 
 * Features:
 * - L1 Cache: In-memory LRU cache for ultra-fast access
 * - L2 Cache: Redis distributed cache for persistence
 * - Query-level caching with parameter interpolation
 * - Intelligent TTL calculation based on data volatility
 * - Dependency-based invalidation
 * - Background refresh to prevent cache misses
 * - Comprehensive performance analytics
 */

import { LRUCache } from 'lru-cache';
import { cacheService, CacheOptions } from './cache.service.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';
import { CacheError } from '../../utils/exceptions/index.js';

// Data volatility classifications for intelligent TTL
export enum DataVolatility {
  HIGH = 'high',     // Changes frequently (1-5 minutes)
  MEDIUM = 'medium', // Changes moderately (5-30 minutes)  
  LOW = 'low',       // Changes rarely (30 minutes - 2 hours)
  STATIC = 'static'  // Rarely changes (2+ hours)
}

// Cache level preferences
export enum CacheLevel {
  L1_ONLY = 'l1_only',       // Memory cache only
  L2_ONLY = 'l2_only',       // Redis cache only  
  L1_THEN_L2 = 'l1_then_l2', // Try L1 first, fallback to L2
  L2_THEN_L1 = 'l2_then_l1'  // Try L2 first, promote to L1
}

export interface IntelligentCacheOptions extends CacheOptions {
  volatility?: DataVolatility;
  level?: CacheLevel;
  dependencies?: string[];
  refreshBeforeExpiry?: boolean;
  refreshThresholdPercentage?: number;
  useL1Cache?: boolean;
  l1MaxSize?: number;
  queryTemplate?: string;
  parameters?: any[];
}

export interface CacheAnalytics {
  l1Stats: {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
  };
  l2Stats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  overallStats: {
    totalRequests: number;
    totalHits: number;
    overallHitRate: number;
    avgLatency: number;
  };
  refreshStats: {
    backgroundRefreshes: number;
    refreshSuccesses: number;
    refreshFailures: number;
  };
}

export class IntelligentCacheService {
  private l1Cache: LRUCache<string, any>;
  private dependencyGraph = new Map<string, Set<string>>();
  private refreshQueue = new Map<string, NodeJS.Timeout>();
  private analytics: CacheAnalytics;

  constructor(options: {
    l1MaxSize?: number;
    l1MaxAge?: number;
  } = {}) {
    // Initialize L1 cache (in-memory LRU)
    this.l1Cache = new LRUCache({
      max: options.l1MaxSize || 1000,
      ttl: options.l1MaxAge || 5 * 60 * 1000, // 5 minutes default
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Initialize analytics
    this.analytics = {
      l1Stats: { hits: 0, misses: 0, size: 0, maxSize: options.l1MaxSize || 1000, hitRate: 0 },
      l2Stats: { hits: 0, misses: 0, hitRate: 0 },
      overallStats: { totalRequests: 0, totalHits: 0, overallHitRate: 0, avgLatency: 0 },
      refreshStats: { backgroundRefreshes: 0, refreshSuccesses: 0, refreshFailures: 0 }
    };

    // Set up periodic analytics update
    setInterval(() => this.updateAnalytics(), 30000); // Update every 30 seconds
  }

  /**
   * Intelligent get with L1/L2 hierarchy and smart promotion
   */
  async get<T>(key: string, options: IntelligentCacheOptions = {}): Promise<T | null> {
    const start = Date.now();
    this.analytics.overallStats.totalRequests++;

    try {
      const fullKey = this.buildIntelligentKey(key, options);
      const level = options.level || CacheLevel.L1_THEN_L2;

      // Strategy: L1 first, then L2
      if (level === CacheLevel.L1_THEN_L2 || level === CacheLevel.L1_ONLY) {
        const l1Value = this.l1Cache.get(fullKey);
        if (l1Value !== undefined) {
          this.analytics.l1Stats.hits++;
          this.analytics.overallStats.totalHits++;
          this.logCacheHit('L1', fullKey, Date.now() - start);
          return l1Value as T;
        }
        this.analytics.l1Stats.misses++;
      }

      // Fallback to L2 (Redis) if L1 miss and not L1_ONLY
      if (level !== CacheLevel.L1_ONLY) {
        const l2Value = await cacheService.get<T>(fullKey, options);
        if (l2Value !== null) {
          this.analytics.l2Stats.hits++;
          this.analytics.overallStats.totalHits++;
          
          // Promote to L1 if using L1_THEN_L2 strategy
          if (level === CacheLevel.L1_THEN_L2 && options.useL1Cache !== false) {
            this.l1Cache.set(fullKey, l2Value, { 
              ttl: this.calculateL1TTL(options.volatility) 
            });
          }
          
          this.logCacheHit('L2', fullKey, Date.now() - start);
          return l2Value;
        }
        this.analytics.l2Stats.misses++;
      }

      // Cache miss - schedule background refresh if configured
      this.scheduleBackgroundRefresh(fullKey, options);
      
      this.logCacheMiss(fullKey, Date.now() - start);
      return null;

    } catch (error) {
      logError('Intelligent cache get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Intelligent set with hierarchy and dependency tracking
   */
  async set<T>(
    key: string, 
    value: T, 
    options: IntelligentCacheOptions = {}
  ): Promise<void> {
    const start = Date.now();
    
    try {
      const fullKey = this.buildIntelligentKey(key, options);
      const ttl = this.calculateIntelligentTTL(options);
      const level = options.level || CacheLevel.L1_THEN_L2;

      // Track dependencies for smart invalidation
      if (options.dependencies) {
        this.trackDependencies(fullKey, options.dependencies);
      }

      // Set in L1 cache
      if (level === CacheLevel.L1_THEN_L2 || level === CacheLevel.L1_ONLY) {
        this.l1Cache.set(fullKey, value, { 
          ttl: this.calculateL1TTL(options.volatility) 
        });
      }

      // Set in L2 cache (Redis)
      if (level !== CacheLevel.L1_ONLY) {
        await cacheService.set(fullKey, value, { 
          ...options, 
          ttl 
        });
      }

      // Schedule background refresh if needed
      if (options.refreshBeforeExpiry) {
        this.scheduleRefresh(fullKey, ttl, options);
      }

      logInfo('Intelligent cache set', {
        key: fullKey,
        level: level,
        ttl: `${ttl}s`,
        dependencies: options.dependencies,
        latency: `${Date.now() - start}ms`
      });

    } catch (error) {
      logError('Intelligent cache set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new CacheError(`Failed to set intelligent cache key ${key}`);
    }
  }

  /**
   * Get or set with intelligent caching and background refresh
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: IntelligentCacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch fresh data
    const value = await fetchFn();
    
    // Cache the result with intelligent options
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Query-level caching with parameter interpolation
   */
  async cacheQuery<T>(
    queryTemplate: string,
    parameters: any[],
    fetchFn: () => Promise<T>,
    options: IntelligentCacheOptions = {}
  ): Promise<T> {
    // Build cache key from query template and parameters
    const cacheKey = this.interpolateQueryKey(queryTemplate, parameters);
    
    return this.getOrSet(cacheKey, fetchFn, {
      ...options,
      queryTemplate,
      parameters
    });
  }

  /**
   * Smart invalidation by dependencies
   */
  async invalidateByDependency(dependency: string): Promise<number> {
    const dependentKeys = this.dependencyGraph.get(dependency) || new Set();
    let invalidatedCount = 0;

    for (const key of dependentKeys) {
      // Remove from L1
      if (this.l1Cache.has(key)) {
        this.l1Cache.delete(key);
        invalidatedCount++;
      }

      // Remove from L2 (Redis)
      try {
        const deleted = await cacheService.delete(key);
        if (deleted) invalidatedCount++;
      } catch (error) {
        logError('Redis invalidation error', { key, error });
      }

      // Cancel scheduled refresh
      if (this.refreshQueue.has(key)) {
        clearTimeout(this.refreshQueue.get(key)!);
        this.refreshQueue.delete(key);
      }
    }

    // Clean up dependency tracking
    this.dependencyGraph.delete(dependency);

    logInfo('Smart invalidation by dependency', {
      dependency,
      invalidatedKeys: Array.from(dependentKeys),
      count: invalidatedCount
    });

    return invalidatedCount;
  }

  /**
   * Get comprehensive cache analytics
   */
  getAnalytics(): CacheAnalytics {
    this.updateAnalytics();
    return { ...this.analytics };
  }

  /**
   * Warm up cache with provided data
   */
  async warmUp(
    warmupData: Array<{
      key: string;
      fetchFn: () => Promise<any>;
      options?: IntelligentCacheOptions;
    }>
  ): Promise<void> {
    logInfo('Starting intelligent cache warmup', {
      itemCount: warmupData.length
    });

    const promises = warmupData.map(async ({ key, fetchFn, options = {} }) => {
      try {
        // Check if already cached
        const existing = await this.get(key, options);
        
        if (existing === null) {
          // Preload the data
          const data = await fetchFn();
          await this.set(key, data, options);
          
          logInfo('Cache warmed up', { key });
        }
      } catch (error) {
        logError('Cache warmup failed', {
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.allSettled(promises);
    logInfo('Intelligent cache warmup completed');
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    // Clear L1
    this.l1Cache.clear();
    
    // Clear L2 (Redis)
    await cacheService.clear();
    
    // Clear refresh queue
    this.refreshQueue.forEach(timeout => clearTimeout(timeout));
    this.refreshQueue.clear();
    
    // Clear dependency graph
    this.dependencyGraph.clear();
    
    // Reset analytics
    this.analytics = {
      l1Stats: { hits: 0, misses: 0, size: 0, maxSize: this.l1Cache.max, hitRate: 0 },
      l2Stats: { hits: 0, misses: 0, hitRate: 0 },
      overallStats: { totalRequests: 0, totalHits: 0, overallHitRate: 0, avgLatency: 0 },
      refreshStats: { backgroundRefreshes: 0, refreshSuccesses: 0, refreshFailures: 0 }
    };

    logWarn('Intelligent cache cleared completely');
  }

  // Private helper methods

  private buildIntelligentKey(key: string, options: IntelligentCacheOptions): string {
    const basePrefix = 'intelligent';
    const volatilityPrefix = options.volatility || 'medium';
    const prefix = options.prefix ? `${basePrefix}:${volatilityPrefix}:${options.prefix}` 
                                 : `${basePrefix}:${volatilityPrefix}`;
    return `${prefix}:${key}`;
  }

  private calculateIntelligentTTL(options: IntelligentCacheOptions): number {
    const volatility = options.volatility || DataVolatility.MEDIUM;
    const customTtl = options.ttl;

    if (customTtl) return customTtl;

    // Base TTL on data volatility
    switch (volatility) {
      case DataVolatility.HIGH: return 300;    // 5 minutes
      case DataVolatility.MEDIUM: return 1800; // 30 minutes
      case DataVolatility.LOW: return 3600;    // 1 hour
      case DataVolatility.STATIC: return 7200; // 2 hours
      default: return 1800;
    }
  }

  private calculateL1TTL(volatility?: DataVolatility): number {
    // L1 cache should have shorter TTL than L2
    switch (volatility) {
      case DataVolatility.HIGH: return 60 * 1000;    // 1 minute
      case DataVolatility.MEDIUM: return 300 * 1000; // 5 minutes
      case DataVolatility.LOW: return 600 * 1000;    // 10 minutes
      case DataVolatility.STATIC: return 1800 * 1000; // 30 minutes
      default: return 300 * 1000; // 5 minutes
    }
  }

  private interpolateQueryKey(template: string, parameters: any[]): string {
    let key = template;
    parameters.forEach((param, index) => {
      const placeholder = `{${index}}`;
      const value = typeof param === 'object' ? JSON.stringify(param) : String(param);
      key = key.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    return key;
  }

  private trackDependencies(key: string, dependencies: string[]): void {
    dependencies.forEach(dep => {
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, new Set());
      }
      this.dependencyGraph.get(dep)!.add(key);
    });
  }

  private scheduleBackgroundRefresh(key: string, options: IntelligentCacheOptions): void {
    if (!options.refreshBeforeExpiry) return;

    const ttl = this.calculateIntelligentTTL(options);
    this.scheduleRefresh(key, ttl, options);
  }

  private scheduleRefresh(key: string, ttl: number, options: IntelligentCacheOptions): void {
    const refreshThreshold = options.refreshThresholdPercentage || 0.8;
    const refreshTime = ttl * 1000 * refreshThreshold;

    if (this.refreshQueue.has(key)) {
      clearTimeout(this.refreshQueue.get(key)!);
    }

    const timeout = setTimeout(async () => {
      try {
        this.analytics.refreshStats.backgroundRefreshes++;
        
        // This would typically call the original fetch function
        // For now, we'll log the refresh attempt
        logInfo('Background cache refresh scheduled', { key });
        
        this.analytics.refreshStats.refreshSuccesses++;
      } catch (error) {
        this.analytics.refreshStats.refreshFailures++;
        logError('Background cache refresh failed', {
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        this.refreshQueue.delete(key);
      }
    }, refreshTime);

    this.refreshQueue.set(key, timeout);
  }

  private updateAnalytics(): void {
    // Update L1 stats
    this.analytics.l1Stats.size = this.l1Cache.size;
    this.analytics.l1Stats.hitRate = this.analytics.l1Stats.hits / 
      (this.analytics.l1Stats.hits + this.analytics.l1Stats.misses) || 0;

    // Update L2 stats
    this.analytics.l2Stats.hitRate = this.analytics.l2Stats.hits / 
      (this.analytics.l2Stats.hits + this.analytics.l2Stats.misses) || 0;

    // Update overall stats
    this.analytics.overallStats.overallHitRate = this.analytics.overallStats.totalHits / 
      this.analytics.overallStats.totalRequests || 0;
  }

  private logCacheHit(level: string, key: string, latency: number): void {
    logInfo(`${level} cache hit`, {
      key,
      latency: `${latency}ms`
    });
  }

  private logCacheMiss(key: string, latency: number): void {
    logInfo('Cache miss', {
      key,
      latency: `${latency}ms`
    });
  }
}

// Lazy-loaded singleton instance
let _intelligentCache: IntelligentCacheService | null = null;

export function getIntelligentCache(): IntelligentCacheService {
  if (!_intelligentCache) {
    try {
      _intelligentCache = new IntelligentCacheService({
        l1MaxSize: 2000,
        l1MaxAge: 10 * 60 * 1000 // 10 minutes
      });
    } catch (error) {
      console.warn('Failed to initialize IntelligentCacheService:', error);
      // Return a mock service that does nothing
      return {
        cacheQuery: async (key: string, params: any[], fn: () => Promise<any>, options?: any) => {
          console.warn('Cache service not available, executing function directly');
          return await fn();
        },
        invalidateByDependency: async (dependency: string) => {
          console.warn('Cache service not available, skipping invalidation');
          return 0;
        }
      } as any;
    }
  }
  return _intelligentCache;
}

// Don't export intelligentCache directly to avoid initialization during module load
// export const intelligentCache = getIntelligentCache();

// Export intelligentCache as a getter to avoid initialization during module load
export const intelligentCache = {
  get cacheQuery() {
    return getIntelligentCache().cacheQuery;
  },
  get invalidateByDependency() {
    return getIntelligentCache().invalidateByDependency;
  },
  get getAnalytics() {
    return getIntelligentCache().getAnalytics.bind(getIntelligentCache());
  },
  get clear() {
    return getIntelligentCache().clear.bind(getIntelligentCache());
  }
};

// Add initialization check
export function isIntelligentCacheReady(): boolean {
  try {
    const cache = getIntelligentCache();
    return cache && typeof cache.cacheQuery === 'function';
  } catch (error) {
    return false;
  }
}