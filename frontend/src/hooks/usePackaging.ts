import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { apiRequest } from "../lib/queryClient";
import {
  PackagingType,
  ProductStockByPackaging,
  ProductStockConsolidated,
  OptimizedPickingPlan,
  InsertPackagingType,
} from "../types/api";

// Performance optimization: request deduplication and caching
const createOptimizedQueryConfig = (staleTime = 5 * 60 * 1000, gcTime = 10 * 60 * 1000) => ({
  staleTime, // 5 minutes default
  gcTime, // 10 minutes default
  refetchOnWindowFocus: false,
  refetchOnReconnect: 'always' as const,
});

// Debounced API requests to prevent excessive calls
const debouncedApiRequest = (() => {
  const pending = new Map<string, Promise<any>>();
  
  return async (method: string, url: string, data?: any) => {
    const key = `${method}:${url}:${JSON.stringify(data || {})}`;
    
    if (pending.has(key)) {
      return pending.get(key)!;
    }
    
    const promise = apiRequest(method as any, url, data).then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    }).finally(() => {
      pending.delete(key);
    });
    
    pending.set(key, promise);
    return promise;
  };
})();

// Optimized hook for fetching product packaging
export function useProductPackaging(productId: number) {
  return useQuery({
    queryKey: [`/api/packaging/products/${productId}`],
    queryFn: () => debouncedApiRequest('GET', `/api/packaging/products/${productId}`),
    enabled: !!productId,
    ...createOptimizedQueryConfig(),
  });
}

// Optimized hook for fetching product packaging hierarchy
export function useProductPackagingHierarchy(productId: number) {
  return useQuery({
    queryKey: [`/api/packaging/products/${productId}/hierarchy`],
    queryFn: () => debouncedApiRequest('GET', `/api/packaging/products/${productId}/hierarchy`),
    enabled: !!productId,
    ...createOptimizedQueryConfig(2 * 60 * 1000), // 2 minutes - hierarchy changes less frequently
  });
}

// Optimized hook for fetching consolidated product stock
export function useProductStockConsolidated(productId: number) {
  return useQuery<{
    packagings: PackagingType[];
    stock: ProductStockByPackaging[];
    consolidated: ProductStockConsolidated;
  }>({
    queryKey: [`/api/packaging/products/${productId}/stock-consolidated`],
    queryFn: () => debouncedApiRequest('GET', `/api/packaging/products/${productId}/stock-consolidated`),
    enabled: !!productId,
    ...createOptimizedQueryConfig(30 * 1000), // 30 seconds - stock changes frequently
  });
}

// Optimized hook for scanning barcodes with caching
export function useScanBarcode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (barcode: string): Promise<PackagingType> => {
      // Check cache first
      const cachedResult = queryClient.getQueryData<PackagingType>([`/api/packaging/scan/${barcode}`]);
      if (cachedResult) {
        return cachedResult;
      }
      
      const result = await debouncedApiRequest("POST", "/api/packaging/scan", { barcode });
      
      // Cache the result for 1 minute
      queryClient.setQueryData([`/api/packaging/scan/${barcode}`], result, {
        updatedAt: Date.now() + 60 * 1000,
      });
      
      return result;
    },
    onError: (error: any) => {
      console.error('Barcode scan failed:', error);
    },
  });
}

// Optimized hook for picking optimization with memoization
export function useOptimizePicking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      productId: number;
      requestedBaseUnits: number;
    }): Promise<OptimizedPickingPlan> => {
      const cacheKey = `/api/packaging/optimize-picking/${data.productId}/${data.requestedBaseUnits}`;
      
      // Check for cached optimization result
      const cached = queryClient.getQueryData<OptimizedPickingPlan>([cacheKey]);
      if (cached) {
        return cached;
      }
      
      const result = await debouncedApiRequest("POST", "/api/packaging/optimize-picking", data);
      
      // Cache optimization result for 5 minutes
      queryClient.setQueryData([cacheKey], result, {
        updatedAt: Date.now() + 5 * 60 * 1000,
      });
      
      return result;
    },
    onError: (error: any) => {
      console.error('Picking optimization failed:', error);
    },
  });
}

