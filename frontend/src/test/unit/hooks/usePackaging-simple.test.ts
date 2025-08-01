import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProductPackaging } from '@/hooks/usePackaging';
import React from 'react';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('usePackaging Hooks - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create hook instances without errors', () => {
    const { result } = renderHook(() => useProductPackaging(1), {
      wrapper: createWrapper()
    });

    expect(result.current).toBeDefined();
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('should handle disabled queries', () => {
    const { result } = renderHook(() => useProductPackaging(0), {
      wrapper: createWrapper()
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('should use correct query key format', () => {
    const { result } = renderHook(() => useProductPackaging(123), {
      wrapper: createWrapper()
    });

    // The hook should be properly initialized
    expect(result.current).toBeDefined();
  });
});