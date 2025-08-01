import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProductPackaging,
  useProductPackagingHierarchy,
  useProductStockConsolidated,
  useScanBarcode,
  useOptimizePicking,
  useConvertQuantity,
  useCreatePackaging,
  useUpdatePackaging,
  useDeletePackaging,
  usePackaging,
} from '../../../hooks/usePackaging';
import { apiRequest } from '../../../lib/queryClient';

// Mock the apiRequest function
vi.mock('../../../lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

// Create a wrapper component for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock data
const mockPackaging = {
  id: 1,
  productId: 1,
  name: 'Unit',
  level: 0,
  baseUnitQuantity: 1,
  isBaseUnit: true,
  isActive: true,
  barcode: 'UNIT001',
  weight: 0.5,
  dimensions: { length: 10, width: 10, height: 5 },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  createdBy: 1,
};

const mockPackagingHierarchy = [
  {
    ...mockPackaging,
    children: [
      {
        id: 2,
        productId: 1,
        name: 'Box',
        level: 1,
        baseUnitQuantity: 12,
        isBaseUnit: false,
        children: [],
      },
    ],
  },
];

const mockStockConsolidated = {
  packagings: [mockPackaging],
  stock: [
    {
      packagingId: 1,
      availablePackages: 100,
      totalBaseUnits: 100,
    },
  ],
  consolidated: {
    totalBaseUnits: 100,
    totalPackages: 1,
    averagePackageSize: 1,
  },
};

describe('Packaging Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProductPackaging', () => {
    it('should fetch packaging for a product', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue([mockPackaging]) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useProductPackaging(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([mockPackaging]);
    });

    it('should not fetch when productId is falsy', () => {
      renderHook(() => useProductPackaging(0), {
        wrapper: createWrapper(),
      });

      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProductPackaging(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('useProductPackagingHierarchy', () => {
    it('should fetch packaging hierarchy for a product', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockPackagingHierarchy) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useProductPackagingHierarchy(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPackagingHierarchy);
    });

    it('should use correct query key', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue([]) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, cacheTime: 0 } },
      });

      renderHook(() => useProductPackagingHierarchy(1), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      await waitFor(() => {
        const cachedData = queryClient.getQueryData(['/api/packaging/products/1/hierarchy']);
        expect(cachedData).toBeDefined();
      });
    });
  });

  describe('useProductStockConsolidated', () => {
    it('should fetch consolidated stock data', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockStockConsolidated) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useProductStockConsolidated(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStockConsolidated);
      expect(result.current.data?.consolidated.totalBaseUnits).toBe(100);
    });

    it('should handle empty stock data', async () => {
      const emptyStock = {
        packagings: [],
        stock: [],
        consolidated: { totalBaseUnits: 0, totalPackages: 0, averagePackageSize: 0 },
      };

      const mockResponse = { json: vi.fn().mockResolvedValue(emptyStock) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useProductStockConsolidated(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.consolidated.totalBaseUnits).toBe(0);
    });
  });

  describe('useScanBarcode', () => {
    it('should scan barcode and return packaging', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const packaging = await result.current.mutateAsync('UNIT001');
        expect(packaging).toEqual(mockPackaging);
      });

      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/packaging/scan', {
        barcode: 'UNIT001',
      });
    });

    it('should handle invalid barcode', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Barcode not found'));

      const { result } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync('INVALID')
      ).rejects.toThrow('Barcode not found');
    });

    it('should handle network errors during scan', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync('UNIT001')
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('useOptimizePicking', () => {
    const mockOptimizedPlan = {
      canFulfill: true,
      totalPlanned: 100,
      remaining: 0,
      pickingPlan: [
        {
          packagingId: 1,
          packagingName: 'Unit',
          baseUnits: 100,
          packages: 100,
        },
      ],
    };

    it('should optimize picking plan', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockOptimizedPlan) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useOptimizePicking(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const plan = await result.current.mutateAsync({
          productId: 1,
          requestedBaseUnits: 100,
        });
        expect(plan).toEqual(mockOptimizedPlan);
      });

      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/packaging/optimize-picking', {
        productId: 1,
        requestedBaseUnits: 100,
      });
    });

    it('should handle insufficient stock', async () => {
      const insufficientPlan = {
        canFulfill: false,
        totalPlanned: 50,
        remaining: 50,
        pickingPlan: [
          {
            packagingId: 1,
            packagingName: 'Unit',
            baseUnits: 50,
            packages: 50,
          },
        ],
      };

      const mockResponse = { json: vi.fn().mockResolvedValue(insufficientPlan) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useOptimizePicking(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const plan = await result.current.mutateAsync({
          productId: 1,
          requestedBaseUnits: 100,
        });
        expect(plan.canFulfill).toBe(false);
        expect(plan.remaining).toBe(50);
      });
    });

    it('should handle zero request quantity', async () => {
      const zeroPlan = {
        canFulfill: true,
        totalPlanned: 0,
        remaining: 0,
        pickingPlan: [],
      };

      const mockResponse = { json: vi.fn().mockResolvedValue(zeroPlan) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useOptimizePicking(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const plan = await result.current.mutateAsync({
          productId: 1,
          requestedBaseUnits: 0,
        });
        expect(plan.totalPlanned).toBe(0);
        expect(plan.pickingPlan).toEqual([]);
      });
    });
  });

  describe('useConvertQuantity', () => {
    const mockConversion = {
      originalQuantity: 10,
      originalPackagingId: 1,
      convertedQuantity: 1.67,
      targetPackagingId: 2,
      baseUnits: 10,
    };

    it('should convert quantity between packagings', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockConversion) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useConvertQuantity(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const conversion = await result.current.mutateAsync({
          quantity: 10,
          fromPackagingId: 1,
          toPackagingId: 2,
        });
        expect(conversion).toEqual(mockConversion);
      });

      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/packaging/convert', {
        quantity: 10,
        fromPackagingId: 1,
        toPackagingId: 2,
      });
    });

    it('should handle same packaging conversion', async () => {
      const sameConversion = {
        originalQuantity: 5,
        originalPackagingId: 1,
        convertedQuantity: 5,
        targetPackagingId: 1,
        baseUnits: 5,
      };

      const mockResponse = { json: vi.fn().mockResolvedValue(sameConversion) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useConvertQuantity(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const conversion = await result.current.mutateAsync({
          quantity: 5,
          fromPackagingId: 1,
          toPackagingId: 1,
        });
        expect(conversion.convertedQuantity).toBe(5);
      });
    });

    it('should handle decimal quantities', async () => {
      const decimalConversion = {
        originalQuantity: 2.5,
        originalPackagingId: 2,
        convertedQuantity: 30,
        targetPackagingId: 1,
        baseUnits: 30,
      };

      const mockResponse = { json: vi.fn().mockResolvedValue(decimalConversion) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useConvertQuantity(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const conversion = await result.current.mutateAsync({
          quantity: 2.5,
          fromPackagingId: 2,
          toPackagingId: 1,
        });
        expect(conversion.convertedQuantity).toBe(30);
      });
    });
  });

  describe('useCreatePackaging', () => {
    const newPackagingData = {
      productId: 1,
      name: 'Case',
      level: 2,
      baseUnitQuantity: 24,
      isBaseUnit: false,
      barcode: 'CASE001',
    };

    const createdPackaging = {
      id: 3,
      ...newPackagingData,
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      createdBy: 1,
    };

    it('should create new packaging', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(createdPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const { result } = renderHook(() => useCreatePackaging(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      await act(async () => {
        const packaging = await result.current.mutateAsync(newPackagingData);
        expect(packaging).toEqual(createdPackaging);
      });

      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/packaging', newPackagingData);
    });

    it('should invalidate related queries on success', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(createdPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreatePackaging(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      await act(async () => {
        await result.current.mutateAsync(newPackagingData);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['/api/packaging/products/1'],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['/api/packaging/products/1/hierarchy'],
      });
    });

    it('should handle duplicate barcode error', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Barcode already exists'));

      const { result } = renderHook(() => useCreatePackaging(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync(newPackagingData)
      ).rejects.toThrow('Barcode already exists');
    });
  });

  describe('useUpdatePackaging', () => {
    const updateData = {
      name: 'Updated Case',
      baseUnitQuantity: 25,
    };

    const updatedPackaging = {
      ...mockPackaging,
      id: 2,
      ...updateData,
      updatedAt: '2023-01-02T00:00:00Z',
    };

    it('should update packaging', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(updatedPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useUpdatePackaging(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const packaging = await result.current.mutateAsync({
          id: 2,
          updates: updateData,
        });
        expect(packaging).toEqual(updatedPackaging);
      });

      expect(apiRequest).toHaveBeenCalledWith('PUT', '/api/packaging/2', updateData);
    });

    it('should handle non-existent packaging', async () => {
      vi.mocked(apiRequest).mockResolvedValue({
        status: 404,
        json: vi.fn().mockResolvedValue({ message: 'Packaging not found' }),
      } as any);

      const { result } = renderHook(() => useUpdatePackaging(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ id: 999, updates: updateData })
      ).rejects.toBeDefined();
    });
  });

  describe('useDeletePackaging', () => {
    it('should delete packaging', async () => {
      vi.mocked(apiRequest).mockResolvedValue({
        status: 204,
      } as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeletePackaging(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      await act(async () => {
        await result.current.mutateAsync(2);
      });

      expect(apiRequest).toHaveBeenCalledWith('DELETE', '/api/packaging/2');
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['/api/packaging'],
        type: 'all',
      });
    });

    it('should handle deletion of non-existent packaging', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Packaging not found'));

      const { result } = renderHook(() => useDeletePackaging(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync(999)).rejects.toThrow('Packaging not found');
    });
  });

  describe('usePackaging', () => {
    it('should fetch specific packaging by ID', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => usePackaging(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPackaging);
    });

    it('should not fetch when ID is falsy', () => {
      renderHook(() => usePackaging(0), {
        wrapper: createWrapper(),
      });

      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('should handle 404 response', async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error('Not found'));

      const { result } = renderHook(() => usePackaging(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle concurrent mutations', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result: scanResult } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper(),
      });

      const { result: convertResult } = renderHook(() => useConvertQuantity(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const [scanPromise, convertPromise] = await Promise.allSettled([
          scanResult.current.mutateAsync('UNIT001'),
          convertResult.current.mutateAsync({
            quantity: 10,
            fromPackagingId: 1,
            toPackagingId: 2,
          }),
        ]);

        expect(scanPromise.status).toBe('fulfilled');
        expect(convertPromise.status).toBe('fulfilled');
      });
    });

    it('should handle large quantity conversions', async () => {
      const largeConversion = {
        originalQuantity: 1000000,
        originalPackagingId: 1,
        convertedQuantity: 83333.33,
        targetPackagingId: 2,
        baseUnits: 1000000,
      };

      const mockResponse = { json: vi.fn().mockResolvedValue(largeConversion) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useConvertQuantity(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const conversion = await result.current.mutateAsync({
          quantity: 1000000,
          fromPackagingId: 1,
          toPackagingId: 2,
        });
        expect(conversion.originalQuantity).toBe(1000000);
      });
    });

    it('should handle special characters in barcode', async () => {
      const specialBarcode = 'UNIT-001_@#$';
      const mockResponse = { json: vi.fn().mockResolvedValue(mockPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(specialBarcode);
      });

      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/packaging/scan', {
        barcode: specialBarcode,
      });
    });

    it('should handle rapid successive scanning', async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue(mockPackaging) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper(),
      });

      const barcodes = ['UNIT001', 'UNIT002', 'UNIT003', 'UNIT004', 'UNIT005'];

      await act(async () => {
        const promises = barcodes.map(barcode => 
          result.current.mutateAsync(barcode)
        );
        await Promise.all(promises);
      });

      expect(apiRequest).toHaveBeenCalledTimes(5);
    });
  });
});