import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import {
  CompositionRequest,
  CompositionResult,
  ValidationResult,
  CompositionReport,
  PackagingComposition
} from "../types/api";

// Hook for creating and validating compositions
export function useCreateComposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CompositionRequest): Promise<CompositionResult> => {
      const res = await apiRequest("POST", "/api/compositions/calculate", request);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/compositions"],
      });
    },
  });
}

// Hook for validating composition constraints
export function useValidateComposition() {
  return useMutation({
    mutationFn: async (request: CompositionRequest): Promise<ValidationResult> => {
      const res = await apiRequest("POST", "/api/compositions/validate", request);
      return res.json();
    },
  });
}

// Hook for generating composition reports
export function useGenerateCompositionReport() {
  return useMutation({
    mutationFn: async (data: {
      compositionId: number;
      includeMetrics?: boolean;
      includeRecommendations?: boolean;
      includeCostAnalysis?: boolean;
    }): Promise<CompositionReport> => {
      const res = await apiRequest("POST", "/api/compositions/report", data);
      return res.json();
    },
  });
}

// Hook for getting saved compositions
export function useCompositions(filters?: {
  status?: string;
  palletId?: number;
  createdBy?: number;
}) {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.palletId) queryParams.append('palletId', filters.palletId.toString());
  if (filters?.createdBy) queryParams.append('createdBy', filters.createdBy.toString());
  
  const queryString = queryParams.toString();
  const queryKey = `/api/compositions${queryString ? `?${queryString}` : ''}`;

  return useQuery<PackagingComposition[]>({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await apiRequest('GET', queryKey);
      return await res.json();
    }
  });
}

// Hook for getting a specific composition
export function useComposition(id: number) {
  return useQuery<PackagingComposition>({
    queryKey: [`/api/compositions/${id}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/compositions/${id}`);
      return await res.json();
    },
    enabled: !!id,
  });
}

// Hook for updating composition status
export function useUpdateCompositionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: number;
      status: 'draft' | 'validated' | 'approved' | 'executed';
      notes?: string;
    }): Promise<PackagingComposition> => {
      const res = await apiRequest("PUT", `/api/compositions/${data.id}/status`, {
        status: data.status,
        notes: data.notes,
      });
      return res.json();
    },
    onSuccess: (updatedComposition) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/compositions/${updatedComposition.id}`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/compositions"],
      });
    },
  });
}

// Hook for saving composition (create or update)
export function useSaveComposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id?: number;
      name: string;
      description?: string;
      compositionData: CompositionResult;
      products: Array<{
        productId: number;
        quantity: number;
        packagingTypeId?: number;
      }>;
      palletId: number;
      status?: 'draft' | 'validated' | 'approved' | 'executed';
    }): Promise<PackagingComposition> => {
      const endpoint = data.id ? `/api/compositions/${data.id}` : "/api/compositions";
      const method = data.id ? "PUT" : "POST";
      
      const res = await apiRequest(method, endpoint, {
        name: data.name,
        description: data.description,
        products: data.products,
        palletId: data.palletId,
        result: data.compositionData,
        status: data.status || 'draft',
      });
      return res.json();
    },
    onSuccess: (composition) => {
      if (!composition.id) return;
      
      queryClient.invalidateQueries({
        queryKey: [`/api/compositions/${composition.id}`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/compositions"],
      });
    },
  });
}

// Hook for deleting a composition
export function useDeleteComposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiRequest("DELETE", `/api/compositions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/compositions"],
      });
    },
  });
}

// Hook for getting composition optimization suggestions
export function useCompositionOptimization() {
  return useMutation({
    mutationFn: async (request: CompositionRequest): Promise<{
      suggestions: Array<{
        type: 'packaging' | 'layout' | 'pallet';
        message: string;
        impact: string;
        alternativeRequest?: CompositionRequest;
      }>;
      alternativeCompositions: CompositionResult[];
    }> => {
      const res = await apiRequest("POST", "/api/compositions/optimize", request);
      return res.json();
    },
  });
}

// Hook for real-time composition validation (debounced)
export function useRealtimeCompositionValidation(
  request: CompositionRequest | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['/api/compositions/validate', request],
    queryFn: async () => {
      if (!request) return null;
      const res = await apiRequest("POST", "/api/compositions/validate", request);
      return res.json() as Promise<ValidationResult>;
    },
    enabled: enabled && !!request,
    staleTime: 5000, // Cache for 5 seconds
    refetchOnWindowFocus: false,
  });
}

// Helper functions for cache invalidation
export const invalidateCompositionQueries = async (queryClient: any, compositionId?: number) => {
  if (compositionId) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/compositions/${compositionId}`] }),
      queryClient.invalidateQueries({ queryKey: ["/api/compositions"] }),
    ]);
  } else {
    await queryClient.invalidateQueries({ queryKey: ["/api/compositions"], type: "all" });
  }
};