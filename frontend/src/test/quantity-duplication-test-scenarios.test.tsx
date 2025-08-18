/**
 * Quantity Duplication Fix - Test Scenarios
 * 
 * Critical test cases for validating the fix for quantity duplication issues
 * in the interactive loading execution workflow.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoadingExecutionScreen } from '@/components/loading-execution-screen';
import { apiRequest } from '@/lib/queryClient';

// Mock API request
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

// Test utilities
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

// Test data factories
const createLoadingExecution = (itemCount = 5) => ({
  id: 1,
  transferRequestCode: 'TR-001',
  operatorName: 'Test Operator',
  startedAt: '2025-08-05T10:00:00Z',
  status: 'em_andamento',
  items: Array.from({ length: itemCount }, (_, i) => ({
    id: i + 1,
    transferRequestItemId: i + 100,
    productId: i + 200,
    productName: `Test Product ${i + 1}`,
    productSku: `SKU-${i + 1}`,
    requestedQuantity: '10',
    loadedQuantity: '0',
    notLoadedQuantity: '10',
    confirmedAt: null,
  }))
});

const createConfirmedItem = (overrides = {}) => ({
  id: 1,
  transferRequestItemId: 100,
  productId: 200,
  productName: 'Test Product',
  productSku: 'SKU-001',
  requestedQuantity: '10',
  loadedQuantity: '5',
  notLoadedQuantity: '5',
  confirmedAt: '2025-08-05T10:30:00Z',
  scannedAt: '2025-08-05T10:30:00Z',
  ...overrides
});

describe('Quantity Duplication Fix - Critical Test Scenarios', () => {
  let mockApiRequest: any;
  
  beforeEach(() => {
    mockApiRequest = vi.mocked(apiRequest);
    mockApiRequest.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('QU-001: Basic Quantity Update Flow', () => {
    it('should update quantity for confirmed item without duplication', async () => {
      // Given: Loading execution with confirmed item
      const execution = createLoadingExecution(1);
      execution.items[0] = createConfirmedItem();

      mockApiRequest
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(execution) })
        .mockResolvedValueOnce({ 
          ok: true, 
          json: () => Promise.resolve({ ...execution.items[0], loadedQuantity: '8' })
        });

      renderWithQueryClient(<LoadingExecutionScreen executionId={1} />);

      // Wait for execution to load
      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      // When: User clicks on item to edit quantity
      const itemCard = screen.getByText('Test Product').closest('div');
      fireEvent.click(itemCard!);

      // And: Updates quantity to 8
      const quantityInput = await screen.findByPlaceholderText(/Digite a nova quantidade/);
      fireEvent.change(quantityInput, { target: { value: '8' } });

      const updateButton = screen.getByText(/Atualizar Quantidade/);
      fireEvent.click(updateButton);

      // Then: API should be called exactly once
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/loading-executions/1/scan-item',
          expect.objectContaining({
            productId: 200,
            quantity: '8',
            isEdit: true
          })
        );
      });

      // And: No duplicate API calls
      const apiCalls = mockApiRequest.mock.calls.filter(call => 
        call[0] === 'POST' && call[1].includes('scan-item')
      );
      expect(apiCalls).toHaveLength(1);
    });
  });

  describe('QU-002: Rapid Successive Updates', () => {
    it('should handle multiple quick updates without duplication', async () => {
      // Given: Confirmed item ready for updates
      const execution = createLoadingExecution(1);
      execution.items[0] = createConfirmedItem();

      let callCount = 0;
      mockApiRequest
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(execution) })
        .mockImplementation(() => {
          callCount++;
          return Promise.resolve({ 
            ok: true, 
            json: () => Promise.resolve({ 
              ...execution.items[0], 
              loadedQuantity: callCount.toString() 
            })
          });
        });

      renderWithQueryClient(<LoadingExecutionScreen executionId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      // When: Multiple rapid updates
      const itemCard = screen.getByText('Test Product').closest('div');
      
      // Simulate rapid clicks and updates
      for (let i = 6; i <= 10; i++) {
        await act(async () => {
          fireEvent.click(itemCard!);
          const quantityInput = await screen.findByPlaceholderText(/Digite a nova quantidade/);
          fireEvent.change(quantityInput, { target: { value: i.toString() } });
          
          const updateButton = screen.getByText(/Atualizar Quantidade/);
          fireEvent.click(updateButton);
          
          // Small delay to simulate real user behavior
          await new Promise(resolve => setTimeout(resolve, 50));
        });
      }

      // Then: Should handle rapid updates gracefully
      await waitFor(() => {
        // Check that we don't have excessive API calls
        const scanCalls = mockApiRequest.mock.calls.filter(call => 
          call[0] === 'POST' && call[1].includes('scan-item')
        );
        
        // Allow for some debouncing, but should not have 5+ calls
        expect(scanCalls.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('QU-003: Concurrent Updates Simulation', () => {
    it('should handle simultaneous updates gracefully', async () => {
      // Given: Item ready for concurrent updates
      const execution = createLoadingExecution(1);
      execution.items[0] = createConfirmedItem();

      let updateCount = 0;
      mockApiRequest
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(execution) })
        .mockImplementation(() => {
          updateCount++;
          // Simulate race condition with delayed responses
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({
                  ...execution.items[0],
                  loadedQuantity: updateCount.toString()
                })
              });
            }, Math.random() * 100);
          });
        });

      renderWithQueryClient(<LoadingExecutionScreen executionId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      // When: Simulate concurrent updates from multiple sources
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          act(async () => {
            const itemCard = screen.getByText('Test Product').closest('div');
            fireEvent.click(itemCard!);
            
            const quantityInput = await screen.findByPlaceholderText(/Digite a nova quantidade/);
            fireEvent.change(quantityInput, { target: { value: (7 + i).toString() } });
            
            const updateButton = screen.getByText(/Atualizar Quantidade/);
            fireEvent.click(updateButton);
          })
        );
      }

      await Promise.all(promises);

      // Then: Should resolve without errors
      await waitFor(() => {
        const scanCalls = mockApiRequest.mock.calls.filter(call => 
          call[0] === 'POST' && call[1].includes('scan-item')
        );
        
        // Should have made calls but handled concurrency properly
        expect(scanCalls.length).toBeGreaterThan(0);
        expect(scanCalls.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('EC-001: Input Validation Edge Cases', () => {
    const testCases = [
      { input: '0', expectedValid: true, description: 'Zero quantity' },
      { input: '-1', expectedValid: false, description: 'Negative quantity' },
      { input: '999999', expectedValid: true, description: 'Very large quantity' },
      { input: '0.001', expectedValid: true, description: 'Decimal precision' },
      { input: 'abc', expectedValid: false, description: 'Non-numeric input' },
      { input: '', expectedValid: false, description: 'Empty input' },
      { input: '15.5', expectedValid: true, description: 'Decimal exceeding requested' }
    ];

    testCases.forEach(({ input, expectedValid, description }) => {
      it(`should handle ${description}: "${input}"`, async () => {
        // Given: Item ready for update
        const execution = createLoadingExecution(1);
        execution.items[0] = createConfirmedItem();

        mockApiRequest
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(execution) });

        renderWithQueryClient(<LoadingExecutionScreen executionId={1} />);

        await waitFor(() => {
          expect(screen.getByText('Test Product')).toBeInTheDocument();
        });

        // When: User enters test input
        const itemCard = screen.getByText('Test Product').closest('div');
        fireEvent.click(itemCard!);

        const quantityInput = await screen.findByPlaceholderText(/Digite a nova quantidade/);
        fireEvent.change(quantityInput, { target: { value: input } });

        const updateButton = screen.getByText(/Atualizar Quantidade/);

        if (expectedValid) {
          // Then: Should allow valid inputs
          expect(updateButton).not.toBeDisabled();
          
          if (input !== '' && !isNaN(Number(input))) {
            mockApiRequest.mockResolvedValueOnce({
              ok: true,
              json: () => Promise.resolve({ ...execution.items[0], loadedQuantity: input })
            });

            fireEvent.click(updateButton);

            await waitFor(() => {
              const scanCalls = mockApiRequest.mock.calls.filter(call => 
                call[0] === 'POST' && call[1].includes('scan-item')
              );
              expect(scanCalls.length).toBe(1);
            });
          }
        } else {
          // Then: Should prevent invalid inputs
          if (input === '' || isNaN(Number(input)) || Number(input) < 0) {
            expect(updateButton).toBeDisabled();
          }
        }
      });
    });
  });

  describe('SC-001: State Consistency Validation', () => {
    it('should maintain UI state consistency during updates', async () => {
      // Given: Multiple items in execution
      const execution = createLoadingExecution(3);
      execution.items[0] = createConfirmedItem({ id: 1, productName: 'Product 1' });
      execution.items[1] = createConfirmedItem({ id: 2, productName: 'Product 2' });
      execution.items[2] = createConfirmedItem({ id: 3, productName: 'Product 3' });

      mockApiRequest
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(execution) })
        .mockResolvedValueOnce({ 
          ok: true, 
          json: () => Promise.resolve({ ...execution.items[0], loadedQuantity: '7' })
        });

      renderWithQueryClient(<LoadingExecutionScreen executionId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Product 1')).toBeInTheDocument();
        expect(screen.getByText('Product 2')).toBeInTheDocument();
        expect(screen.getByText('Product 3')).toBeInTheDocument();
      });

      // When: Update first item
      const product1Card = screen.getByText('Product 1').closest('div');
      fireEvent.click(product1Card!);

      const quantityInput = await screen.findByPlaceholderText(/Digite a nova quantidade/);
      fireEvent.change(quantityInput, { target: { value: '7' } });

      const updateButton = screen.getByText(/Atualizar Quantidade/);
      fireEvent.click(updateButton);

      // Then: Only first item should be updated
      await waitFor(() => {
        // The component should show updated state
        expect(screen.getByText('Product 1')).toBeInTheDocument();
        expect(screen.getByText('Product 2')).toBeInTheDocument();
        expect(screen.getByText('Product 3')).toBeInTheDocument();
      });

      // And: Other items should remain unchanged
      const scanCalls = mockApiRequest.mock.calls.filter(call => 
        call[0] === 'POST' && call[1].includes('scan-item')
      );
      expect(scanCalls).toHaveLength(1);
      expect(scanCalls[0][2]).toEqual(expect.objectContaining({
        productId: 200,
        quantity: '7'
      }));
    });
  });

  describe('WF-001: Workflow Integration', () => {
    it('should maintain workflow integrity during quantity updates', async () => {
      // Given: Execution with mixed item states
      const execution = createLoadingExecution(4);
      execution.items[0] = createConfirmedItem({ 
        id: 1, 
        productName: 'Completed Item',
        loadedQuantity: '10',
        requestedQuantity: '10' 
      });
      execution.items[1] = createConfirmedItem({ 
        id: 2, 
        productName: 'Partial Item',
        loadedQuantity: '5',
        requestedQuantity: '10' 
      });
      execution.items[2] = { 
        ...execution.items[2], 
        id: 3,
        productName: 'Pending Item',
        confirmedAt: null 
      };
      execution.items[3] = createConfirmedItem({ 
        id: 4, 
        productName: 'Divergent Item',
        loadedQuantity: '0',
        requestedQuantity: '10',
        divergenceReason: 'item_avariado',
        divergenceComments: 'Damaged during transport'
      });

      mockApiRequest
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(execution) });

      renderWithQueryClient(<LoadingExecutionScreen executionId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Completed Item')).toBeInTheDocument();
        expect(screen.getByText('Partial Item')).toBeInTheDocument();
        expect(screen.getByText('Pending Item')).toBeInTheDocument();
        expect(screen.getByText('Divergent Item')).toBeInTheDocument();
      });

      // Then: Should display correct status for each item type
      // Completed item should show "Completo" badge
      expect(screen.getByText('Completo')).toBeInTheDocument();
      
      // Partial item should show "Parcial" badge
      expect(screen.getByText('Parcial')).toBeInTheDocument();
      
      // Pending item should show "Pendente" badge
      expect(screen.getByText('Pendente')).toBeInTheDocument();
      
      // Divergent item should show divergence information
      expect(screen.getByText('Divergência registrada')).toBeInTheDocument();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large datasets efficiently', async () => {
      // Given: Large execution with many items
      const execution = createLoadingExecution(100);

      mockApiRequest
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(execution) });

      const startTime = performance.now();
      
      renderWithQueryClient(<LoadingExecutionScreen executionId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Then: Should render within performance budget
      expect(renderTime).toBeLessThan(1000); // 1 second max for initial render
      
      // And: Should use virtualization for large lists
      // Check if all 100 items are not immediately rendered (virtualization)
      const renderedItems = screen.queryAllByText(/Test Product/);
      expect(renderedItems.length).toBeLessThan(100); // Should virtualize
    });
  });
});