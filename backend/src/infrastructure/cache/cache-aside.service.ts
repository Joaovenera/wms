/**
 * Cache-Aside Pattern with Automated Background Refresh
 * 
 * Implements the cache-aside pattern with intelligent background refresh
 * to prevent cache misses and reduce database load for frequently accessed data.
 */

import { intelligentCache } from './intelligent-cache.service.js';
import { cacheService } from './cache.service.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';
import { EventEmitter } from 'events';

// Background refresh configuration
interface RefreshPolicy {
  /** Enable background refresh */
  enabled: boolean;
  /** Refresh when cache age reaches this percentage of TTL */
  refreshThreshold: number;
  /** Maximum number of concurrent refresh operations */
  maxConcurrentRefresh: number;
  /** Minimum interval between refreshes for the same key (seconds) */
  minRefreshInterval: number;
  /** Priority for refresh operations */
  priority: 'high' | 'medium' | 'low';
}

// Data loader function type
type DataLoader<T> = (...args: any[]) => Promise<T>;

// Refresh job
interface RefreshJob {
  key: string;
  loader: DataLoader<any>;
  args: any[];
  priority: 'high' | 'medium' | 'low';
  scheduledAt: Date;
  lastRefresh?: Date;
}

// Cache entry metadata
interface CacheEntryMetadata {
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  hitRate: number;
  avgLoadTime: number;
  totalLoadTime: number;
  loadCount: number;
}

export class CacheAsideService extends EventEmitter {
  private refreshJobs: Map<string, RefreshJob> = new Map();
  private entryMetadata: Map<string, CacheEntryMetadata> = new Map();
  private refreshInProgress: Set<string> = new Set();
  private isProcessingJobs = false;

  private defaultRefreshPolicy: RefreshPolicy = {
    enabled: true,
    refreshThreshold: 0.7, // Refresh when 70% of TTL has passed
    maxConcurrentRefresh: 5,
    minRefreshInterval: 60, // 1 minute
    priority: 'medium',
  };

  constructor() {
    super();
    this.initializeRefreshProcessor();
  }

