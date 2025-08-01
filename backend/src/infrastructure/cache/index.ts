/**
 * Cache Infrastructure Barrel Export
 * 
 * Centralizes all caching functionality including:
 * - Redis client
 * - Cache service
 * - Cache strategies
 * - Distributed locking
 */

// Legacy Redis client exports (for backward compatibility)
export {
  redisClient,
  connectRedis,
  disconnectRedis,
  isRedisConnected,
  checkRedisHealth,
  setCache,
  getCache,
  deleteCache,
  clearCache,
  getCacheKeys,
  getCacheStats,
} from './redis.client.js';

// Import services first
import { cacheService, CacheService } from './cache.service.js';
import { 
  strategies, 
  strategicCache, 
  StrategicCacheService,
  cacheStrategies 
} from './strategies.js';

// Advanced cache service exports
export { cacheService, CacheService } from './cache.service.js';
export type { CacheOptions, CacheStats } from './cache.service.js';

// Strategy exports
export { 
  strategies, 
  strategicCache, 
  StrategicCacheService,
  cacheStrategies 
} from './strategies.js';
export type { CacheStrategy } from './strategies.js';

// Convenience re-exports for common operations
export const cache = {
  // Basic operations
  get: cacheService.get.bind(cacheService),
  set: cacheService.set.bind(cacheService),
  delete: cacheService.delete.bind(cacheService),
  getOrSet: cacheService.getOrSet.bind(cacheService),
  
  // Bulk operations
  invalidateByTags: cacheService.invalidateByTags.bind(cacheService),
  clear: cacheService.clear.bind(cacheService),
  
  // Monitoring
  getStats: cacheService.getStats.bind(cacheService),
  healthCheck: cacheService.healthCheck.bind(cacheService),
  
  // Distributed locking
  acquireLock: cacheService.acquireLock.bind(cacheService),
  releaseLock: cacheService.releaseLock.bind(cacheService),
  
  // Strategic operations
  strategic: strategicCache,
  strategies,
} as const;

// Advanced cache services
export { intelligentCache, IntelligentCacheService } from './intelligent-cache.service.js';
export type { QueryCacheMetadata, CacheWarmingConfig } from './intelligent-cache.service.js';

export { cacheAsideService, CacheAsideService } from './cache-aside.service.js';

// Decorators and utilities
export {
  QueryCache,
  CacheInvalidation,
  CacheWarm,
  ConditionalCache,
  RefreshCache,
  MultiLevelCache,
  CacheOperations,
} from './query-cache.decorator.js';
export type { QueryCacheOptions } from './query-cache.decorator.js';

// Controller for management endpoints
export { intelligentCacheController, IntelligentCacheController } from './intelligent-cache.controller.js';

// Export unified cache interface as default
export default cache;