// Optimized hook for quantity conversion with caching
export function useConvertQuantity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      quantity: number;
      fromPackagingId: number;
      toPackagingId: number;
    }): Promise<{
      originalQuantity: number;
      originalPackagingId: number;
      convertedQuantity: number;
      targetPackagingId: number;
      baseUnits: number;
    }> => {
      const cacheKey = `/api/packaging/convert/${data.fromPackagingId}/${data.toPackagingId}/${data.quantity}`;
      
      // Check cache for conversion result
      const cached = queryClient.getQueryData([cacheKey]);
      if (cached) {
        return cached as any;
      }
      
      const result = await debouncedApiRequest("POST", "/api/packaging/convert", data);
      
      // Cache conversion for 10 minutes (conversions don't change often)
      queryClient.setQueryData([cacheKey], result, {
        updatedAt: Date.now() + 10 * 60 * 1000,
      });
      
      return result;
    },
    onError: (error: any) => {
      console.error('Quantity conversion failed:', error);
    },
  });
}

// Optimized hook for creating packaging with efficient cache updates
export function useCreatePackaging() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertPackagingType): Promise<PackagingType> => {
      return debouncedApiRequest("POST", "/api/packaging", data);
    },
    onMutate: async (newPackaging) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/packaging/products/${newPackaging.productId}`] });
      
      // Snapshot previous value
      const previousPackagings = queryClient.getQueryData([`/api/packaging/products/${newPackaging.productId}`]);
      
      // Optimistically update cache
      queryClient.setQueryData([`/api/packaging/products/${newPackaging.productId}`], (old: any) => {
        return old ? [...old, { ...newPackaging, id: Date.now() }] : [{ ...newPackaging, id: Date.now() }];
      });
      
      return { previousPackagings };
    },
    onError: (err, newPackaging, context) => {
      // Rollback on error
      queryClient.setQueryData(
        [`/api/packaging/products/${newPackaging.productId}`],
        context?.previousPackagings
      );
    },
    onSuccess: (newPackaging) => {
      // Update related queries efficiently
      queryClient.setQueryData([`/api/packaging/products/${newPackaging.productId}`], (old: any) => {
        if (!old) return [newPackaging];
        return old.map((pkg: any) => pkg.id === newPackaging.id ? newPackaging : pkg);
      });
      
      // Invalidate hierarchy (structure may have changed)
      queryClient.invalidateQueries({
        queryKey: [`/api/packaging/products/${newPackaging.productId}/hierarchy`],
      });
    },
  });
}

// Hook para atualizar embalagem
export function useUpdatePackaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: number;
      updates: Partial<InsertPackagingType>;
    }): Promise<PackagingType> => {
      const res = await apiRequest("PUT", `/api/packaging/${data.id}`, data.updates);
      return res.json();
    },
    onSuccess: (updatedPackaging) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: [`/api/packaging/products/${updatedPackaging.productId}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/packaging/products/${updatedPackaging.productId}/hierarchy`],
      });
    },
  });
}

// Hook para excluir embalagem
export function useDeletePackaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiRequest("DELETE", `/api/packaging/${id}`);
    },
    onSuccess: () => {
      // Invalidar todas as queries de packaging pois não sabemos o productId
      queryClient.invalidateQueries({
        queryKey: ["/api/packaging"],
        type: "all",
      });
    },
  });
}

// Optimized hook for fetching specific packaging
export function usePackaging(id: number) {
  return useQuery<PackagingType>({
    queryKey: [`/api/packaging/${id}`],
    queryFn: () => debouncedApiRequest('GET', `/api/packaging/${id}`),
    enabled: !!id,
    ...createOptimizedQueryConfig(5 * 60 * 1000), // 5 minutes - individual packaging details change infrequently
  });
}

// Hook para validar integridade da hierarquia de um produto
export function useValidateHierarchyIntegrity(productId: number) {
  return useQuery({
    queryKey: [`/api/packaging/products/${productId}/validate-hierarchy`],
    enabled: !!productId,
  });
}

// Hook para buscar caminho da hierarquia de uma embalagem
export function useHierarchyPath(packagingId: number) {
  return useQuery({
    queryKey: [`/api/packaging/${packagingId}/hierarchy-path`],
    enabled: !!packagingId,
  });
}

// Optimized hook for advanced packaging conversion with caching
export function useConvertBetweenPackagings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      fromPackagingId: number;
      toPackagingId: number;
      quantity: number;
    }): Promise<{
      convertedQuantity: number;
      conversionPath: Array<{ from: any; to: any; factor: number; }>;
      isExact: boolean;
    }> => {
      const cacheKey = `/api/packaging/convert-between/${data.fromPackagingId}/${data.toPackagingId}/${data.quantity}`;
      
      // Check cache first
      const cached = queryClient.getQueryData([cacheKey]);
      if (cached) {
        return cached as any;
      }
      
      const result = await debouncedApiRequest("POST", "/api/packaging/convert-between", data);
      
      // Cache advanced conversion for 15 minutes
      queryClient.setQueryData([cacheKey], result, {
        updatedAt: Date.now() + 15 * 60 * 1000,
      });
      
      return result;
    },
    onError: (error: any) => {
      console.error('Advanced packaging conversion failed:', error);
    },
  });
}

// Hook para criar hierarquia de exemplo
export function useCreateExampleHierarchy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: number): Promise<{
      baseUnit: any;
      level2: any;
      level3: any;
    }> => {
      const res = await apiRequest("POST", "/api/packaging/create-example-hierarchy", { productId });
      return res.json();
    },
    onSuccess: (_, productId) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: [`/api/packaging/products/${productId}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/packaging/products/${productId}/hierarchy`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/packaging/products/${productId}/validate-hierarchy`],
      });
    },
  });
}

