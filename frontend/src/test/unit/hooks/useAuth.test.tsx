import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { getQueryFn } from '../../../lib/queryClient';

// Mock the queryClient module
vi.mock('../../../lib/queryClient', () => ({
  getQueryFn: vi.fn(),
}));

// Create a wrapper component for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useAuth Hook', () => {
  let mockQueryFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockQueryFn = vi.fn();
    vi.mocked(getQueryFn).mockReturnValue(mockQueryFn);
    vi.clearAllMocks();
  });

  describe('when user is authenticated', () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'operator',
      permissions: ['read:products', 'write:ucps'],
      isActive: true,
    };

    beforeEach(() => {
      mockQueryFn.mockResolvedValue(mockUser);
    });

    it('should return user data and authentication status', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);

      // Wait for query to resolve
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should call getQueryFn with correct parameters', async () => {
      renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(getQueryFn).toHaveBeenCalledWith({ on401: 'returnNull' });
      
      await waitFor(() => {
        expect(mockQueryFn).toHaveBeenCalled();
      });
    });

    it('should provide user details correctly', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.id).toBe(1);
      expect(result.current.user?.name).toBe('John Doe');
      expect(result.current.user?.email).toBe('john@example.com');
      expect(result.current.user?.role).toBe('operator');
      expect(result.current.user?.permissions).toEqual(['read:products', 'write:ucps']);
    });
  });

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockQueryFn.mockResolvedValue(null);
    });

    it('should return null user and unauthenticated status', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle 401 responses gracefully', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw error, just return null
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('when authentication fails', () => {
    beforeEach(() => {
      mockQueryFn.mockRejectedValue(new Error('Network error'));
    });

    it('should handle network errors gracefully', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should not retry on failure', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only call once due to retry: false
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading states', () => {
    it('should show loading state initially', () => {
      // Make query never resolve to test loading state
      mockQueryFn.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should transition from loading to loaded state', async () => {
      const mockUser = {
        id: 1,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'admin',
      };

      mockQueryFn.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('different user roles and permissions', () => {
    it('should handle admin user correctly', async () => {
      const adminUser = {
        id: 2,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        permissions: ['*'], // All permissions
        isActive: true,
      };

      mockQueryFn.mockResolvedValue(adminUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.role).toBe('admin');
      expect(result.current.user?.permissions).toEqual(['*']);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle supervisor user correctly', async () => {
      const supervisorUser = {
        id: 3,
        name: 'Supervisor User',
        email: 'supervisor@example.com',
        role: 'supervisor',
        permissions: ['read:*', 'write:ucps', 'write:transfers'],
        isActive: true,
      };

      mockQueryFn.mockResolvedValue(supervisorUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.role).toBe('supervisor');
      expect(result.current.user?.permissions).toContain('read:*');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle operator user with limited permissions', async () => {
      const operatorUser = {
        id: 4,
        name: 'Operator User',
        email: 'operator@example.com',
        role: 'operator',
        permissions: ['read:products', 'read:pallets'],
        isActive: true,
      };

      mockQueryFn.mockResolvedValue(operatorUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.role).toBe('operator');
      expect(result.current.user?.permissions).toEqual(['read:products', 'read:pallets']);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle inactive user', async () => {
      const inactiveUser = {
        id: 5,
        name: 'Inactive User',
        email: 'inactive@example.com',
        role: 'operator',
        permissions: ['read:products'],
        isActive: false,
      };

      mockQueryFn.mockResolvedValue(inactiveUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.isActive).toBe(false);
      expect(result.current.isAuthenticated).toBe(true); // Still authenticated, but inactive
    });
  });

  describe('query key configuration', () => {
    it('should use correct query key', async () => {
      mockQueryFn.mockResolvedValue(null);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, cacheTime: 0 },
        },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check if the query was cached with the correct key
      const cachedData = queryClient.getQueryData(['/api/user']);
      expect(cachedData).toBeDefined();
    });

    it('should not retry failed requests', async () => {
      mockQueryFn.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only be called once due to retry: false
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle malformed user data', async () => {
      const malformedUser = {
        // Missing required fields
        name: 'Test User',
        // Missing id, email, role
      };

      mockQueryFn.mockResolvedValue(malformedUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(malformedUser);
      expect(result.current.isAuthenticated).toBe(true); // Still truthy
    });

    it('should handle empty user object', async () => {
      mockQueryFn.mockResolvedValue({});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual({});
      expect(result.current.isAuthenticated).toBe(true); // Empty object is truthy
    });

    it('should handle false values correctly', async () => {
      mockQueryFn.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle undefined response', async () => {
      mockQueryFn.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle timeout errors', async () => {
      mockQueryFn.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.user).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('performance and caching', () => {
    it('should cache user data between hook instances', async () => {
      const mockUser = {
        id: 1,
        name: 'Cached User',
        email: 'cached@example.com',
        role: 'operator',
      };

      mockQueryFn.mockResolvedValue(mockUser);

      const wrapper = createWrapper();

      // First hook instance
      const { result: result1 } = renderHook(() => useAuth(), { wrapper });
      
      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Second hook instance - should use cached data
      const { result: result2 } = renderHook(() => useAuth(), { wrapper });

      // Should immediately have data from cache
      expect(result2.current.user).toEqual(mockUser);
      expect(result2.current.isAuthenticated).toBe(true);

      // API should only be called once
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid successive calls efficiently', async () => {
      mockQueryFn.mockResolvedValue({ id: 1, name: 'User' });

      const wrapper = createWrapper();

      // Render multiple instances quickly
      const hooks = Array.from({ length: 5 }, () =>
        renderHook(() => useAuth(), { wrapper })
      );

      // Wait for all to complete
      await Promise.all(
        hooks.map(({ result }) =>
          waitFor(() => expect(result.current.isLoading).toBe(false))
        )
      );

      // All should have the same data
      hooks.forEach(({ result }) => {
        expect(result.current.user?.id).toBe(1);
        expect(result.current.isAuthenticated).toBe(true);
      });

      // API should still only be called once due to deduplication
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });
  });
});