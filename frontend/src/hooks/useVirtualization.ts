import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

interface UseVirtualizationProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  threshold?: number; // Threshold for enabling virtualization
}

interface VirtualizationResult<T> {
  virtualItems: T[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  shouldVirtualize: boolean;
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;
}

export function useVirtualization<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  threshold = 50
}: UseVirtualizationProps<T>): VirtualizationResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLElement | null>(null);

  // Determine if virtualization should be enabled
  const shouldVirtualize = useMemo(() => {
    return items.length > threshold;
  }, [items.length, threshold]);

  // Calculate visible range
  const { startIndex, endIndex, virtualItems, offsetY } = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        startIndex: 0,
        endIndex: items.length - 1,
        virtualItems: items,
        offsetY: 0
      };
    }

    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    const startIndex = Math.max(0, visibleStart - overscan);
    const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

    const virtualItems = items.slice(startIndex, endIndex + 1);
    const offsetY = startIndex * itemHeight;

    return { startIndex, endIndex, virtualItems, offsetY };
  }, [scrollTop, itemHeight, containerHeight, items, overscan, shouldVirtualize]);

  // Total height calculation
  const totalHeight = useMemo(() => {
    return items.length * itemHeight;
  }, [items.length, itemHeight]);

  // Scroll handlers
  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current) {
      const targetScrollTop = index * itemHeight;
      containerRef.current.scrollTop = targetScrollTop;
      setScrollTop(targetScrollTop);
    }
  }, [itemHeight]);

  const scrollToTop = useCallback(() => {
    scrollToIndex(0);
  }, [scrollToIndex]);

  // Handle scroll events
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  return {
    virtualItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    shouldVirtualize,
    scrollToIndex,
    scrollToTop
  };
}

// Hook for performance-optimized list rendering
export function useOptimizedList<T>(
  items: T[],
  options: {
    batchSize?: number;
    renderDelay?: number;
    priorityIndexes?: number[];
  } = {}
) {
  const { batchSize = 20, renderDelay = 16, priorityIndexes = [] } = options;
  const [renderedItems, setRenderedItems] = useState<T[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const renderTimeoutRef = useRef<NodeJS.Timeout>();

  // Progressive rendering with priority
  useEffect(() => {
    if (items.length === 0) {
      setRenderedItems([]);
      setRenderProgress(100);
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);

    let currentBatch = 0;
    const totalBatches = Math.ceil(items.length / batchSize);

    // First, render priority items
    const priorityItems = priorityIndexes
      .filter(index => index < items.length)
      .map(index => items[index]);

    if (priorityItems.length > 0) {
      setRenderedItems(priorityItems);
    }

    const renderBatch = () => {
      if (currentBatch >= totalBatches) {
        setIsRendering(false);
        setRenderProgress(100);
        return;
      }

      const startIndex = currentBatch * batchSize;
      const endIndex = Math.min(startIndex + batchSize, items.length);
      const batch = items.slice(startIndex, endIndex);

      setRenderedItems(prev => {
        // Merge with existing items, avoiding duplicates from priority rendering
        const existing = new Set(prev);
        const newItems = batch.filter(item => !existing.has(item));
        return [...prev, ...newItems];
      });

      currentBatch++;
      setRenderProgress((currentBatch / totalBatches) * 100);

      renderTimeoutRef.current = setTimeout(renderBatch, renderDelay);
    };

    // Start rendering after priority items
    renderTimeoutRef.current = setTimeout(renderBatch, renderDelay);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [items, batchSize, renderDelay, priorityIndexes]);

  const cancelRendering = useCallback(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      setIsRendering(false);
    }
  }, []);

  return {
    renderedItems,
    isRendering,
    renderProgress,
    cancelRendering
  };
}

// Hook for infinite scroll with performance optimizations
export function useInfiniteScroll<T>(
  fetchMore: (page: number) => Promise<T[]>,
  options: {
    threshold?: number;
    initialPage?: number;
    pageSize?: number;
    maxPages?: number;
  } = {}
) {
  const {
    threshold = 200,
    initialPage = 1,
    pageSize = 20,
    maxPages = Infinity
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNextPage || currentPage > maxPages) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const newItems = await fetchMore(currentPage);
      
      if (newItems.length === 0) {
        setHasNextPage(false);
      } else {
        setItems(prev => [...prev, ...newItems]);
        setCurrentPage(prev => prev + 1);
        
        // Check if we got fewer items than expected (end of data)
        if (newItems.length < pageSize) {
          setHasNextPage(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more items');
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [fetchMore, currentPage, hasNextPage, maxPages, pageSize]);

  const handleScroll = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement;
      const { scrollTop, scrollHeight, clientHeight } = target;

      if (scrollHeight - scrollTop - clientHeight < threshold) {
        loadMore();
      }
    },
    [loadMore, threshold]
  );

  const reset = useCallback(() => {
    setItems([]);
    setCurrentPage(initialPage);
    setHasNextPage(true);
    setError(null);
    setIsLoading(false);
    loadingRef.current = false;
  }, [initialPage]);

  return {
    items,
    isLoading,
    hasNextPage,
    error,
    loadMore,
    handleScroll,
    reset
  };
}

export default useVirtualization;