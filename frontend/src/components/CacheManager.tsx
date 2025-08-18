import React, { createContext, useContext, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiry: number;
  key: string;
  priority: 'low' | 'medium' | 'high';
  accessCount: number;
  lastAccessed: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  totalSize: number;
  memoryUsage: number;
}

interface SmartCacheOptions {
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  defaultTTL?: number; // Default time to live in ms
  cleanupInterval?: number; // Cleanup interval in ms
  compressionThreshold?: number; // Compress data above this size
  persistentKeys?: string[]; // Keys that should be persisted to localStorage
}

class SmartCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = { hits: 0, misses: 0, entries: 0, totalSize: 0, memoryUsage: 0 };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private options: Required<SmartCacheOptions>;

  constructor(options: SmartCacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB
      maxEntries: options.maxEntries || 1000,
      defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5 minutes
      cleanupInterval: options.cleanupInterval || 60 * 1000, // 1 minute
      compressionThreshold: options.compressionThreshold || 10 * 1024, // 10KB
      persistentKeys: options.persistentKeys || [],
    };

    this.startCleanupTimer();
    this.loadPersistentCache();
  }

  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  private loadPersistentCache() {
    try {
      const persistentData = localStorage.getItem('smart-cache-persistent');
      if (persistentData) {
        const data = JSON.parse(persistentData);
        Object.entries(data).forEach(([key, entry]) => {
          if (this.options.persistentKeys.includes(key)) {
            this.cache.set(key, entry as CacheEntry);
          }
        });
        this.updateStats();
      }
    } catch (error) {
      console.warn('Failed to load persistent cache:', error);
    }
  }

  private savePersistentCache() {
    try {
      const persistentData: Record<string, CacheEntry> = {};
      this.options.persistentKeys.forEach(key => {
        const entry = this.cache.get(key);
        if (entry) {
          persistentData[key] = entry;
        }
      });
      localStorage.setItem('smart-cache-persistent', JSON.stringify(persistentData));
    } catch (error) {
      console.warn('Failed to save persistent cache:', error);
    }
  }

  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return JSON.stringify(data).length * 2; // Rough estimate
    }
  }

  private compressData(data: any): any {
    // Simple compression - in a real app, you might use a compression library
    const serialized = JSON.stringify(data);
    if (serialized.length > this.options.compressionThreshold) {
      // Mark as compressed for future decompression
      return {
        __compressed: true,
        data: serialized,
      };
    }
    return data;
  }

  private decompressData(data: any): any {
    if (data && data.__compressed) {
      return JSON.parse(data.data);
    }
    return data;
  }

  private updateStats() {
    this.stats.entries = this.cache.size;
    this.stats.totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    
    // Estimate memory usage
    if ('memory' in performance) {
      this.stats.memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    }
  }

  private evict() {
    if (this.cache.size <= this.options.maxEntries && this.stats.totalSize <= this.options.maxSize) {
      return;
    }

    // Sort by priority and access patterns (LRU with priority)
    const entries = Array.from(this.cache.entries()).sort(([, a], [, b]) => {
      // Higher priority = less likely to be evicted
      const priorityWeight = { low: 1, medium: 2, high: 3 };
      const aPriority = priorityWeight[a.priority];
      const bPriority = priorityWeight[b.priority];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Among same priority, evict least recently used
      return a.lastAccessed - b.lastAccessed;
    });

    // Remove oldest entries until we're under limits
    let removed = 0;
    while (
      (this.cache.size > this.options.maxEntries || this.stats.totalSize > this.options.maxSize) &&
      entries.length > removed
    ) {
      const [key] = entries[removed];
      this.cache.delete(key);
      removed++;
    }

    this.updateStats();
  }

  private cleanup() {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
    
    // Evict if necessary
    this.evict();
    
    this.updateStats();
    this.savePersistentCache();
  }

  set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): void {
    const ttl = options.ttl || this.options.defaultTTL;
    const priority = options.priority || 'medium';
    const compressedData = this.compressData(data);
    const size = this.calculateSize(compressedData);

    const entry: CacheEntry<T> = {
      data: compressedData,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
      key,
      priority,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
    };

    this.cache.set(key, entry);
    this.updateStats();
    this.evict();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return this.decompressData(entry.data);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateStats();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, entries: 0, totalSize: 0, memoryUsage: 0 };
  }

  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }

  // Get all keys matching a pattern
  getKeys(pattern?: RegExp): string[] {
    const keys = Array.from(this.cache.keys());
    return pattern ? keys.filter(key => pattern.test(key)) : keys;
  }

  // Prefetch data for keys
  prefetch<T>(key: string, dataProvider: () => Promise<T>, options?: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
  }): Promise<T> {
    if (this.has(key)) {
      return Promise.resolve(this.get<T>(key)!);
    }

    return dataProvider().then(data => {
      this.set(key, data, options);
      return data;
    });
  }
}

