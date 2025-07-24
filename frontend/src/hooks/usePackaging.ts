import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import {
  PackagingType,
  ProductStockByPackaging,
  ProductStockConsolidated,
  OptimizedPickingPlan,
  InsertPackagingType,
} from "../types/api";

// Hook para buscar embalagens de um produto
export function useProductPackaging(productId: number) {
  return useQuery({
    queryKey: [`/api/packaging/products/${productId}`],
    enabled: !!productId,
  });
}

// Hook para buscar hierarquia de embalagens de um produto
export function useProductPackagingHierarchy(productId: number) {
  return useQuery({
    queryKey: [`/api/packaging/products/${productId}/hierarchy`],
    enabled: !!productId,
  });
}

// Hook para buscar estoque consolidado de um produto
export function useProductStockConsolidated(productId: number) {
  return useQuery<{
    packagings: PackagingType[];
    stock: ProductStockByPackaging[];
    consolidated: ProductStockConsolidated;
  }>({
    queryKey: [`/api/packaging/products/${productId}`],
    enabled: !!productId,
  });
}

// Hook para escanear código de barras
export function useScanBarcode() {
  return useMutation({
    mutationFn: async (barcode: string): Promise<PackagingType> => {
      const res = await apiRequest("POST", "/api/packaging/scan", { barcode });
      return res.json();
    },
  });
}

// Hook para otimização de separação
export function useOptimizePicking() {
  return useMutation({
    mutationFn: async (data: {
      productId: number;
      requestedBaseUnits: number;
    }): Promise<OptimizedPickingPlan> => {
      const res = await apiRequest("POST", "/api/packaging/optimize-picking", data);
      return res.json();
    },
  });
}

// Hook para conversão de quantidades entre embalagens
export function useConvertQuantity() {
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
      const res = await apiRequest("POST", "/api/packaging/convert", data);
      return res.json();
    },
  });
}

// Hook para criar nova embalagem
export function useCreatePackaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertPackagingType): Promise<PackagingType> => {
      const res = await apiRequest("POST", "/api/packaging", data);
      return res.json();
    },
    onSuccess: (newPackaging) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: [`/api/packaging/products/${newPackaging.productId}`],
      });
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
    onSuccess: (_, deletedId) => {
      // Invalidar todas as queries de packaging pois não sabemos o productId
      queryClient.invalidateQueries({
        queryKey: ["/api/packaging"],
        type: "all",
      });
    },
  });
}

// Hook para buscar uma embalagem específica
export function usePackaging(id: number) {
  return useQuery<PackagingType>({
    queryKey: [`/api/packaging/${id}`],
    enabled: !!id,
  });
}

// Helper functions para invalidação de cache
export const invalidatePackagingQueries = async (queryClient: any, productId?: number) => {
  if (productId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/packaging/products/${productId}`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/packaging/products/${productId}/hierarchy`] }),
    ]);
  } else {
    await queryClient.invalidateQueries({ queryKey: ["/api/packaging"], type: "all" });
  }
};