  /**
   * Get data with cache-aside pattern and background refresh
   */
  async get<T>(
    key: string,
    loader: DataLoader<T>,
    options: {
      args?: any[];
      ttl?: number;
      dependencies?: string[];
      volatility?: 'low' | 'medium' | 'high';
      refreshPolicy?: Partial<RefreshPolicy>;
      useL1Cache?: boolean;
    } = {}
  ): Promise<T> {
    const {
      args = [],
      ttl = 300,
      dependencies = [],
      volatility = 'medium',
      refreshPolicy = {},
      useL1Cache = true,
    } = options;

    const policy = { ...this.defaultRefreshPolicy, ...refreshPolicy };
    const startTime = Date.now();

    try {
      // Try to get from cache first
      const result = await intelligentCache.cacheQuery(
        key,
        args,
        async () => {
          // Cache miss - load data
          const loadStart = Date.now();
          const data = await loader(...args);
          const loadTime = Date.now() - loadStart;
          
          this.updateLoadMetrics(key, loadTime);
          
          logInfo('Data loaded for cache-aside', {
            key,
            loadTime: `${loadTime}ms`,
            args,
          });
          
          return data;
        },
        {
          dependencies,
          volatility: volatility as any,
          useL1Cache,
        }
      );

      // Update access metrics
      this.updateAccessMetrics(key);

      // Schedule background refresh if needed
      if (policy.enabled) {
        await this.scheduleRefreshIfNeeded(key, loader, args, policy, ttl);
      }

      const totalTime = Date.now() - startTime;
      logInfo('Cache-aside get completed', {
        key,
        totalTime: `${totalTime}ms`,
      });

      return result as T;
    } catch (error) {
      logError('Cache-aside get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        args,
      });
      
      // Fall back to direct data loading
      return await loader(...args);
    }
  }

  /**
   * Set data in cache with background refresh scheduling
   */
  async set<T>(
    key: string,
    value: T,
    loader: DataLoader<T>,
    options: {
      args?: any[];
      ttl?: number;
      dependencies?: string[];
      refreshPolicy?: Partial<RefreshPolicy>;
    } = {}
  ): Promise<void> {
    const {
      args = [],
      ttl = 300,
      dependencies = [],
      refreshPolicy = {},
    } = options;

    const policy = { ...this.defaultRefreshPolicy, ...refreshPolicy };

    try {
      // Store in cache
      await cacheService.set(key, value, { ttl, tags: dependencies });
      
      // Initialize metadata
      this.initializeMetadata(key);
      
      // Schedule background refresh
      if (policy.enabled) {
        this.scheduleRefresh(key, loader, args, policy, new Date(Date.now() + ttl * 1000 * policy.refreshThreshold));
      }
      
      logInfo('Cache-aside set completed', {
        key,
        ttl,
        dependencies,
      });
    } catch (error) {
      logError('Cache-aside set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Invalidate cache entry and cancel scheduled refresh
   */
  async invalidate(key: string): Promise<boolean> {
    try {
      // Cancel any scheduled refresh
      this.refreshJobs.delete(key);
      this.refreshInProgress.delete(key);
      
      // Remove from caches
      const deleted = await cacheService.delete(key);
      
      // Clear metadata
      this.entryMetadata.delete(key);
      
      logInfo('Cache-aside invalidation completed', {
        key,
        deleted,
      });
      
      return deleted;
    } catch (error) {
      logError('Cache-aside invalidation error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get cache and refresh statistics
   */
  getStatistics(): {
    totalEntries: number;
    refreshJobs: number;
    refreshInProgress: number;
    topHitRates: Array<{ key: string; hitRate: number; accessCount: number }>;
    avgLoadTimes: Array<{ key: string; avgLoadTime: number; loadCount: number }>;
    refreshQueue: Array<{ key: string; priority: string; scheduledAt: Date }>;
  } {
    const topHitRates = Array.from(this.entryMetadata.entries())
      .map(([key, metadata]) => ({
        key,
        hitRate: metadata.hitRate,
        accessCount: metadata.accessCount,
      }))
      .sort((a, b) => b.hitRate - a.hitRate)
      .slice(0, 10);

    const avgLoadTimes = Array.from(this.entryMetadata.entries())
      .map(([key, metadata]) => ({
        key,
        avgLoadTime: metadata.avgLoadTime,
        loadCount: metadata.loadCount,
      }))
      .sort((a, b) => b.avgLoadTime - a.avgLoadTime)
      .slice(0, 10);

    const refreshQueue = Array.from(this.refreshJobs.values())
      .map(job => ({
        key: job.key,
        priority: job.priority,
        scheduledAt: job.scheduledAt,
      }))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    return {
      totalEntries: this.entryMetadata.size,
      refreshJobs: this.refreshJobs.size,
      refreshInProgress: this.refreshInProgress.size,
      topHitRates,
      avgLoadTimes,
      refreshQueue,
    };
  }

  /**
   * Force refresh for specific key
   */
  async forceRefresh<T>(
    key: string,
    loader: DataLoader<T>,
    args: any[] = []
  ): Promise<T> {
    logInfo('Force refresh initiated', { key });
    
    try {
      const startTime = Date.now();
      const data = await loader(...args);
      const loadTime = Date.now() - startTime;
      
      // Update cache with new data
      await cacheService.set(key, data);
      
      // Update metrics
      this.updateLoadMetrics(key, loadTime);
      
      // Remove from refresh queue
      this.refreshJobs.delete(key);
      this.refreshInProgress.delete(key);
      
      logInfo('Force refresh completed', {
        key,
        loadTime: `${loadTime}ms`,
      });
      
      this.emit('refreshCompleted', { key, loadTime, forced: true });
      
      return data;
    } catch (error) {
      logError('Force refresh error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.emit('refreshFailed', { key, error, forced: true });
      throw error;
    }
  }

  /**
   * Configure global refresh policy
   */
  setRefreshPolicy(policy: Partial<RefreshPolicy>): void {
    this.defaultRefreshPolicy = { ...this.defaultRefreshPolicy, ...policy };
    logInfo('Refresh policy updated', { policy: this.defaultRefreshPolicy });
  }

  // Private methods

  private async scheduleRefreshIfNeeded(
    key: string,
    loader: DataLoader<any>,
    args: any[],
    policy: RefreshPolicy,
    ttl: number
  ): Promise<void> {
    // Check if already scheduled or in progress
    if (this.refreshJobs.has(key) || this.refreshInProgress.has(key)) {
      return;
    }

    // Calculate when to refresh (before TTL expires)
    const refreshTime = new Date(Date.now() + ttl * 1000 * policy.refreshThreshold);
    
    // Check minimum refresh interval
    const metadata = this.entryMetadata.get(key);
    if (metadata?.lastAccessed) {
      const timeSinceLastAccess = Date.now() - metadata.lastAccessed.getTime();
      if (timeSinceLastAccess < policy.minRefreshInterval * 1000) {
        return;
      }
    }

    this.scheduleRefresh(key, loader, args, policy, refreshTime);
  }

  private scheduleRefresh(
    key: string,
    loader: DataLoader<any>,
    args: any[],
    policy: RefreshPolicy,
    scheduledAt: Date
  ): void {
    const job: RefreshJob = {
      key,
      loader,
      args,
      priority: policy.priority,
      scheduledAt,
    };

    this.refreshJobs.set(key, job);
    
    logInfo('Background refresh scheduled', {
      key,
      scheduledAt,
      priority: policy.priority,
    });
  }

  private initializeRefreshProcessor(): void {
    // Process refresh jobs every 30 seconds
    setInterval(async () => {
      if (this.isProcessingJobs) return;
      
      await this.processRefreshJobs();
    }, 30000);

    // Cleanup old metadata every hour
    setInterval(() => {
      this.cleanupOldMetadata();
    }, 3600000);
  }

  private async processRefreshJobs(): Promise<void> {
    if (this.refreshJobs.size === 0) return;
    
    this.isProcessingJobs = true;
    const now = Date.now();
    
    try {
      // Get jobs that need to be processed
      const jobsToProcess = Array.from(this.refreshJobs.values())
        .filter(job => job.scheduledAt.getTime() <= now)
        .sort((a, b) => {
          // Sort by priority first, then by scheduled time
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.scheduledAt.getTime() - b.scheduledAt.getTime();
        })
        .slice(0, this.defaultRefreshPolicy.maxConcurrentRefresh);

      if (jobsToProcess.length === 0) return;

      logInfo('Processing background refresh jobs', {
        jobCount: jobsToProcess.length,
        totalQueued: this.refreshJobs.size,
      });

      // Process jobs in parallel
      await Promise.allSettled(
        jobsToProcess.map(job => this.executeRefreshJob(job))
      );
    } catch (error) {
      logError('Refresh job processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isProcessingJobs = false;
    }
  }

  private async executeRefreshJob(job: RefreshJob): Promise<void> {
    const { key, loader, args } = job;
    
    // Mark as in progress
    this.refreshInProgress.add(key);
    this.refreshJobs.delete(key);
    
    try {
      const startTime = Date.now();
      const data = await loader(...args);
      const loadTime = Date.now() - startTime;
      
      // Update cache
      await cacheService.set(key, data);
      
      // Update metrics
      this.updateLoadMetrics(key, loadTime);
      
      logInfo('Background refresh completed', {
        key,
        loadTime: `${loadTime}ms`,
        priority: job.priority,
      });
      
      this.emit('refreshCompleted', { key, loadTime, forced: false });
    } catch (error) {
      logError('Background refresh failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.emit('refreshFailed', { key, error, forced: false });
    } finally {
      this.refreshInProgress.delete(key);
    }
  }

  private initializeMetadata(key: string): void {
    if (!this.entryMetadata.has(key)) {
      this.entryMetadata.set(key, {
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        hitRate: 0,
        avgLoadTime: 0,
        totalLoadTime: 0,
        loadCount: 0,
      });
    }
  }

  private updateAccessMetrics(key: string): void {
    const metadata = this.entryMetadata.get(key);
    if (metadata) {
      metadata.accessCount++;
      metadata.lastAccessed = new Date();
      
      // Update hit rate (simplified calculation)
      metadata.hitRate = metadata.accessCount / (metadata.accessCount + metadata.loadCount);
    }
  }

  private updateLoadMetrics(key: string, loadTime: number): void {
    this.initializeMetadata(key);
    const metadata = this.entryMetadata.get(key)!;
    
    metadata.loadCount++;
    metadata.totalLoadTime += loadTime;
    metadata.avgLoadTime = metadata.totalLoadTime / metadata.loadCount;
  }

  private cleanupOldMetadata(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    let cleanedCount = 0;
    
    for (const [key, metadata] of this.entryMetadata) {
      if (metadata.lastAccessed.getTime() < cutoff) {
        this.entryMetadata.delete(key);
        this.refreshJobs.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logInfo('Cleaned up old cache metadata', { cleanedCount });
    }
  }
}

// Export singleton instance
export const cacheAsideService = new CacheAsideService();