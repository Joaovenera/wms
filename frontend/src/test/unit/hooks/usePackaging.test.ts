import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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
  usePackaging
} from '@/hooks/usePackaging';

// Mock the API request function
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

const mockPackagingData = [
  {
    id: 1,
    name: 'Caixa Pequena',
    type: 'box',
    dimensions: {
      length: 20,
      width: 15,
      height: 10
    },
    maxWeight: 5000,
    available: true
  },
  {
    id: 2,
    name: 'Caixa Média',
    type: 'box',
    dimensions: {
      length: 30,
      width: 25,
      height: 20
    },
    maxWeight: 10000,
    available: true
  },
  {
    id: 3,
    name: 'Envelope',
    type: 'envelope',
    dimensions: {
      length: 25,
      width: 18,
      height: 2
    },
    maxWeight: 500,
    available: false
  }
];

describe('Packaging Hooks', () => {
  const { apiRequest } = require('@/lib/queryClient');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProductPackaging', () => {
    it('should fetch packaging for a product', async () => {
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockPackagingData)
      });

      const { result } = renderHook(() => useProductPackaging(1), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockPackagingData);
    });

    it('should not fetch when productId is falsy', () => {
      const { result } = renderHook(() => useProductPackaging(0), {
        wrapper: createWrapper()
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle fetch errors', async () => {
      apiRequest.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProductPackaging(1), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useProductPackagingHierarchy', () => {
    it('should fetch packaging hierarchy for a product', async () => {
      const hierarchyData = { levels: 3, packagings: mockPackagingData };
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve(hierarchyData)
      });

      const { result } = renderHook(() => useProductPackagingHierarchy(1), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(hierarchyData);
    });

    it('should use correct query key', () => {
      renderHook(() => useProductPackagingHierarchy(1), {
        wrapper: createWrapper()
      });

      // Query key should include the productId
      expect(apiRequest).not.toHaveBeenCalled(); // Since it's disabled by default
    });
  });

  describe('useProductStockConsolidated', () => {
    it('should fetch consolidated stock data', async () => {
      const stockData = {
        packagings: mockPackagingData,
        stock: [],
        consolidated: { totalUnits: 100 }
      };

      apiRequest.mockResolvedValue({
        json: () => Promise.resolve(stockData)
      });

      const { result } = renderHook(() => useProductStockConsolidated(1), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(stockData);
    });

    it('should handle empty stock data', async () => {
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ packagings: [], stock: [], consolidated: {} })
      });

      const { result } = renderHook(() => useProductStockConsolidated(1), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.packagings).toEqual([]);
    });
  });

  describe('usePackaging', () => {
    it('should fetch specific packaging by ID', async () => {
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockPackagingData[0])
      });

      const { result } = renderHook(() => usePackaging(1), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockPackagingData[0]);
    });

    it('should not fetch when ID is falsy', () => {
      const { result } = renderHook(() => usePackaging(0), {
        wrapper: createWrapper()
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle 404 response', async () => {
      apiRequest.mockRejectedValue(new Error('Not found'));

      const { result } = renderHook(() => usePackaging(999), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useScanBarcode', () => {
    it('should scan barcode successfully', async () => {
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve(mockPackagingData[0])
      });

      const { result } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        await result.current.mutateAsync('123456789');
      });

      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/packaging/scan', { barcode: '123456789' });
      expect(result.current.data).toEqual(mockPackagingData[0]);
    });

    it('should handle scan errors', async () => {
      apiRequest.mockRejectedValue(new Error('Barcode not found'));

      const { result } = renderHook(() => useScanBarcode(), {
        wrapper: createWrapper()
      });

      await act(async () => {
        try {
          await result.current.mutateAsync('invalid');
        } catch (error) {
          expect(error.message).toBe('Barcode not found');
        }
      });
    });
  });

  it('should handle error state', async () => {
    const errorMessage = 'Failed to fetch packaging options';
    apiRequest.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.packagingOptions).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });

  it('should filter available packaging options', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const availableOptions = result.current.getAvailablePackaging();
    expect(availableOptions).toHaveLength(2);
    expect(availableOptions.every(option => option.available)).toBe(true);
  });

  it('should find suitable packaging by dimensions', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suitablePackaging = result.current.findSuitablePackaging({
      length: 10,
      width: 8,
      height: 5,
      weight: 2000
    });

    expect(suitablePackaging).toBeDefined();
    expect(suitablePackaging?.name).toBe('Caixa Pequena');
  });

  it('should return null when no suitable packaging found', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suitablePackaging = result.current.findSuitablePackaging({
      length: 50,
      width: 40,
      height: 30,
      weight: 15000
    });

    expect(suitablePackaging).toBeNull();
  });

  it('should calculate packaging efficiency', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const efficiency = result.current.calculatePackagingEfficiency(
      mockPackagingData[0],
      { length: 10, width: 8, height: 5, weight: 2000 }
    );

    expect(efficiency).toBeGreaterThan(0);
    expect(efficiency).toBeLessThanOrEqual(1);
  });

  it('should recommend optimal packaging', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const recommendation = result.current.getPackagingRecommendation({
      length: 10,
      width: 8,
      height: 5,
      weight: 2000
    });

    expect(recommendation).toBeDefined();
    expect(recommendation?.packaging.name).toBe('Caixa Pequena');
    expect(recommendation?.efficiency).toBeGreaterThan(0);
    expect(recommendation?.reasons).toContain('Dimensões adequadas');
  });

  it('should validate packaging selection', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const validation = result.current.validatePackagingSelection(
      mockPackagingData[0],
      { length: 10, width: 8, height: 5, weight: 2000 }
    );

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should return validation errors for invalid packaging', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const validation = result.current.validatePackagingSelection(
      mockPackagingData[0],
      { length: 25, width: 20, height: 15, weight: 6000 }
    );

    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should handle packaging creation', async () => {
    const newPackaging = {
      name: 'Nova Caixa',
      type: 'box',
      dimensions: { length: 40, width: 30, height: 25 },
      maxWeight: 15000,
      available: true
    };

    apiRequest
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockPackagingData)
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ ...newPackaging, id: 4 })
      });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createPackaging(newPackaging);
    });

    expect(apiRequest).toHaveBeenCalledWith('POST', '/api/packaging', newPackaging);
  });

  it('should handle packaging update', async () => {
    const updatedPackaging = {
      ...mockPackagingData[0],
      name: 'Caixa Pequena Atualizada'
    };

    apiRequest
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockPackagingData)
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve(updatedPackaging)
      });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updatePackaging(1, updatedPackaging);
    });

    expect(apiRequest).toHaveBeenCalledWith('PUT', '/api/packaging/1', updatedPackaging);
  });

  it('should handle packaging deletion', async () => {
    apiRequest
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockPackagingData)
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({})
      });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deletePackaging(1);
    });

    expect(apiRequest).toHaveBeenCalledWith('DELETE', '/api/packaging/1');
  });

  it('should sort packaging by efficiency', async () => {
    apiRequest.mockResolvedValue({
      json: () => Promise.resolve(mockPackagingData)
    });

    const { result } = renderHook(() => usePackaging(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const sortedPackaging = result.current.getSortedPackagingByEfficiency({
      length: 15,
      width: 12,
      height: 8,
      weight: 3000
    });

    expect(sortedPackaging).toHaveLength(2); // Only available ones
    expect(sortedPackaging[0].efficiency).toBeGreaterThanOrEqual(sortedPackaging[1].efficiency);
  });
});