import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FixedSizeList as List, areEqual } from "react-window";
import { FixedSizeList } from "react-window";

interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  width?: number | string;
  renderItem: (props: {
    item: T;
    index: number;
    style: React.CSSProperties;
  }) => React.ReactNode;
  onItemsRendered?: (props: {
    visibleStartIndex: number;
    visibleStopIndex: number;
    overscanStartIndex: number;
    overscanStopIndex: number;
  }) => void;
  className?: string;
  overscanCount?: number;
  loading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  error?: string | null;
  onScroll?: (props: {
    scrollDirection: "forward" | "backward";
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }) => void;
  initialScrollOffset?: number;
  threshold?: number; // For infinite loading
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
}

// Memoized item wrapper to prevent unnecessary re-renders
const ItemWrapper = React.memo(<T,>({
  index,
  style,
  data,
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    items: T[];
    renderItem: (props: {
      item: T;
      index: number;
      style: React.CSSProperties;
    }) => React.ReactNode;
  };
}) => {
  const { items, renderItem } = data;
  const item = items[index];

  if (!item) {
    return (
      <div style={style} className="flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return <>{renderItem({ item, index, style })}</>;
}, areEqual);

ItemWrapper.displayName = 'ItemWrapper';

export function VirtualScrollList<T>({
  items,
  itemHeight,
  height,
  width = "100%",
  renderItem,
  onItemsRendered,
  className = "",
  overscanCount = 5,
  loading = false,
  loadingComponent,
  emptyComponent,
  errorComponent,
  error,
  onScroll,
  initialScrollOffset = 0,
  threshold = 5,
  onLoadMore,
  hasNextPage = false,
  isLoadingMore = false,
}: VirtualScrollListProps<T>) {
  const listRef = useRef<FixedSizeList>(null);
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const lastScrollOffset = useRef(0);

  // Memoize the data passed to items to prevent unnecessary re-renders
  const itemData = useMemo(
    () => ({
      items,
      renderItem,
    }),
    [items, renderItem]
  );

  // Handle scroll events
  const handleScroll = useCallback(
    (props: {
      scrollDirection: "forward" | "backward";
      scrollOffset: number;
      scrollUpdateWasRequested: boolean;
    }) => {
      const { scrollOffset, scrollDirection } = props;
      
      // Update scroll direction state
      setIsScrollingDown(scrollDirection === "forward");
      lastScrollOffset.current = scrollOffset;

      // Call external scroll handler
      onScroll?.(props);

      // Infinite loading logic
      if (
        onLoadMore &&
        hasNextPage &&
        !isLoadingMore &&
        scrollDirection === "forward"
      ) {
        const totalHeight = items.length * itemHeight;
        const scrollableHeight = totalHeight - height;
        const thresholdHeight = threshold * itemHeight;
        
        if (scrollOffset >= scrollableHeight - thresholdHeight) {
          onLoadMore();
        }
      }
    },
    [onScroll, onLoadMore, hasNextPage, isLoadingMore, items.length, itemHeight, height, threshold]
  );

  // Handle items rendered for infinite loading
  const handleItemsRendered = useCallback(
    (props: {
      visibleStartIndex: number;
      visibleStopIndex: number;
      overscanStartIndex: number;
      overscanStopIndex: number;
    }) => {
      onItemsRendered?.(props);

      // Alternative infinite loading trigger based on visible items
      if (
        onLoadMore &&
        hasNextPage &&
        !isLoadingMore &&
        props.visibleStopIndex >= items.length - threshold
      ) {
        onLoadMore();
      }
    },
    [onItemsRendered, onLoadMore, hasNextPage, isLoadingMore, items.length, threshold]
  );

  // Scroll to specific item
  const scrollToItem = useCallback(
    (index: number, align: "start" | "center" | "end" | "smart" = "smart") => {
      listRef.current?.scrollToItem(index, align);
    },
    []
  );

  // Scroll to specific offset
  const scrollToOffset = useCallback((offset: number) => {
    listRef.current?.scrollTo(offset);
  }, []);

  // Public API for parent components
  React.useImperativeHandle(
    listRef,
    () => ({
      scrollToItem,
      scrollToOffset,
      scrollToTop: () => scrollToOffset(0),
      scrollToBottom: () => scrollToOffset(items.length * itemHeight),
    }),
    [scrollToItem, scrollToOffset, items.length, itemHeight]
  );

  // Loading state
  if (loading && items.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        {loadingComponent || (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading items...</p>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        {errorComponent || (
          <div className="text-center text-red-500">
            <div className="text-xl mb-2">⚠️</div>
            <p>Error loading items</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        {emptyComponent || (
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">📦</div>
            <p>No items found</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <List
        ref={listRef}
        height={height}
        width={width}
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscanCount}
        onScroll={handleScroll}
        onItemsRendered={handleItemsRendered}
        initialScrollOffset={initialScrollOffset}
      >
        {ItemWrapper}
      </List>
      
      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4 border-t">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-gray-500">Loading more items...</span>
        </div>
      )}
    </div>
  );
}

// Hook for managing virtual scroll state
export function useVirtualScroll<T>({
  items,
  pageSize = 50,
  fetchMore,
}: {
  items: T[];
  pageSize?: number;
  fetchMore?: (page: number) => Promise<T[]>;
}) {
  const [allItems, setAllItems] = useState<T[]>(items);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Update items when props change
  useEffect(() => {
    setAllItems(items);
  }, [items]);

  const loadMore = useCallback(async () => {
    if (!fetchMore || isLoadingMore || !hasNextPage) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const newItems = await fetchMore(currentPage + 1);
      
      if (newItems.length === 0) {
        setHasNextPage(false);
      } else {
        setAllItems(prev => [...prev, ...newItems]);
        setCurrentPage(prev => prev + 1);
        
        // If we got fewer items than pageSize, we've reached the end
        if (newItems.length < pageSize) {
          setHasNextPage(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more items');
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchMore, isLoadingMore, hasNextPage, currentPage, pageSize]);

  const reset = useCallback(() => {
    setAllItems(items);
    setCurrentPage(1);
    setHasNextPage(true);
    setIsLoadingMore(false);
    setError(null);
  }, [items]);

  return {
    items: allItems,
    isLoadingMore,
    hasNextPage,
    error,
    loadMore,
    reset,
  };
}

// High-performance item component for common use cases
export const VirtualScrollItem = React.memo<{
  children: React.ReactNode;
  style: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  isSelected?: boolean;
}>(({ children, style, className = "", onClick, isSelected = false }) => {
  return (
    <div
      style={style}
      className={`
        ${className}
        ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}
        ${isSelected ? 'bg-blue-50 border-blue-200' : ''}
        transition-colors duration-150
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
});

VirtualScrollItem.displayName = 'VirtualScrollItem';

export default VirtualScrollList;