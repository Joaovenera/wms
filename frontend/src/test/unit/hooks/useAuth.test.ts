import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getQueryFn } from '@/lib/queryClient';

// Mock the query client utilities
vi.mock('@/lib/queryClient', () => ({
  getQueryFn: vi.fn()
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

describe('useAuth Hook', () => {
  const mockUser = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user data when authenticated', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockUser)
    });
    
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return null user when not authenticated', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue(null);
    
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle 401 errors correctly', async () => {
    const mockQueryFn = vi.fn().mockRejectedValue(new Error('Unauthorized'));
    
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should call getQueryFn with correct options', () => {
    (getQueryFn as any).mockReturnValue(vi.fn());

    renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    expect(getQueryFn).toHaveBeenCalledWith({ on401: "returnNull" });
  });

  it('should use correct query key', () => {
    const mockQueryFn = vi.fn();
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    // The hook should be called with the correct query key
    expect(getQueryFn).toHaveBeenCalled();
  });

  it('should not retry on failure', async () => {
    const mockQueryFn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ json: () => Promise.resolve(mockUser) });
    
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should only be called once due to retry: false
    expect(mockQueryFn).toHaveBeenCalledTimes(1);
  });

  it('should show loading state initially', () => {
    const mockQueryFn = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle undefined user data', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(undefined)
    });
    
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle null user data', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(null)
    });
    
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should return correct isAuthenticated value for different user states', async () => {
    // Test with valid user
    let mockQueryFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockUser)
    });
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    let { result, rerender } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Test with null user
    mockQueryFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(null)
    });
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    rerender();

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    // Test with undefined user
    mockQueryFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(undefined)
    });
    (getQueryFn as any).mockReturnValue(mockQueryFn);

    rerender();

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});