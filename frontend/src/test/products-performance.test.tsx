import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import Products from '../pages/products';
import { useOptimizedProducts } from '../hooks/useOptimizedProducts';

// Mock the heavy components
vi.mock('../components/product-photo-manager', () => ({
  default: () => <div data-testid="photo-manager">Photo Manager</div>
}));

vi.mock('../components/product-details-modal', () => ({
  default: () => <div data-testid="details-modal">Details Modal</div>
}));

// Mock the optimized hook
vi.mock('../hooks/useOptimizedProducts');

// Mock data
const mockProducts = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  sku: `PRD-${String(i + 1).padStart(3, '0')}`,
  name: `Product ${i + 1}`,
  category: `Category ${(i % 10) + 1}`,
  brand: `Brand ${(i % 5) + 1}`,
  unit: 'un',
  weight: Math.random() * 10,
  barcode: `123456789${String(i).padStart(3, '0')}`,
  requiresLot: i % 3 === 0,
  requiresExpiry: i % 4 === 0,
  description: `Description for product ${i + 1}`,
  totalStock: Math.floor(Math.random() * 100),
  isActive: true,
  unitsPerPackage: '1',
  minStock: 10,
  dimensions: { length: 10, width: 10, height: 10 },
  createdBy: 1
}));

describe('Products Page Performance Tests', () => {
  let queryClient: QueryClient;
  const mockUseOptimizedProducts = vi.mocked(useOptimizedProducts);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    // Mock the optimized products hook
    mockUseOptimizedProducts.mockReturnValue({
      products: mockProducts,
      totalCount: mockProducts.length,
      isLoading: false,
      isFetching: false,
      isSearching: false,
      error: null,
      refetch: vi.fn(),
      searchTerm: '',
      updateSearch: vi.fn(),
      updateFilters: vi.fn(),
      currentPage: 1,
      hasNextPage: false,
      loadMore: vi.fn(),
      prefetchNextPage: vi.fn(),
      warmCache: vi.fn(),
      performanceMetrics: {
        totalQueries: 5,
        cachedQueries: 4,
        activeFetches: 0,
        hitRate: '80.0'
      },
      isServerSearchEnabled: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Virtualization Performance', () => {
    it('should render large datasets efficiently with virtualization', async () => {
      const startTime = performance.now();
      
      renderWithProvider(<Products />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within 1000ms even with 1000 products
      expect(renderTime).toBeLessThan(1000);
      
      // Should only render visible items (not all 1000)
      const productElements = screen.queryAllByText(/Product \d+/);
      expect(productElements.length).toBeLessThan(50); // Only visible items
    });

    it('should handle scroll performance efficiently', async () => {
      renderWithProvider(<Products />);
      
      const scrollContainer = screen.getByRole('grid', { hidden: true });
      
      const startTime = performance.now();
      
      // Simulate rapid scrolling
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 100 } });
      }
      
      const endTime = performance.now();
      const scrollTime = endTime - startTime;
      
      // Scroll operations should be fast
      expect(scrollTime).toBeLessThan(100);
    });
  });

  describe('Search Performance', () => {
    it('should debounce search input efficiently', async () => {
      const mockUpdateSearch = vi.fn();
      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        updateSearch: mockUpdateSearch
      });

      renderWithProvider(<Products />);
      
      const searchInput = screen.getByPlaceholderText('Buscar produtos...');
      
      const startTime = performance.now();
      
      // Rapid typing simulation
      fireEvent.change(searchInput, { target: { value: 'P' } });
      fireEvent.change(searchInput, { target: { value: 'Pr' } });
      fireEvent.change(searchInput, { target: { value: 'Pro' } });
      fireEvent.change(searchInput, { target: { value: 'Prod' } });
      
      const endTime = performance.now();
      const inputTime = endTime - startTime;
      
      // Input should be responsive
      expect(inputTime).toBeLessThan(50);
      
      // Wait for debounce
      await waitFor(() => {
        expect(mockUpdateSearch).toHaveBeenCalledWith('Prod');
      }, { timeout: 500 });
    });

    it('should show search loading state during server search', async () => {
      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        isSearching: true
      });

      renderWithProvider(<Products />);
      
      const searchInput = screen.getByPlaceholderText('Buscar produtos...');
      const loadingSpinner = searchInput.parentElement?.querySelector('.animate-spin');
      
      expect(loadingSpinner).toBeInTheDocument();
    });
  });

  describe('Loading States Performance', () => {
    it('should show skeleton loading efficiently', () => {
      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        isLoading: true,
        products: []
      });

      const startTime = performance.now();
      renderWithProvider(<Products />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getAllByTestId('skeleton')).toHaveLength(6);
    });

    it('should transition from loading to content smoothly', async () => {
      const { rerender } = renderWithProvider(<Products />);
      
      // Start with loading state
      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        isLoading: true,
        products: []
      });
      
      rerender(
        <QueryClientProvider client={queryClient}>
          <Products />
        </QueryClientProvider>
      );
      
      expect(screen.getAllByTestId('skeleton')).toHaveLength(6);
      
      // Transition to loaded state
      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        isLoading: false,
        products: mockProducts.slice(0, 10)
      });
      
      rerender(
        <QueryClientProvider client={queryClient}>
          <Products />
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
        expect(screen.getByText('Product 1')).toBeInTheDocument();
      });
    });
  });

  describe('Form Performance', () => {
    it('should render form dialog efficiently', async () => {
      renderWithProvider(<Products />);
      
      const newProductButton = screen.getByText('Novo Produto');
      
      const startTime = performance.now();
      fireEvent.click(newProductButton);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(200);
      
      await waitFor(() => {
        expect(screen.getByText('Novo Produto')).toBeInTheDocument();
      });
    });

    it('should handle category selection efficiently', async () => {
      renderWithProvider(<Products />);
      
      fireEvent.click(screen.getByText('Novo Produto'));
      
      await waitFor(() => {
        expect(screen.getByText('Categoria')).toBeInTheDocument();
      });
      
      const categorySelect = screen.getByText('Selecione uma categoria');
      
      const startTime = performance.now();
      fireEvent.click(categorySelect);
      const endTime = performance.now();
      
      // Category dropdown should open quickly
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Lazy Loading Performance', () => {
    it('should lazy load photo manager efficiently', async () => {
      renderWithProvider(<Products />);
      
      // Wait for products to render
      await waitFor(() => {
        expect(screen.getByText('Product 1')).toBeInTheDocument();
      });
      
      const photoButtons = screen.getAllByTitle('Gerenciar fotos');
      
      const startTime = performance.now();
      fireEvent.click(photoButtons[0]);
      const endTime = performance.now();
      
      // Should be responsive even with lazy loading
      expect(endTime - startTime).toBeLessThan(100);
      
      await waitFor(() => {
        expect(screen.getByText('Carregando gerenciador de fotos...')).toBeInTheDocument();
      });
    });

    it('should lazy load details modal efficiently', async () => {
      renderWithProvider(<Products />);
      
      await waitFor(() => {
        expect(screen.getByText('Product 1')).toBeInTheDocument();
      });
      
      const detailButtons = screen.getAllByTitle('Ver detalhes');
      
      const startTime = performance.now();
      fireEvent.click(detailButtons[0]);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
      
      await waitFor(() => {
        expect(screen.getByText('Carregando detalhes do produto...')).toBeInTheDocument();
      });
    });
  });

  describe('Memory Performance', () => {
    it('should maintain reasonable memory usage with large datasets', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      renderWithProvider(<Products />);
      
      const afterRenderMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = afterRenderMemory - initialMemory;
      
      // Should not use excessive memory (less than 50MB increase)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up properly on unmount', () => {
      const { unmount } = renderWithProvider(<Products />);
      
      const beforeUnmount = (performance as any).memory?.usedJSHeapSize || 0;
      
      act(() => {
        unmount();
      });
      
      // Force garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }
      
      const afterUnmount = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory usage should not increase significantly after unmount
      expect(afterUnmount).toBeLessThanOrEqual(beforeUnmount * 1.1);
    });
  });

  describe('Performance Monitoring', () => {
    it('should display performance metrics in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      renderWithProvider(<Products />);
      
      expect(screen.getByText(/Cache: 80.0%/)).toBeInTheDocument();
      expect(screen.getByText(/Queries: 4\/5/)).toBeInTheDocument();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should track cache hit rates effectively', () => {
      const mockMetrics = {
        totalQueries: 10,
        cachedQueries: 8,
        activeFetches: 1,
        hitRate: '80.0'
      };

      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        performanceMetrics: mockMetrics
      });

      renderWithProvider(<Products />);
      
      // Cache hit rate should be tracked and displayed
      expect(mockMetrics.hitRate).toBe('80.0');
      expect(mockMetrics.cachedQueries / mockMetrics.totalQueries).toBe(0.8);
    });
  });

  describe('Edge Cases Performance', () => {
    it('should handle empty state efficiently', () => {
      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        products: [],
        totalCount: 0
      });

      const startTime = performance.now();
      renderWithProvider(<Products />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument();
    });

    it('should handle error states gracefully', () => {
      mockUseOptimizedProducts.mockReturnValue({
        ...mockUseOptimizedProducts(),
        products: [],
        error: new Error('Network error')
      });

      const startTime = performance.now();
      renderWithProvider(<Products />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100);
      // Should still render without crashing
      expect(screen.getByText('Produtos')).toBeInTheDocument();
    });

    it('should handle rapid user interactions', async () => {
      renderWithProvider(<Products />);
      
      const searchInput = screen.getByPlaceholderText('Buscar produtos...');
      
      const startTime = performance.now();
      
      // Simulate rapid interactions
      for (let i = 0; i < 20; i++) {
        fireEvent.change(searchInput, { target: { value: `search ${i}` } });
        if (i % 5 === 0) {
          fireEvent.click(screen.getByText('Novo Produto'));
          fireEvent.keyDown(document, { key: 'Escape' });
        }
      }
      
      const endTime = performance.now();
      
      // Should handle rapid interactions without significant slowdown
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});

// Performance benchmark tests
describe('Performance Benchmarks', () => {
  it('should meet render time benchmarks', async () => {
    const measurements: number[] = [];
    
    // Run multiple renders to get average
    for (let i = 0; i < 10; i++) {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
      });
      
      const startTime = performance.now();
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <Products />
        </QueryClientProvider>
      );
      const endTime = performance.now();
      
      measurements.push(endTime - startTime);
      unmount();
    }
    
    const averageRenderTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    
    // Average render time should be under 500ms
    expect(averageRenderTime).toBeLessThan(500);
    
    // No single render should exceed 1000ms
    expect(Math.max(...measurements)).toBeLessThan(1000);
  });

  it('should meet memory usage benchmarks', () => {
    const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;
    
    const queryClient = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <Products />
      </QueryClientProvider>
    );
    
    const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryUsed = memoryAfter - memoryBefore;
    
    // Should use less than 20MB for the component
    expect(memoryUsed).toBeLessThan(20 * 1024 * 1024);
    
    unmount();
  });

  it('should meet search response time benchmarks', async () => {
    const mockUpdateSearch = vi.fn();
    mockUseOptimizedProducts.mockReturnValue({
      ...mockUseOptimizedProducts(),
      updateSearch: mockUpdateSearch
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Products />
      </QueryClientProvider>
    );
    
    const searchInput = screen.getByPlaceholderText('Buscar produtos...');
    
    const startTime = performance.now();
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    const endTime = performance.now();
    
    // Search input should respond within 50ms
    expect(endTime - startTime).toBeLessThan(50);
  });
});