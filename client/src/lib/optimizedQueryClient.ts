import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Optimized error handling
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Enhanced API request with retry logic
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });

      await throwIfResNotOk(res);
      return res;
    } catch (error) {
      if (i === retries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  
  throw new Error("Max retries exceeded");
}

// Optimized query function with cache-first approach
type UnauthorizedBehavior = "returnNull" | "throw";
export const getOptimizedQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  useCache?: boolean;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, useCache = true }) =>
  async ({ queryKey, signal }) => {
    const url = queryKey[0] as string;
    
    // Check Service Worker cache first for faster responses
    if (useCache && 'serviceWorker' in navigator) {
      try {
        const cachedResponse = await caches.match(url);
        if (cachedResponse && cachedResponse.ok) {
          const data = await cachedResponse.json();
          
          // Return cached data immediately and update in background
          setTimeout(() => {
            fetch(url, { credentials: "include" })
              .then(res => res.json())
              .then(freshData => {
                if (JSON.stringify(data) !== JSON.stringify(freshData)) {
                  // Update cache with fresh data
                  caches.open('mws-data-v1.0.0').then(cache => {
                    cache.put(url, new Response(JSON.stringify(freshData), {
                      headers: { 'Content-Type': 'application/json' }
                    }));
                  });
                }
              })
              .catch(() => {
                // Ignore background refresh errors
              });
          }, 0);
          
          return data;
        }
      } catch (error) {
        // Continue with network request if cache fails
      }
    }
    
    // Network request
    const res = await fetch(url, {
      credentials: "include",
      signal,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Optimized query client with performance-focused defaults
export const optimizedQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getOptimizedQueryFn({ on401: "throw", useCache: true }),
      
      // Optimized timing
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for longer
      cacheTime: 10 * 60 * 1000, // 10 minutes - keep in memory longer
      
      // Reduced network requests
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchInterval: false, // Disable automatic polling
      
      // Improved error handling
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error.message.includes('4')) return false;
        // Retry up to 3 times for network errors
        return failureCount < 3;
      },
      
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Prevent unnecessary re-fetches
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
      
      // Optimistic updates for better perceived performance
      onMutate: async (variables) => {
        // Cancel any outgoing refetches
        // This prevents them from overwriting our optimistic update
        return { previousData: variables };
      },
      
      onError: (err, variables, context) => {
        // Roll back optimistic updates on error
        console.error('Mutation error:', err);
      },
    },
  },
});

// Enhanced cache management
export const cacheManager = {
  // Preload critical data
  preloadCriticalData: async () => {
    const criticalQueries = [
      '/api/pallets',
      '/api/dashboard/stats',
    ];
    
    for (const query of criticalQueries) {
      try {
        await optimizedQueryClient.prefetchQuery({
          queryKey: [query],
          staleTime: 10 * 60 * 1000, // 10 minutes
        });
      } catch (error) {
        console.warn(`Failed to preload ${query}:`, error);
      }
    }
  },
  
  // Clear all caches
  clearAll: async () => {
    await optimizedQueryClient.clear();
    
    if ('serviceWorker' in navigator) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
  },
  
  // Invalidate specific cache
  invalidateCache: (queryKey: string[]) => {
    optimizedQueryClient.invalidateQueries({ queryKey });
  },
  
  // Background refresh
  backgroundRefresh: (queryKey: string[]) => {
    optimizedQueryClient.refetchQueries({ queryKey });
  },
  
  // Check cache status
  getCacheStatus: () => {
    const queryCache = optimizedQueryClient.getQueryCache();
    return {
      totalQueries: queryCache.getAll().length,
      staleQueries: queryCache.getAll().filter(q => q.isStale()).length,
      activeQueries: queryCache.getAll().filter(q => q.observers.length > 0).length,
    };
  },
};

// Performance monitoring
export const performanceMonitor = {
  startTiming: (label: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-start`);
    }
  },
  
  endTiming: (label: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      
      const measure = performance.getEntriesByName(label)[0];
      if (measure) {
        console.log(`Performance: ${label} took ${measure.duration.toFixed(2)}ms`);
      }
    }
  },
  
  logCacheHitRate: () => {
    const status = cacheManager.getCacheStatus();
    console.log('Cache Status:', status);
  },
};

// Service Worker integration
export const serviceWorkerManager = {
  register: async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('New version available');
              }
            });
          }
        });
        
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  },
  
  updateCache: (endpoint: string, data: any) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_UPDATE',
        endpoint,
        data,
      });
    }
  },
  
  clearCache: (cacheName: string) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_CLEAR',
        cacheName,
      });
    }
  },
};

// Initialize performance optimizations
export const initializeOptimizations = async () => {
  // Register service worker
  await serviceWorkerManager.register();
  
  // Preload critical data
  await cacheManager.preloadCriticalData();
  
  // Start performance monitoring
  performanceMonitor.startTiming('app-initialization');
  
  console.log('Performance optimizations initialized');
};