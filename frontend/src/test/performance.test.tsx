/**
 * Performance Test Suite
 * Tests for performance optimization, memory usage, and large dataset handling
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import { ItemProgressTracker } from '../components/item-progress-tracker';
import { ExecutionDashboard } from '../components/execution-dashboard';
import LoadingExecutionScreenMobile from '../components/loading-execution-screen-mobile';
import { VirtualScrollList } from '../components/VirtualScrollList';
import { MemoryOptimizedCamera } from '../components/MemoryOptimizedCamera';
import { PerformanceMonitor } from '../components/PerformanceMonitor';

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

// Generate large datasets for testing
const generateLargeItemList = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    transferRequestItemId: index + 1,
    productId: index + 1,
    productName: `Produto ${index + 1}`,
    productSku: `SKU-${String(index + 1).padStart(6, '0')}`,
    requestedQuantity: String(Math.floor(Math.random() * 1000) + 1),
    loadedQuantity: String(Math.floor(Math.random() * 500)),
    notLoadedQuantity: String(Math.floor(Math.random() * 500)),
    scannedAt: Math.random() > 0.5 ? new Date().toISOString() : undefined,
    confirmedAt: Math.random() > 0.7 ? new Date().toISOString() : undefined,
    divergenceReason: Math.random() > 0.9 ? 'item_avariado' : undefined,
    divergenceComments: Math.random() > 0.95 ? 'Comentário de teste' : undefined
  }));
};

const generateLargeExecution = (itemCount: number) => ({
  id: 1,
  status: 'em_andamento' as const,
  startedAt: '2025-01-15T10:00:00Z',
  transferRequestId: 1,
  transferRequestCode: 'TR-2025-001',
  operatorName: 'Operador Teste',
  items: generateLargeItemList(itemCount)
});

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

describe('Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any existing timers
    vi.clearAllTimers();
  });

  describe('Large Dataset Handling', () => {
    it('should handle 1000+ items efficiently', async () => {
      const largeItemList = generateLargeItemList(1000);
      
      const renderTime = await measureRenderTime(() => {
        render(<ItemProgressTracker items={largeItemList} />);
      });
      
      // Should render within 2 seconds even with 1000 items
      expect(renderTime).toBeLessThan(2000);
      
      // Should show correct item count
      await waitFor(() => {
        expect(screen.getByText(/1000 de 1000/)).toBeInTheDocument();
      });
    });

    it('should handle 10000+ items with virtual scrolling', async () => {
      const largeItemList = generateLargeItemList(10000);
      
      const renderTime = await measureRenderTime(() => {
        render(
          <VirtualScrollList
            items={largeItemList}
            itemHeight={120}
            renderItem={(item) => (
              <div key={item.id} style={{ height: 120 }}>
                {item.productName}
              </div>
            )}
          />
        );
      });
      
      // Virtual scrolling should handle 10k items quickly
      expect(renderTime).toBeLessThan(1000);
      
      // Should only render visible items initially
      const renderedItems = screen.getAllByText(/Produto \d+/);
      expect(renderedItems.length).toBeLessThan(50); // Only visible items
    });

    it('should maintain performance during search and filtering', async () => {
      const largeItemList = generateLargeItemList(5000);
      
      render(<ItemProgressTracker items={largeItemList} />);
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(/5000 de 5000/)).toBeInTheDocument();
      });
      
      // Measure search performance
      const searchInput = screen.getByPlaceholderText(/buscar por nome/);
      
      const searchStartTime = performance.now();
      
      await act(async () => {
        // Simulate typing in search
        searchInput.focus();
        searchInput.setAttribute('value', 'Produto 1000');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Produto 1000')).toBeInTheDocument();
      });
      
      const searchEndTime = performance.now();
      const searchTime = searchEndTime - searchStartTime;
      
      // Search should be fast even with large datasets
      expect(searchTime).toBeLessThan(500);
    });

    it('should handle concurrent data updates efficiently', async () => {
      const initialItems = generateLargeItemList(1000);
      
      const { rerender } = render(
        <ItemProgressTracker items={initialItems} />
      );
      
      // Simulate multiple concurrent updates
      const updatePromises = [];
      
      for (let i = 0; i < 10; i++) {
        const updatedItems = initialItems.map(item => ({
          ...item,
          loadedQuantity: String(parseInt(item.loadedQuantity) + i)
        }));
        
        updatePromises.push(
          act(async () => {
            rerender(<ItemProgressTracker items={updatedItems} />);
          })
        );
      }
      
      const startTime = performance.now();
      await Promise.all(updatePromises);
      const endTime = performance.now();
      
      // Should handle concurrent updates efficiently
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should not cause memory leaks with component mounting/unmounting', async () => {
      const initialMemory = measureMemoryUsage();
      
      const items = generateLargeItemList(500);
      
      // Mount and unmount components multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <ItemProgressTracker items={items} />
        );
        
        await waitFor(() => {
          expect(screen.getByText(`${items.length} de ${items.length}`)).toBeInTheDocument();
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

    it('should optimize camera memory usage', async () => {
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [{ stop: vi.fn() }]
      };
      
      // Mock getUserMedia
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream)
        }
      });
      
      const { unmount } = render(
        <MemoryOptimizedCamera
          onCapture={() => {}}
          onError={() => {}}
        />
      );
      
      // Should clean up resources on unmount
      unmount();
      
      // Verify stream was stopped
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    it('should handle large dashboard data efficiently', async () => {
      const largeExecution = generateLargeExecution(2000);
      
      const initialMemory = measureMemoryUsage();
      
      render(<ExecutionDashboard execution={largeExecution} />);
      
      await waitFor(() => {
        expect(screen.getByText(/progresso geral/i)).toBeInTheDocument();
      });
      
      const finalMemory = measureMemoryUsage();
      const memoryUsed = finalMemory - initialMemory;
      
      // Should not use excessive memory for dashboard calculations
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Render Performance', () => {
    it('should minimize re-renders with React.memo', async () => {
      let renderCount = 0;
      
      const TestComponent = React.memo(() => {
        renderCount++;
        return <ItemProgressTracker items={generateLargeItemList(100)} />;
      });
      
      const { rerender } = render(<TestComponent />);
      
      const initialRenderCount = renderCount;
      
      // Rerender with same props - should not cause re-render
      rerender(<TestComponent />);
      
      expect(renderCount).toBe(initialRenderCount);
    });

    it('should use efficient list virtualization', async () => {
      const items = generateLargeItemList(5000);
      
      render(
        <VirtualScrollList
          items={items}
          itemHeight={100}
          containerHeight={500}
          renderItem={(item) => <div key={item.id}>{item.productName}</div>}
        />
      );
      
      // Should only render visible items (approximately 5-6 items)
      const visibleItems = screen.getAllByText(/Produto \d+/);
      expect(visibleItems.length).toBeLessThan(10);
      expect(visibleItems.length).toBeGreaterThan(3);
    });

    it('should optimize dashboard calculations', async () => {
      const execution = generateLargeExecution(1000);
      
      const startTime = performance.now();
      
      render(<ExecutionDashboard execution={execution} />);
      
      await waitFor(() => {
        expect(screen.getByText(/progresso geral/i)).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;
      
      // Dashboard calculations should be fast
      expect(calculationTime).toBeLessThan(500);
    });

    it('should throttle expensive operations', async () => {
      const items = generateLargeItemList(1000);
      
      render(<ItemProgressTracker items={items} />);
      
      const searchInput = screen.getByPlaceholderText(/buscar por nome/);
      
      let updateCount = 0;
      const originalAddEventListener = searchInput.addEventListener;
      searchInput.addEventListener = vi.fn((event, handler) => {
        if (event === 'input') {
          const throttledHandler = (...args: any[]) => {
            updateCount++;
            return (handler as any)(...args);
          };
          return originalAddEventListener.call(searchInput, event, throttledHandler);
        }
        return originalAddEventListener.call(searchInput, event, handler);
      });
      
      // Rapid typing simulation
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }
      
      // Should throttle updates (less than total inputs)
      expect(updateCount).toBeLessThan(10);
    });
  });

  describe('Mobile Performance', () => {
    it('should optimize touch event handling', async () => {
      const execution = generateLargeExecution(100);
      
      // Mock mobile environment
      Object.defineProperty(window, 'ontouchstart', { value: true });
      
      render(<LoadingExecutionScreenMobile executionId={1} />);
      
      // Simulate rapid touch events
      const touchableElements = screen.getAllByText(/produto \d+/i);
      
      const startTime = performance.now();
      
      for (const element of touchableElements.slice(0, 10)) {
        const touchEvent = new TouchEvent('touchstart', {
          bubbles: true,
          touches: [{ clientX: 100, clientY: 100 } as any]
        });
        
        await act(async () => {
          element.dispatchEvent(touchEvent);
        });
      }
      
      const endTime = performance.now();
      const touchProcessingTime = endTime - startTime;
      
      // Touch events should be handled efficiently
      expect(touchProcessingTime).toBeLessThan(1000);
    });

    it('should maintain 60fps during animations', async () => {
      const items = generateLargeItemList(50);
      
      render(<ItemProgressTracker items={items} />);
      
      let frameCount = 0;
      const frameStart = performance.now();
      
      // Monitor frame rate during animated interactions
      const measureFrames = () => {
        frameCount++;
        if (performance.now() - frameStart < 1000) {
          requestAnimationFrame(measureFrames);
        }
      };
      
      requestAnimationFrame(measureFrames);
      
      // Simulate user interactions that trigger animations
      const filterButton = screen.getByText(/todos/i);
      await act(async () => {
        filterButton.click();
      });
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should maintain close to 60fps (allowing for some variance)
      expect(frameCount).toBeGreaterThan(45);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', async () => {
      const mockMetrics = {
        renderTime: 0,
        memoryUsage: 0,
        interactionTime: 0
      };
      
      const TestComponentWithMonitoring = () => {
        return (
          <>
            <PerformanceMonitor
              onMetrics={(metrics) => {
                mockMetrics.renderTime = metrics.renderTime;
                mockMetrics.memoryUsage = metrics.memoryUsage;
                mockMetrics.interactionTime = metrics.interactionTime;
              }}
            />
            <ItemProgressTracker items={generateLargeItemList(100)} />
          </>
        );
      };
      
      render(<TestComponentWithMonitoring />);
      
      await waitFor(() => {
        expect(mockMetrics.renderTime).toBeGreaterThan(0);
      });
      
      // Metrics should be tracked
      expect(mockMetrics.renderTime).toBeDefined();
      expect(mockMetrics.memoryUsage).toBeDefined();
    });

    it('should identify performance bottlenecks', async () => {
      // Create intentionally slow component
      const SlowComponent = () => {
        const items = generateLargeItemList(1000);
        
        // Simulate expensive calculation
        const expensiveCalculation = () => {
          let sum = 0;
          for (let i = 0; i < 1000000; i++) {
            sum += Math.random();
          }
          return sum;
        };
        
        const result = expensiveCalculation();
        
        return (
          <div>
            <div>Calculation result: {result}</div>
            <ItemProgressTracker items={items} />
          </div>
        );
      };
      
      const startTime = performance.now();
      
      render(<SlowComponent />);
      
      await waitFor(() => {
        expect(screen.getByText(/calculation result/i)).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should identify that this component is slow
      expect(totalTime).toBeGreaterThan(100); // Definitely slower than optimized components
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });
});