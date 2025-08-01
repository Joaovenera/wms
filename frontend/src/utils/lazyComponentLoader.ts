import { lazy, ComponentType } from 'react';

/**
 * Utility for creating lazy-loaded components with proper error handling
 * and loading states optimized for WMS application
 */

// Types for component loader options
interface LazyComponentOptions {
  /** Custom loading fallback component */
  fallback?: ComponentType;
  /** Custom error boundary component */
  errorBoundary?: ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  /** Retry attempts for failed lazy loads */
  retryAttempts?: number;
  /** Delay before showing loading state (prevents flash) */
  loadingDelay?: number;
}

// Cache for loaded components to prevent re-loading
const componentCache = new Map<string, ComponentType<any>>();

/**
 * Enhanced lazy component loader with caching and retry logic
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): T {
  const cacheKey = importFn.toString();
  
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey);
  }

  const LazyComponent = lazy(async () => {
    const { retryAttempts = 3 } = options;
    let lastError: Error;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const module = await importFn();
        return module;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Lazy load attempt ${attempt} failed:`, error);
        
        if (attempt < retryAttempts) {
          // Exponential backoff: 100ms, 400ms, 1600ms
          const delay = Math.pow(4, attempt - 1) * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  });

  componentCache.set(cacheKey, LazyComponent as T);
  return LazyComponent as T;
}

/**
 * Pre-load a component for better user experience
 * Call this on user interactions that will likely lead to the component being used
 */
export function preloadComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>
): Promise<void> {
  return importFn()
    .then(module => {
      // Component is now cached by the browser
      console.log('Component preloaded successfully');
    })
    .catch(error => {
      console.warn('Component preload failed:', error);
    });
}

/**
 * Check if a component is already loaded in cache
 */
export function isComponentLoaded(importFn: () => Promise<{ default: ComponentType<any> }>): boolean {
  const cacheKey = importFn.toString();
  return componentCache.has(cacheKey);
}

/**
 * Preload multiple components in parallel
 */
export function preloadComponents(
  importFns: Array<() => Promise<{ default: ComponentType<any> }>>
): Promise<void[]> {
  return Promise.allSettled(
    importFns.map(importFn => preloadComponent(importFn))
  ).then(() => []);
}

/**
 * Intersection Observer based preloader for components
 * Preloads components when user scrolls near trigger elements
 */
export class ComponentPreloader {
  private observer: IntersectionObserver | null = null;
  private preloadMap = new Map<Element, () => Promise<{ default: ComponentType<any> }>>();

  constructor(options: IntersectionObserverInit = {}) {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this),
        {
          rootMargin: '50px',
          threshold: 0.1,
          ...options
        }
      );
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const importFn = this.preloadMap.get(entry.target);
        if (importFn) {
          preloadComponent(importFn);
          this.observer?.unobserve(entry.target);
          this.preloadMap.delete(entry.target);
        }
      }
    });
  }

  /**
   * Register an element to trigger component preload when it becomes visible
   */
  observe(
    element: Element,
    importFn: () => Promise<{ default: ComponentType<any> }>
  ) {
    if (this.observer) {
      this.preloadMap.set(element, importFn);
      this.observer.observe(element);
    }
  }

  /**
   * Stop observing an element
   */
  unobserve(element: Element) {
    if (this.observer) {
      this.observer.unobserve(element);
      this.preloadMap.delete(element);
    }
  }

  /**
   * Disconnect the observer and clean up
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.preloadMap.clear();
    }
  }
}

// Singleton instance for global use
export const globalComponentPreloader = new ComponentPreloader();

/**
 * Hook for easy component preloading on hover/focus
 */
export function useComponentPreloader() {
  return {
    preloadComponent,
    preloadComponents,
    isComponentLoaded,
    preloader: globalComponentPreloader
  };
}