// Hook para validação de dimensões em tempo real
export function useValidateDimensions() {
  return useMutation({
    mutationFn: async (data: {
      childDimensions: { length: number; width: number; height: number; };
      parentDimensions: { length: number; width: number; height: number; };
    }): Promise<{ isValid: boolean; message?: string; }> => {
      const child = data.childDimensions;
      const parent = data.parentDimensions;
      
      // Validação local - poderia ser expandida para validação no backend
      const isValid = child.length <= parent.length && 
                     child.width <= parent.width && 
                     child.height <= parent.height;
      
      return {
        isValid,
        message: isValid ? undefined : 
          `Dimensões filhas (${child.length}x${child.width}x${child.height}cm) não cabem nas dimensões pai (${parent.length}x${parent.width}x${parent.height}cm)`
      };
    },
  });
}

// Hook para calcular nível automático baseado no pai
export function useCalculateAutomaticLevel() {
  return useMutation({
    mutationFn: async (parentPackagingId?: number): Promise<number> => {
      if (!parentPackagingId) return 1;
      
      // Buscar dados do pai para calcular nível
      const res = await apiRequest("GET", `/api/packaging/${parentPackagingId}`);
      const parent = await res.json();
      
      return parent.level + 1;
    },
  });
}

// Enhanced helper functions for efficient cache management
export const invalidatePackagingQueries = async (queryClient: any, productId?: number) => {
  if (productId) {
    // Batch invalidation for better performance
    await queryClient.invalidateQueries({
      predicate: (query: any) => {
        const key = query.queryKey[0];
        return key && (
          key.includes(`/api/packaging/products/${productId}`) ||
          key.includes(`/api/packaging/scan`) // Clear scan cache for this product
        );
      },
    });
  } else {
    await queryClient.invalidateQueries({ queryKey: ["/api/packaging"], type: "all" });
  }
};

// Performance monitoring hook
export const usePackagingPerformance = () => {
  const queryClient = useQueryClient();
  
  return useMemo(() => {
    const cache = queryClient.getQueryCache();
    const packagingQueries = cache.getAll().filter(query => 
      query.queryKey[0] && query.queryKey[0].toString().includes('/api/packaging')
    );
    
    return {
      totalQueries: packagingQueries.length,
      activeQueries: packagingQueries.filter(q => q.state.fetchStatus === 'fetching').length,
      cachedQueries: packagingQueries.filter(q => q.state.data !== undefined).length,
      errorQueries: packagingQueries.filter(q => q.state.error !== null).length,
      hitRate: packagingQueries.length > 0 
       ? ((packagingQueries.filter(q => q.state.data !== undefined).length / packagingQueries.length) * 100).toFixed(1)
       : '0',
    };
  }, [queryClient]);
};

// Prefetch hook for common packaging queries
export const usePrefetchPackaging = () => {
  const queryClient = useQueryClient();
  
  return useCallback(async (productIds: number[]) => {
    const prefetchPromises = productIds.map(productId => [
      queryClient.prefetchQuery({
        queryKey: [`/api/packaging/products/${productId}`],
        queryFn: () => debouncedApiRequest('GET', `/api/packaging/products/${productId}`),
        ...createOptimizedQueryConfig(),
      }),
      queryClient.prefetchQuery({
        queryKey: [`/api/packaging/products/${productId}/hierarchy`],
        queryFn: () => debouncedApiRequest('GET', `/api/packaging/products/${productId}/hierarchy`),
        ...createOptimizedQueryConfig(2 * 60 * 1000),
      }),
    ]).flat();
    
    await Promise.allSettled(prefetchPromises);
  }, [queryClient]);
};