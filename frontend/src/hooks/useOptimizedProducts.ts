import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { apiRequest } from "@/lib/queryClient";
import { Product } from "@/types/api";

interface UseOptimizedProductsOptions {
  enableServerSearch?: boolean;
  searchDebounceMs?: number;
  prefetchCount?: number;
}

interface SearchParams {
  search?: string;
  category?: string;
  brand?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export function useOptimizedProducts(options: UseOptimizedProductsOptions = {}) {
  const {
    enableServerSearch = true,
    searchDebounceMs = 300,
    prefetchCount = 20
  } = options;

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useState<SearchParams>({
    page: 1,
    limit: prefetchCount
  });
  
  // Client-side search term with deferred value for performance
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const deferredClientSearch = useDeferredValue(clientSearchTerm);
  
  // Server-side search with debouncing
  const debouncedServerSearch = useDebounce(searchParams.search || "", searchDebounceMs);

  // Main products query with intelligent caching
  const {
    data: productsData,
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery({
    queryKey: enableServerSearch 
      ? ['/api/products', { ...searchParams, search: debouncedServerSearch }]
      : ['/api/products?includeStock=true'],
    queryFn: async () => {
      if (enableServerSearch && Object.keys(searchParams).length > 2) {
        // Server-side search with parameters
        const params = new URLSearchParams();
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        });
        
        const response = await fetch(`/api/products/search?${params}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      } else {
        // Fallback to existing endpoint
        const response = await apiRequest('GET', '/api/products?includeStock=true');
        return response.json();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });

  // Extract products array from response
  const allProducts = useMemo(() => {
    if (Array.isArray(productsData)) {
      return productsData;
    }
    return productsData?.data || productsData?.products || [];
  }, [productsData]);

  // Client-side filtering for immediate feedback (when server search is disabled or as fallback)
  const filteredProducts = useMemo(() => {
    if (enableServerSearch && debouncedServerSearch) {
      // Server handles filtering
      return allProducts;
    }

    if (!deferredClientSearch) {
      return allProducts;
    }

    const searchLower = deferredClientSearch.toLowerCase();
    return allProducts.filter((product: Product) =>
      product.sku.toLowerCase().includes(searchLower) ||
      product.name.toLowerCase().includes(searchLower) ||
      product.category?.toLowerCase().includes(searchLower) ||
      product.brand?.toLowerCase().includes(searchLower)
    );
  }, [allProducts, deferredClientSearch, enableServerSearch, debouncedServerSearch]);

  // Optimized search function
  const updateSearch = useCallback((searchTerm: string) => {
    if (enableServerSearch) {
      setSearchParams(prev => ({
        ...prev,
        search: searchTerm,
        page: 1 // Reset to first page on new search
      }));
    } else {
      setClientSearchTerm(searchTerm);
    }
  }, [enableServerSearch]);

  // Category and brand filtering
  const updateFilters = useCallback((filters: Partial<SearchParams>) => {
    if (enableServerSearch) {
      setSearchParams(prev => ({
        ...prev,
        ...filters,
        page: 1 // Reset to first page on filter change
      }));
    }
    // Client-side filtering is handled in the useMemo above
  }, [enableServerSearch]);

  // Pagination
  const loadMore = useCallback(() => {
    setSearchParams(prev => ({
      ...prev,
      page: (prev.page || 1) + 1
    }));
  }, []);

  // Prefetch next page for better UX
  const prefetchNextPage = useCallback(() => {
    if (enableServerSearch) {
      const nextPage = (searchParams.page || 1) + 1;
      queryClient.prefetchQuery({
        queryKey: ['/api/products', { ...searchParams, page: nextPage }],
        queryFn: async () => {
          const params = new URLSearchParams();
          Object.entries({ ...searchParams, page: nextPage }).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              params.append(key, String(value));
            }
          });
          
          const response = await fetch(`/api/products/search?${params}`);
          return response.json();
        },
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [queryClient, searchParams, enableServerSearch]);

  // Cache warming for frequently accessed products
  const warmCache = useCallback(async (productIds: number[]) => {
    const prefetchPromises = productIds.map(id =>
      queryClient.prefetchQuery({
        queryKey: [`/api/products/${id}`],
        queryFn: () => apiRequest('GET', `/api/products/${id}`).then(res => res.json()),
        staleTime: 10 * 60 * 1000, // 10 minutes for individual products
      })
    );
    
    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    const cache = queryClient.getQueryCache();
    const productQueries = cache.getAll().filter(query => 
      query.queryKey[0] && query.queryKey[0].toString().includes('/api/products')
    );
    
    return {
      totalQueries: productQueries.length,
      cachedQueries: productQueries.filter(q => q.state.data !== undefined).length,
      activeFetches: productQueries.filter(q => q.state.fetchStatus === 'fetching').length,
      hitRate: productQueries.length > 0 
        ? ((productQueries.filter(q => q.state.data !== undefined).length / productQueries.length) * 100).toFixed(1)
        : '0',
    };
  }, [queryClient, isLoading, isFetching]);

  return {
    // Data
    products: filteredProducts,
    totalCount: productsData?.total || filteredProducts.length,
    
    // Loading states
    isLoading,
    isFetching,
    isSearching: enableServerSearch ? isFetching && !!debouncedServerSearch : false,
    
    // Error handling
    error,
    refetch,
    
    // Search and filtering
    searchTerm: enableServerSearch ? (searchParams.search || '') : clientSearchTerm,
    updateSearch,
    updateFilters,
    
    // Pagination
    currentPage: searchParams.page || 1,
    hasNextPage: enableServerSearch ? (productsData?.hasNextPage || false) : false,
    loadMore,
    prefetchNextPage,
    
    // Performance optimization
    warmCache,
    performanceMetrics,
    
    // Configuration
    isServerSearchEnabled: enableServerSearch,
  };
}