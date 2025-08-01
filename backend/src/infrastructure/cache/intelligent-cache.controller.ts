/**
 * Intelligent Cache Controller
 * 
 * Demonstrates advanced caching patterns and provides management endpoints
 * for monitoring and controlling the intelligent cache system.
 */

import { Request, Response } from 'express';
import { intelligentCache } from './intelligent-cache.service.js';
import { cacheAsideService } from './cache-aside.service.js';
import { cacheService } from './cache.service.js';
import { QueryCache, CacheInvalidation, ConditionalCache } from './query-cache.decorator.js';
import { logInfo, logError } from '../../utils/logger.js';

@CacheInvalidation('products')
export class IntelligentCacheController {
  
  /**
   * Get cache analytics and performance metrics
   */
  async getCacheAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const analytics = intelligentCache.getCacheAnalytics();
      const cacheAsideStats = cacheAsideService.getStatistics();
      const basicStats = cacheService.getStats();

      const combinedAnalytics = {
        system: {
          l1Cache: analytics.l1Stats,
          l2Cache: analytics.l2Stats,
          basic: basicStats,
        },
        queries: {
          totalTracked: analytics.queryStats.length,
          topByAccess: analytics.queryStats
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, 10),
          byVolatility: {
            high: analytics.queryStats.filter(q => q.volatility === 'high').length,
            medium: analytics.queryStats.filter(q => q.volatility === 'medium').length,
            low: analytics.queryStats.filter(q => q.volatility === 'low').length,
          },
        },
        dependencies: {
          totalDependencies: analytics.dependencyGraph.length,
          topByQueries: analytics.dependencyGraph
            .sort((a, b) => b.affectedQueries - a.affectedQueries)
            .slice(0, 10),
        },
        cacheAside: {
          entries: cacheAsideStats.totalEntries,
          refreshJobs: cacheAsideStats.refreshJobs,
          refreshInProgress: cacheAsideStats.refreshInProgress,
          topHitRates: cacheAsideStats.topHitRates,
          avgLoadTimes: cacheAsideStats.avgLoadTimes,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: combinedAnalytics,
      });
    } catch (error) {
      logError('Error getting cache analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get cache analytics',
      });
    }
  }

  /**
   * Warm cache with intelligent strategies
   */
  async warmCache(req: Request, res: Response): Promise<void> {
    try {
      const { queries = [], force = false } = req.body;

      if (force) {
        logInfo('Forcing cache warm with custom queries', { queryCount: queries.length });
      }

      await intelligentCache.warmCache({
        enabled: true,
        scheduleInterval: 15,
        queries: queries.length > 0 ? queries : [
          // Default warming queries for WMS
          {
            query: 'getUserProfile',
            params: [],
            priority: 'high' as const,
            maxAge: 300,
          },
          {
            query: 'getWarehouseStructure',
            params: [],
            priority: 'high' as const,
            maxAge: 1800,
          },
          {
            query: 'getActiveProducts',
            params: [100], // limit
            priority: 'medium' as const,
            maxAge: 600,
          },
        ],
      });

      res.json({
        success: true,
        message: 'Cache warming initiated',
        queryCount: queries.length || 3,
      });
    } catch (error) {
      logError('Error warming cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to warm cache',
      });
    }
  }

  /**
   * Invalidate cache by dependency
   */
  async invalidateByDependency(req: Request, res: Response): Promise<void> {
    try {
      const { dependency } = req.params;
      const { cascade = false } = req.query;

      let invalidatedCount = 0;

      if (cascade) {
        // Invalidate related dependencies as well
        const relatedDependencies = this.getRelatedDependencies(dependency);
        for (const dep of [dependency, ...relatedDependencies]) {
          invalidatedCount += await intelligentCache.invalidateByDependency(dep);
        }
      } else {
        invalidatedCount = await intelligentCache.invalidateByDependency(dependency);
      }

      logInfo('Cache invalidated by dependency', {
        dependency,
        cascade,
        invalidatedCount,
      });

      res.json({
        success: true,
        dependency,
        invalidatedCount,
        cascade,
      });
    } catch (error) {
      logError('Error invalidating cache by dependency', {
        dependency: req.params.dependency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache',
      });
    }
  }

  /**
   * Force refresh specific cache keys
   */
  async forceRefresh(req: Request, res: Response): Promise<void> {
    try {
      const { keys } = req.body;
      
      if (!Array.isArray(keys) || keys.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Keys array is required',
        });
        return;
      }

      const results = await Promise.allSettled(
        keys.map(async (key: string) => {
          // This would need to be implemented with actual data loaders
          // For demo purposes, we'll simulate the refresh
          return await cacheAsideService.forceRefresh(
            key,
            async () => ({ key, refreshedAt: new Date(), simulated: true }),
            []
          );
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      res.json({
        success: true,
        results: {
          total: keys.length,
          successful,
          failed,
        },
      });
    } catch (error) {
      logError('Error force refreshing cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to force refresh cache',
      });
    }
  }

  /**
   * Configure cache refresh policies
   */
  async configureRefreshPolicy(req: Request, res: Response): Promise<void> {
    try {
      const policy = req.body;
      
      // Validate policy
      const validKeys = [
        'enabled',
        'refreshThreshold',
        'maxConcurrentRefresh',
        'minRefreshInterval',
        'priority',
      ];
      
      const isValid = Object.keys(policy).every(key => validKeys.includes(key));
      
      if (!isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid policy configuration',
          validKeys,
        });
        return;
      }

      cacheAsideService.setRefreshPolicy(policy);

      res.json({
        success: true,
        message: 'Refresh policy updated',
        policy,
      });
    } catch (error) {
      logError('Error configuring refresh policy', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to configure refresh policy',
      });
    }
  }

  /**
   * Demonstrate advanced caching patterns
   */
  @QueryCache({
    key: 'demo.getProductData.{0}',
    volatility: 'medium',
    dependencies: ['products', 'inventory'],
    useL1Cache: true,
  })
  async demoQueryCaching(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      
      // Simulate expensive database query
      const productData = await this.simulateExpensiveQuery(parseInt(productId));
      
      res.json({
        success: true,
        data: productData,
        cached: true,
        note: 'This result is automatically cached using @QueryCache decorator',
      });
    } catch (error) {
      logError('Error in demo query caching', {
        productId: req.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Demo query failed',
      });
    }
  }

  /**
   * Demonstrate conditional caching
   */
  @ConditionalCache(
    (req: Request) => {
      // Only cache if user is not admin (admins always get fresh data)
      const user = (req as any).user;
      return user?.role !== 'admin';
    },
    {
      key: 'demo.conditionalData.{0}',
      volatility: 'low',
      dependencies: ['system_config'],
    }
  )
  async demoConditionalCaching(req: Request, res: Response): Promise<void> {
    try {
      const { configType } = req.params;
      const user = (req as any).user;
      
      const configData = await this.simulateConfigQuery(configType);
      
      res.json({
        success: true,
        data: configData,
        cached: user?.role !== 'admin',
        note: user?.role === 'admin' 
          ? 'Admin users bypass cache for fresh data'
          : 'Result cached for non-admin users',
      });
    } catch (error) {
      logError('Error in demo conditional caching', {
        configType: req.params.configType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Demo conditional cache failed',
      });
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(req: Request, res: Response): Promise<void> {
    try {
      const { confirm } = req.body;
      
      if (confirm !== 'yes') {
        res.status(400).json({
          success: false,
          error: 'Confirmation required. Send { "confirm": "yes" } to proceed',
        });
        return;
      }

      await intelligentCache.clearAll();
      
      logInfo('All caches cleared via API');

      res.json({
        success: true,
        message: 'All caches cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logError('Error clearing all caches', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to clear caches',
      });
    }
  }

  // Private helper methods

  private getRelatedDependencies(dependency: string): string[] {
    // Define dependency relationships for cascade invalidation
    const dependencyMap: Record<string, string[]> = {
      products: ['inventory', 'product_stock', 'search'],
      pallets: ['positions', 'pallet_positions'],
      ucps: ['ucp_items', 'transfers'],
      users: ['sessions', 'preferences'],
      positions: ['occupancy', 'warehouse_structure'],
    };

    return dependencyMap[dependency] || [];
  }

  private async simulateExpensiveQuery(productId: number): Promise<any> {
    // Simulate database query delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: productId,
      name: `Product ${productId}`,
      stock: Math.floor(Math.random() * 1000),
      price: Math.round(Math.random() * 10000) / 100,
      lastUpdated: new Date().toISOString(),
      queryTime: 100,
    };
  }

  private async simulateConfigQuery(configType: string): Promise<any> {
    // Simulate configuration query
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      type: configType,
      settings: {
        enabled: true,
        timeout: 30000,
        retries: 3,
      },
      lastModified: new Date().toISOString(),
      queryTime: 50,
    };
  }
}

export const intelligentCacheController = new IntelligentCacheController();