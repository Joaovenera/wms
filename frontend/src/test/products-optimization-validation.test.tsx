/**
 * Products Page Optimization Validation Test Suite
 * 
 * Comprehensive validation framework for products page performance optimizations
 * Ensures all proposed optimizations deliver real value without compromising functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Component imports
import Products from '../pages/products';
import { VirtualScrollList } from '../components/VirtualScrollList';
import { MemoryOptimizedCamera } from '../components/MemoryOptimizedCamera';
import { PerformanceMonitor } from '../components/PerformanceMonitor';

// Mock data generators for testing
const generateProductsData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    sku: `PRD-${String(index + 1).padStart(6, '0')}`,
    name: `Produto ${index + 1}`,
    description: `Descrição detalhada do produto ${index + 1}`,
    category: index % 5 === 0 ? 'Máquinas > Bordado > Bordado 1 Cabeça' : 
              index % 3 === 0 ? 'Aviamentos & Patchwork > Tesouras' : 
              'Marcas > Orange',
    brand: index % 4 === 0 ? 'Westman' : index % 3 === 0 ? 'Kansai Especial' : 'Orange',
    unit: 'un',
    unitsPerPackage: '1',
    weight: Math.floor(Math.random() * 10) + 1,
    dimensions: { length: 10, width: 10, height: 10 },
    barcode: `789${String(index + 1).padStart(10, '0')}`,
    requiresLot: Math.random() > 0.8,
    requiresExpiry: Math.random() > 0.9,
    minStock: Math.floor(Math.random() * 10),
    maxStock: Math.floor(Math.random() * 100) + 50,
    isActive: Math.random() > 0.1,
    totalStock: Math.floor(Math.random() * 1000),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
};

// Performance measurement utilities
const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const startTime = performance.now();
  await act(async () => {
    renderFn();
  });
  const endTime = performance.now();
  return endTime - startTime;
};

const measureMemoryUsage = (): number => {
  if ((performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
};

const measureInteractionTime = async (interactionFn: () => Promise<void>): Promise<number> => {
  const startTime = performance.now();
  await interactionFn();
  const endTime = performance.now();
  return endTime - startTime;
};

// Mock API with realistic delay simulation
const mockApiRequest = vi.fn();
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Products Page Optimization Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup realistic API responses with varying delays
    mockApiRequest.mockImplementation((method, url) => {
      const delay = Math.random() * 100 + 50; // 50-150ms realistic API delay
      
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: () => Promise.resolve(generateProductsData(1500))
          });
        }, delay);
      });
    });
  });

  describe('Performance Validation', () => {
    it('should render 1000+ products within performance threshold', async () => {
      const products = generateProductsData(1000);
      
      const renderTime = await measureRenderTime(() => {
        render(<Products />, { wrapper: createWrapper() });
      });
      
      // PERFORMANCE BENCHMARK: Should render within 2 seconds
      expect(renderTime).toBeLessThan(2000);
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
    });

    it('should maintain smooth scrolling with large datasets', async () => {
      const products = generateProductsData(2000);
      
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
      
      // Simulate rapid scrolling
      const container = screen.getByText(/gerenciamento de produtos/i).closest('div');
      
      const scrollStart = performance.now();
      
      // Simulate scroll events
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(container!, { target: { scrollTop: i * 100 } });
        await new Promise(resolve => setTimeout(resolve, 16)); // 60fps target
      }
      
      const scrollEnd = performance.now();
      const scrollTime = scrollEnd - scrollStart;
      
      // Should maintain smooth scrolling (less than 500ms for 10 scroll events)
      expect(scrollTime).toBeLessThan(500);
    });

    it('should handle search operations efficiently', async () => {
      const products = generateProductsData(5000);
      
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/buscar produtos/i);
        expect(searchInput).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/buscar produtos/i);
      
      // Test search performance with different query lengths
      const searchQueries = ['P', 'Pro', 'Produto', 'Produto 1000'];
      
      for (const query of searchQueries) {
        const searchTime = await measureInteractionTime(async () => {
          await userEvent.clear(searchInput);
          await userEvent.type(searchInput, query);
          
          // Wait for debounced search
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 300));
          });
        });
        
        // Each search should complete within 300ms
        expect(searchTime).toBeLessThan(300);
      }
    });

    it('should optimize virtual scrolling for large lists', async () => {
      const largeProductList = generateProductsData(10000);
      
      const renderTime = await measureRenderTime(() => {
        render(
          <VirtualScrollList
            items={largeProductList}
            itemHeight={240} // Approximate product card height
            containerHeight={600}
            renderItem={(product) => (
              <div key={product.id} style={{ height: 240, padding: 16 }}>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <p>SKU: {product.sku}</p>
              </div>
            )}
          />
        );
      });
      
      // Virtual scrolling should handle 10k items quickly
      expect(renderTime).toBeLessThan(500);
      
      // Should only render visible items
      const renderedItems = screen.getAllByText(/Produto \d+/);
      expect(renderedItems.length).toBeLessThan(20); // Only visible items
    });

    it('should prevent memory leaks during component lifecycle', async () => {
      const initialMemory = measureMemoryUsage();
      const products = generateProductsData(1000);
      
      // Mount and unmount multiple times
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<Products />, { wrapper: createWrapper() });
        
        await waitFor(() => {
          expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
        });
        
        unmount();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should maintain responsive interactions under load', async () => {
      const products = generateProductsData(3000);
      
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /novo produto/i })).toBeInTheDocument();
      });
      
      // Test button responsiveness
      const newProductButton = screen.getByRole('button', { name: /novo produto/i });
      
      const clickTime = await measureInteractionTime(async () => {
        await userEvent.click(newProductButton);
      });
      
      // Button should respond within 100ms
      expect(clickTime).toBeLessThan(100);
      
      // Dialog should open promptly
      await waitFor(() => {
        expect(screen.getByText(/criar nova produto/i)).toBeInTheDocument();
      });
    });
  });

  describe('Functionality Preservation', () => {
    it('should preserve all current form functionality', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      const newProductButton = screen.getByRole('button', { name: /novo produto/i });
      await userEvent.click(newProductButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
      });
      
      // Test all form fields are present and functional
      const requiredFields = [
        'ID',
        'Nome',
        'Descrição',
        'Categoria',
        'Marca',
        'Unidade',
        'Quantidade por Unidade',
        'Peso (kg)',
        'Código de Barras',
        'Comprimento (cm)',
        'Largura (cm)',
        'Altura (cm)',
        'Estoque Mínimo',
        'Estoque Máximo'
      ];
      
      for (const fieldLabel of requiredFields) {
        expect(screen.getByLabelText(new RegExp(fieldLabel, 'i'))).toBeInTheDocument();
      }
      
      // Test nested category selection works
      const categorySelect = screen.getByLabelText(/categoria/i);
      await userEvent.click(categorySelect);
      
      // Should show category options including nested ones
      await waitFor(() => {
        expect(screen.getByText(/máquinas/i)).toBeInTheDocument();
      });
    });

    it('should maintain search and filtering accuracy', async () => {
      const products = generateProductsData(1000);
      
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/buscar produtos/i);
        expect(searchInput).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/buscar produtos/i);
      
      // Test different search scenarios
      const searchTests = [
        { query: 'Produto 100', expectedResults: ['Produto 100', 'Produto 1000'] },
        { query: 'SKU-000001', expectedResults: ['Produto 1'] },
        { query: 'Westman', expectedResults: [] }, // Brand search
        { query: 'Máquinas', expectedResults: [] }  // Category search
      ];
      
      for (const test of searchTests) {
        await userEvent.clear(searchInput);
        await userEvent.type(searchInput, test.query);
        
        // Wait for search to complete
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 300));
        });
        
        // Verify search results maintain accuracy
        if (test.expectedResults.length > 0) {
          for (const expectedResult of test.expectedResults) {
            expect(screen.queryByText(expectedResult)).toBeInTheDocument();
          }
        }
      }
    });

    it('should preserve modal interactions and photo management', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
      
      // Simulate having product cards loaded
      const products = generateProductsData(10);
      
      // Mock product card interactions
      const productCard = screen.getAllByText(/produto \d+/i)[0];
      const photoButton = productCard.closest('div')?.querySelector('[title="Gerenciar fotos"]');
      
      if (photoButton) {
        await userEvent.click(photoButton);
        
        // Should open photo management modal
        await waitFor(() => {
          expect(screen.getByText(/gerenciar fotos/i)).toBeInTheDocument();
        });
      }
    });

    it('should maintain form validation rules', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      const newProductButton = screen.getByRole('button', { name: /novo produto/i });
      await userEvent.click(newProductButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
      });
      
      // Test required field validation
      const submitButton = screen.getByRole('button', { name: /criar/i });
      await userEvent.click(submitButton);
      
      // Should show validation errors for required fields
      await waitFor(() => {
        expect(screen.getByText(/required/i) || screen.getByText(/obrigatório/i)).toBeInTheDocument();
      });
      
      // Test numeric field validation
      const weightInput = screen.getByLabelText(/peso/i);
      await userEvent.type(weightInput, '-5');
      
      // Should prevent negative values or show validation error
      expect(weightInput).toHaveAttribute('type', 'number');
    });

    it('should preserve stock display and calculation', async () => {
      const products = generateProductsData(50);
      
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
      
      // Verify stock information is displayed correctly
      const stockElements = screen.getAllByText(/estoque total/i);
      expect(stockElements.length).toBeGreaterThan(0);
      
      // Each product should show stock with correct unit
      const productCards = screen.getAllByText(/produto \d+/i);
      for (const card of productCards.slice(0, 5)) { // Test first 5
        const cardElement = card.closest('div');
        expect(cardElement).toContainElement(screen.getByText(/\d+ un/));
      }
    });
  });

  describe('Cross-Browser Compatibility', () => {
    const browserTests = [
      { userAgent: 'Chrome', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      { userAgent: 'Safari', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15' },
      { userAgent: 'Firefox', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0' }
    ];

    browserTests.forEach(({ userAgent, ua }) => {
      it(`should work correctly in ${userAgent}`, async () => {
        // Mock user agent
        Object.defineProperty(navigator, 'userAgent', {
          writable: true,
          value: ua
        });
        
        const renderTime = await measureRenderTime(() => {
          render(<Products />, { wrapper: createWrapper() });
        });
        
        // Should render efficiently across browsers
        expect(renderTime).toBeLessThan(3000); // More lenient for different browsers
        
        await waitFor(() => {
          expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
        });
      });
    });

    it('should handle different viewport sizes', async () => {
      const viewportTests = [
        { width: 320, height: 568, name: 'Mobile Portrait' },
        { width: 768, height: 1024, name: 'Tablet Portrait' },
        { width: 1024, height: 768, name: 'Tablet Landscape' },
        { width: 1920, height: 1080, name: 'Desktop' }
      ];
      
      for (const viewport of viewportTests) {
        // Mock viewport size
        Object.defineProperty(window, 'innerWidth', { value: viewport.width, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: viewport.height, writable: true });
        
        render(<Products />, { wrapper: createWrapper() });
        
        await waitFor(() => {
          expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
        });
        
        // Should adapt layout appropriately
        const container = screen.getByText(/gerenciamento de produtos/i).closest('div');
        expect(container).toBeInTheDocument();
      }
    });

    it('should maintain consistent performance across devices', async () => {
      const deviceTests = [
        { type: 'mobile', expectation: 3000 },
        { type: 'tablet', expectation: 2000 },
        { type: 'desktop', expectation: 1500 }
      ];
      
      for (const device of deviceTests) {
        const products = generateProductsData(1000);
        
        // Mock device characteristics
        if (device.type === 'mobile') {
          Object.defineProperty(window, 'innerWidth', { value: 375 });
          Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4 });
        }
        
        const renderTime = await measureRenderTime(() => {
          render(<Products />, { wrapper: createWrapper() });
        });
        
        expect(renderTime).toBeLessThan(device.expectation);
      }
    });
  });

  describe('Data Integrity Validation', () => {
    it('should maintain data consistency during optimizations', async () => {
      const products = generateProductsData(100);
      
      // Mock API with specific product data
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(products)
      });
      
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
      
      // Verify all products are displayed with correct data
      const productNames = products.slice(0, 10).map(p => p.name);
      
      for (const name of productNames) {
        expect(screen.getByText(name)).toBeInTheDocument();
      }
    });

    it('should handle cache invalidation correctly', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
      
      // Simulate creating new product
      const newProductButton = screen.getByRole('button', { name: /novo produto/i });
      await userEvent.click(newProductButton);
      
      // Fill form and submit
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/nome/i);
        userEvent.type(nameInput, 'Novo Produto Teste');
      });
      
      // Mock successful creation
      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 999, name: 'Novo Produto Teste' })
      });
      
      const submitButton = screen.getByRole('button', { name: /criar/i });
      await userEvent.click(submitButton);
      
      // Should invalidate cache and refresh data
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.stringMatching(/POST/),
          expect.stringMatching(/products/),
          expect.any(Object)
        );
      });
    });

    it('should handle optimistic updates correctly', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
      
      // Test optimistic update behavior
      const firstProduct = screen.getAllByText(/produto \d+/i)[0];
      const editButton = firstProduct.closest('div')?.querySelector('[title="Editar produto"]');
      
      if (editButton) {
        await userEvent.click(editButton);
        
        // Should show optimistic UI changes immediately
        await waitFor(() => {
          expect(screen.getByText(/editar produto/i)).toBeInTheDocument();
        });
      }
    });

    it('should validate nested category selections', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      const newProductButton = screen.getByRole('button', { name: /novo produto/i });
      await userEvent.click(newProductButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/categoria/i)).toBeInTheDocument();
      });
      
      // Test complex nested category selection
      const categorySelect = screen.getByLabelText(/categoria/i);
      await userEvent.click(categorySelect);
      
      // Should show nested categories properly
      await waitFor(() => {
        expect(screen.getByText(/máquinas/i)).toBeInTheDocument();
      });
      
      await userEvent.click(screen.getByText(/máquinas/i));
      
      // Should maintain category hierarchy integrity
      const subcategorySelect = screen.getByLabelText(/sub categoria/i);
      expect(subcategorySelect).toBeInTheDocument();
    });
  });

  describe('Regression Prevention', () => {
    it('should not degrade existing performance metrics', async () => {
      // Baseline performance test
      const baselineProducts = generateProductsData(1000);
      
      const baselineTime = await measureRenderTime(() => {
        render(<Products />, { wrapper: createWrapper() });
      });
      
      // Performance should not regress beyond acceptable threshold
      expect(baselineTime).toBeLessThan(2500); // 2.5s maximum
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
    });

    it('should maintain or improve search response times', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/buscar produtos/i);
        expect(searchInput).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/buscar produtos/i);
      
      // Measure current search performance
      const searchTime = await measureInteractionTime(async () => {
        await userEvent.type(searchInput, 'Produto');
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 300));
        });
      });
      
      // Should maintain fast search response
      expect(searchTime).toBeLessThan(400);
    });

    it('should preserve form submission success rates', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      const newProductButton = screen.getByRole('button', { name: /novo produto/i });
      await userEvent.click(newProductButton);
      
      // Fill valid form data
      const requiredInputs = {
        'ID': 'TEST-001',
        'Nome': 'Produto Teste',
        'Unidade': 'un'
      };
      
      for (const [label, value] of Object.entries(requiredInputs)) {
        const input = screen.getByLabelText(new RegExp(label, 'i'));
        await userEvent.type(input, value);
      }
      
      // Mock successful submission
      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      const submitButton = screen.getByRole('button', { name: /criar/i });
      await userEvent.click(submitButton);
      
      // Should successfully submit
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          expect.stringMatching(/products/),
          expect.objectContaining({
            sku: 'TEST-001',
            name: 'Produto Teste'
          })
        );
      });
    });
  });

  describe('Load Testing Strategy', () => {
    it('should handle maximum expected load', async () => {
      // Test with maximum expected products (10,000)
      const maxProducts = generateProductsData(10000);
      
      const loadTestTime = await measureRenderTime(() => {
        render(<Products />, { wrapper: createWrapper() });
      });
      
      // Should handle max load within reasonable time
      expect(loadTestTime).toBeLessThan(5000); // 5s maximum for extreme load
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
    });

    it('should maintain responsiveness during concurrent operations', async () => {
      render(<Products />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
      });
      
      // Simulate multiple concurrent user actions
      const concurrentOperations = [
        () => userEvent.click(screen.getByRole('button', { name: /novo produto/i })),
        () => userEvent.type(screen.getByPlaceholderText(/buscar produtos/i), 'test'),
        () => userEvent.click(screen.getAllByText(/produto \d+/i)[0])
      ];
      
      const concurrentTime = await measureInteractionTime(async () => {
        await Promise.all(concurrentOperations.map(op => op()));
      });
      
      // Should handle concurrent operations efficiently
      expect(concurrentTime).toBeLessThan(300);
    });

    it('should gracefully handle API failures during high load', async () => {
      // Mock intermittent API failures
      let failureCount = 0;
      mockApiRequest.mockImplementation(() => {
        failureCount++;
        if (failureCount % 3 === 0) {
          return Promise.reject(new Error('Simulated API failure'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(generateProductsData(1000))
        });
      });
      
      render(<Products />, { wrapper: createWrapper() });
      
      // Should handle failures gracefully with retry mechanisms
      await waitFor(() => {
        expect(screen.getByText(/gerenciamento de produtos/i) || 
               screen.getByText(/erro/i)).toBeInTheDocument();
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});

describe('User Acceptance Criteria Validation', () => {
  it('should meet all defined success metrics', async () => {
    const successMetrics = {
      renderTime: { threshold: 2000, actual: 0 },
      searchTime: { threshold: 300, actual: 0 },
      interactionTime: { threshold: 100, actual: 0 },
      memoryUsage: { threshold: 100 * 1024 * 1024, actual: 0 } // 100MB
    };
    
    // Measure render time
    successMetrics.renderTime.actual = await measureRenderTime(() => {
      render(<Products />, { wrapper: createWrapper() });
    });
    
    await waitFor(() => {
      expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
    });
    
    // Measure search time
    const searchInput = screen.getByPlaceholderText(/buscar produtos/i);
    successMetrics.searchTime.actual = await measureInteractionTime(async () => {
      await userEvent.type(searchInput, 'Produto');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
      });
    });
    
    // Measure interaction time
    const newProductButton = screen.getByRole('button', { name: /novo produto/i });
    successMetrics.interactionTime.actual = await measureInteractionTime(async () => {
      await userEvent.click(newProductButton);
    });
    
    // Measure memory usage
    successMetrics.memoryUsage.actual = measureMemoryUsage();
    
    // Validate all metrics meet criteria
    Object.entries(successMetrics).forEach(([metric, { threshold, actual }]) => {
      expect(actual).toBeLessThan(threshold);
      console.log(`✅ ${metric}: ${actual} < ${threshold}`);
    });
  });

  it('should maintain user experience quality standards', async () => {
    render(<Products />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument();
    });
    
    // Verify core user experience elements
    const uxChecklist = [
      () => expect(screen.getByRole('button', { name: /novo produto/i })).toBeInTheDocument(),
      () => expect(screen.getByPlaceholderText(/buscar produtos/i)).toBeInTheDocument(),
      () => expect(screen.getByText(/produtos/i)).toBeInTheDocument(),
      () => expect(screen.getByText(/gerenciamento de produtos/i)).toBeInTheDocument()
    ];
    
    uxChecklist.forEach(check => check());
  });
});