interface CacheManagerContextValue {
  cache: SmartCache;
  prefetchQueries: (patterns: string[]) => Promise<void>;
  invalidatePattern: (pattern: RegExp) => void;
  getStats: () => CacheStats;
}

const CacheManagerContext = createContext<CacheManagerContextValue | null>(null);

interface CacheManagerProps {
  children: React.ReactNode;
  options?: SmartCacheOptions;
}

export function CacheManager({ children, options }: CacheManagerProps) {
  const cacheRef = useRef<SmartCache>();
  const queryClient = useQueryClient();

  if (!cacheRef.current) {
    cacheRef.current = new SmartCache(options);
  }

  const prefetchQueries = useCallback(async (patterns: string[]) => {
    const queries = queryClient.getQueryCache().getAll();
    
    const matchingQueries = queries.filter(query => 
      patterns.some(pattern => {
        const queryKey = JSON.stringify(query.queryKey);
        return queryKey.includes(pattern);
      })
    );

    await Promise.all(
      matchingQueries.map(query => 
        queryClient.prefetchQuery({
          queryKey: query.queryKey,
          queryFn: query.options.queryFn,
        })
      )
    );
  }, [queryClient]);

  const invalidatePattern = useCallback((pattern: RegExp) => {
    const keys = cacheRef.current!.getKeys(pattern);
    keys.forEach(key => cacheRef.current!.delete(key));
    
    // Also invalidate React Query cache
    queryClient.invalidateQueries({
      predicate: (query) => pattern.test(JSON.stringify(query.queryKey))
    });
  }, [queryClient]);

  const getStats = useCallback(() => {
    return cacheRef.current!.getStats();
  }, []);

  useEffect(() => {
    return () => {
      cacheRef.current?.destroy();
    };
  }, []);

  const contextValue: CacheManagerContextValue = {
    cache: cacheRef.current,
    prefetchQueries,
    invalidatePattern,
    getStats,
  };

  return (
    <CacheManagerContext.Provider value={contextValue}>
      {children}
    </CacheManagerContext.Provider>
  );
}

// Hook for using the cache manager
export function useCacheManager() {
  const context = useContext(CacheManagerContext);
  if (!context) {
    throw new Error('useCacheManager must be used within a CacheManager');
  }
  return context;
}

// Hook for smart caching with React Query integration
export function useSmartCache<T>(
  key: string,
  dataProvider: () => Promise<T>,
  options: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
    fallbackToQuery?: boolean;
  } = {}
) {
  const { cache } = useCacheManager();
  const queryClient = useQueryClient();

  const getCachedData = useCallback((): T | null => {
    return cache.get<T>(key);
  }, [cache, key]);

  const setCachedData = useCallback((data: T) => {
    cache.set(key, data, {
      ttl: options.ttl,
      priority: options.priority,
    });
  }, [cache, key, options.ttl, options.priority]);

  const fetchData = useCallback(async (): Promise<T> => {
    // Try cache first
    const cachedData = getCachedData();
    if (cachedData !== null) {
      return cachedData;
    }

    // Try React Query cache
    if (options.fallbackToQuery) {
      const queryData = queryClient.getQueryData<T>([key]);
      if (queryData !== undefined) {
        setCachedData(queryData);
        return queryData;
      }
    }

    // Fetch fresh data
    const freshData = await dataProvider();
    setCachedData(freshData);
    return freshData;
  }, [getCachedData, setCachedData, dataProvider, options.fallbackToQuery, queryClient, key]);

  const invalidate = useCallback(() => {
    cache.delete(key);
    if (options.fallbackToQuery) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [cache, key, options.fallbackToQuery, queryClient]);

  return {
    getCachedData,
    setCachedData,
    fetchData,
    invalidate,
  };
}

export default CacheManager;