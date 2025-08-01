import { useState, useEffect, useCallback, ComponentType } from 'react';

interface UseLazyComponentOptions {
  /** Preload the component on mount */
  preload?: boolean;
  /** Delay before showing loading state */
  loadingDelay?: number;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Custom success handler */
  onLoad?: () => void;
}

interface UseLazyComponentReturn<T> {
  /** The loaded component (null if not loaded yet) */
  Component: T | null;
  /** Whether the component is currently loading */
  isLoading: boolean;
  /** Any error that occurred during loading */
  error: Error | null;
  /** Manually trigger component load */
  loadComponent: () => Promise<void>;
  /** Reset the error state */
  resetError: () => void;
  /** Whether the component has been loaded successfully */
  isLoaded: boolean;
}

/**
 * Hook for managing lazy-loaded components with full control over loading state
 * Perfect for conditionally rendered heavy components
 */
export function useLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: UseLazyComponentOptions = {}
): UseLazyComponentReturn<T> {
  const [Component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  const { preload = false, loadingDelay = 0, onError, onLoad } = options;

  const loadComponent = useCallback(async () => {
    if (Component || isLoading) return;

    setIsLoading(true);
    setError(null);
    setLoadingStartTime(Date.now());

    try {
      const module = await importFn();
      const LoadedComponent = module.default;

      // Apply loading delay if specified
      if (loadingDelay > 0) {
        const elapsed = Date.now() - (loadingStartTime || 0);
        const remainingDelay = Math.max(0, loadingDelay - elapsed);
        if (remainingDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }
      }

      setComponent(LoadedComponent);
      onLoad?.();
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      console.error('Failed to load component:', error);
    } finally {
      setIsLoading(false);
      setLoadingStartTime(null);
    }
  }, [Component, isLoading, importFn, loadingDelay, loadingStartTime, onError, onLoad]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Preload on mount if requested
  useEffect(() => {
    if (preload) {
      loadComponent();
    }
  }, [preload, loadComponent]);

  return {
    Component,
    isLoading,
    error,
    loadComponent,
    resetError,
    isLoaded: Component !== null
  };
}

/**
 * Hook for batch loading multiple components
 */
export function useLazyComponents<T extends Record<string, ComponentType<any>>>(
  importMap: Record<keyof T, () => Promise<{ default: T[keyof T] }>>,
  options: UseLazyComponentOptions = {}
) {
  const [components, setComponents] = useState<Partial<T>>({});
  const [loadingStates, setLoadingStates] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);
  const [errors, setErrors] = useState<Record<keyof T, Error | null>>({} as Record<keyof T, Error | null>);

  const loadComponent = useCallback(async (key: keyof T) => {
    if (components[key] || loadingStates[key]) return;

    setLoadingStates(prev => ({ ...prev, [key]: true }));
    setErrors(prev => ({ ...prev, [key]: null }));

    try {
      const module = await importMap[key]();
      setComponents(prev => ({ ...prev, [key]: module.default }));
      options.onLoad?.();
    } catch (err) {
      const error = err as Error;
      setErrors(prev => ({ ...prev, [key]: error }));
      options.onError?.(error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [key]: false }));
    }
  }, [components, loadingStates, importMap, options]);

  const loadAllComponents = useCallback(async () => {
    const promises = Object.keys(importMap).map(key => loadComponent(key as keyof T));
    await Promise.allSettled(promises);
  }, [importMap, loadComponent]);

  return {
    components,
    loadingStates,
    errors,
    loadComponent,
    loadAllComponents,
    isAnyLoading: Object.values(loadingStates).some(Boolean),
    hasAnyError: Object.values(errors).some(Boolean)
  };
}

/**
 * Hook for progressive component loading based on priority
 */
export function useProgressiveLazyLoading<T extends ComponentType<any>>(
  componentGroups: Array<{
    priority: number;
    components: Array<{
      key: string;
      importFn: () => Promise<{ default: T }>;
    }>;
  }>
) {
  const [loadedComponents, setLoadedComponents] = useState<Record<string, T>>({});
  const [currentPriority, setCurrentPriority] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadNextPriorityGroup = useCallback(async () => {
    const nextGroup = componentGroups.find(group => group.priority > currentPriority);
    if (!nextGroup || isLoading) return;

    setIsLoading(true);
    const nextPriority = nextGroup.priority;

    try {
      const results = await Promise.allSettled(
        nextGroup.components.map(async ({ key, importFn }) => {
          const module = await importFn();
          return { key, component: module.default };
        })
      );

      const newComponents: Record<string, T> = {};
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          newComponents[result.value.key] = result.value.component;
        }
      });

      setLoadedComponents(prev => ({ ...prev, ...newComponents }));
      setCurrentPriority(nextPriority);
    } catch (error) {
      console.error('Failed to load priority group:', error);
    } finally {
      setIsLoading(false);
    }
  }, [componentGroups, currentPriority, isLoading]);

  return {
    loadedComponents,
    currentPriority,
    isLoading,
    loadNextPriorityGroup,
    hasMoreToLoad: componentGroups.some(group => group.priority > currentPriority)
  };
}