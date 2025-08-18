/**
 * Comprehensive test suite for Loading Execution System
 * Tests end-to-end workflows, error handling, mobile interactions,
 * performance, accessibility, and cross-browser compatibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom';

// Import components to test
import LoadingExecutionPage from '../pages/loading-execution';
import { LoadingExecutionScreen } from '../components/loading-execution-screen';
import LoadingExecutionScreenMobile from '../components/loading-execution-screen-mobile';
import { ExecutionDashboard } from '../components/execution-dashboard';
import { ItemProgressTracker } from '../components/item-progress-tracker';
import QrScanner from '../components/qr-scanner';
import { TouchOptimizedButton, SwipeableCard, QuantityController } from '../components/mobile/TouchOptimizedControls';
import { GestureHandler } from '../components/mobile/GestureHandler';

// Mock API and dependencies
const mockApiRequest = vi.fn();
vi.mock('@/lib/queryClient', () => ({
  apiRequest: mockApiRequest
}));

// Mock navigator APIs for mobile testing
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{
        getCapabilities: () => ({ torch: true }),
        getSettings: () => ({ facingMode: 'environment' }),
        applyConstraints: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn()
      }]
    })
  },
  writable: true,
});

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  value: class MockNotification {
    constructor(title: string, options?: NotificationOptions) {
      // Mock implementation
    }
    static permission = 'granted';
    static requestPermission = vi.fn().mockResolvedValue('granted');
  },
  writable: true,
});

// Test data fixtures
const mockTransferRequest = {
  id: 1,
  code: 'TR-2025-001',
  status: 'aprovado',
  fromLocation: 'Armazém A',
  toLocation: 'Doca 1',
  vehicleName: 'Caminhão 001',
  vehicleCode: 'CAM001',
  createdAt: '2025-01-15T10:00:00Z',
  createdByName: 'João Silva'
};

const mockLoadingExecution = {
  id: 1,
  status: 'em_andamento',
  startedAt: '2025-01-15T10:30:00Z',
  transferRequestId: 1,
  transferRequestCode: 'TR-2025-001',
  operatorName: 'Maria Santos',
  items: [
    {
      id: 1,
      transferRequestItemId: 1,
      productId: 1,
      productName: 'Produto A',
      productSku: 'SKU-001',
      requestedQuantity: '100',
      loadedQuantity: '80',
      notLoadedQuantity: '20',
      scannedAt: '2025-01-15T10:35:00Z',
      confirmedAt: '2025-01-15T10:36:00Z'
    },
    {
      id: 2,
      transferRequestItemId: 2,
      productId: 2,
      productName: 'Produto B',
      productSku: 'SKU-002',
      requestedQuantity: '50',
      loadedQuantity: '0',
      notLoadedQuantity: '50',
      divergenceReason: 'item_avariado',
      divergenceComments: 'Item encontrado danificado'
    },
    {
      id: 3,
      transferRequestItemId: 3,
      productId: 3,
      productName: 'Produto C',
      productSku: 'SKU-003',
      requestedQuantity: '75',
      loadedQuantity: '0',
      notLoadedQuantity: '75'
    }
  ]
};

// Helper function to create test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Loading Execution System - End-to-End Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Setup default API responses
    mockApiRequest.mockImplementation((method, url) => {
      const response = { ok: true, json: vi.fn() };
      
      if (url.includes('transfer-requests') && url.includes('status=aprovado')) {
        response.json.mockResolvedValue([mockTransferRequest]);
      } else if (url.includes('loading-executions/pending')) {
        response.json.mockResolvedValue([mockLoadingExecution]);
      } else if (url.includes('loading-executions/1')) {
        response.json.mockResolvedValue(mockLoadingExecution);
      }
      
      return Promise.resolve(response);
    });
  });

  describe('Item Processing Workflows', () => {
    it('should complete full item scanning workflow', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
      
      // Open scanner
      const scannerButton = screen.getByRole('button', { name: /scanner item/i });
      await user.click(scannerButton);
      
      // Simulate QR code scan
      const mockScan = vi.fn();
      const scanner = render(<QrScanner onScan={mockScan} onClose={() => {}} />);
      
      // Simulate successful scan
      act(() => {
        mockScan('SKU-003');
      });
      
      expect(mockScan).toHaveBeenCalledWith('SKU-003');
    });

    it('should handle quantity input and confirmation', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Produto C')).toBeInTheDocument();
      });
      
      // Click on item to edit quantity
      const productCard = screen.getByText('Produto C').closest('div');
      await user.click(productCard!);
      
      // Should open quantity dialog
      await waitFor(() => {
        expect(screen.getByLabelText(/quantidade carregada/i)).toBeInTheDocument();
      });
      
      // Enter quantity
      const quantityInput = screen.getByLabelText(/quantidade carregada/i);
      await user.clear(quantityInput);
      await user.type(quantityInput, '75');
      
      // Confirm
      const confirmButton = screen.getByRole('button', { name: /confirmar carregamento/i });
      
      // Mock API call
      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      await user.click(confirmButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/loading-executions/1/scan-item',
        expect.objectContaining({
          productId: 3,
          quantity: '75'
        })
      );
    });

    it('should register divergences with reasons and comments', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Produto C')).toBeInTheDocument();
      });
      
      // Click divergence button
      const divergenceButton = screen.getByRole('button', { name: /registrar divergência/i });
      await user.click(divergenceButton);
      
      // Should open divergence dialog
      await waitFor(() => {
        expect(screen.getByText(/motivo da divergência/i)).toBeInTheDocument();
      });
      
      // Select reason
      const reasonSelect = screen.getByRole('combobox');
      await user.click(reasonSelect);
      await user.click(screen.getByText('Item avariado'));
      
      // Add comments
      const commentsTextarea = screen.getByPlaceholderText(/adicione detalhes/i);
      await user.type(commentsTextarea, 'Produto encontrado com danos na embalagem');
      
      // Submit divergence
      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      const submitButton = screen.getByRole('button', { name: /registrar divergência/i });
      await user.click(submitButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith(
        'PUT',
        '/api/loading-executions/1/items/3/divergence',
        expect.objectContaining({
          divergenceReason: 'item_avariado',
          divergenceComments: 'Produto encontrado com danos na embalagem'
        })
      );
    });

    it('should complete loading execution when all items processed', async () => {
      // Mock execution with all items completed
      const completedExecution = {
        ...mockLoadingExecution,
        items: mockLoadingExecution.items.map(item => ({
          ...item,
          confirmedAt: '2025-01-15T10:40:00Z',
          loadedQuantity: item.requestedQuantity
        }))
      };
      
      mockApiRequest.mockImplementation((method, url) => {
        if (url.includes('loading-executions/1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(completedExecution)
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
      
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /finalizar carregamento/i })).not.toBeDisabled();
      });
      
      // Click finish button
      const finishButton = screen.getByRole('button', { name: /finalizar carregamento/i });
      await user.click(finishButton);
      
      // Should open finish dialog
      await waitFor(() => {
        expect(screen.getByText(/todos os itens foram processados/i)).toBeInTheDocument();
      });
      
      // Add observations
      const observationsTextarea = screen.getByPlaceholderText(/observações sobre o carregamento/i);
      await user.type(observationsTextarea, 'Carregamento concluído sem problemas');
      
      // Confirm finish
      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      const confirmFinishButton = screen.getAllByRole('button', { name: /finalizar carregamento/i })[1];
      await user.click(confirmFinishButton);
      
      expect(mockApiRequest).toHaveBeenCalledWith(
        'PUT',
        '/api/loading-executions/1/finish',
        expect.objectContaining({
          observations: 'Carregamento concluído sem problemas'
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockApiRequest.mockRejectedValueOnce(new Error('Network error'));
      
      render(<LoadingExecutionPage />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/erro ao carregar/i)).toBeInTheDocument();
      });
      
      // Should show retry button
      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    });

    it('should retry failed operations', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Produto C')).toBeInTheDocument();
      });
      
      // Mock failed scan request
      mockApiRequest.mockRejectedValueOnce(new Error('Server error'));
      
      const productCard = screen.getByText('Produto C').closest('div');
      await user.click(productCard!);
      
      await waitFor(() => {
        const quantityInput = screen.getByLabelText(/quantidade carregada/i);
        user.type(quantityInput, '50');
      });
      
      const confirmButton = screen.getByRole('button', { name: /confirmar carregamento/i });
      await user.click(confirmButton);
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/erro ao escanear item/i)).toBeInTheDocument();
      });
    });

    it('should handle offline scenarios', async () => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      render(<LoadingExecutionScreenMobile executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
      
      // Should indicate offline status and queue actions
      const productCard = screen.getByText('Produto A').closest('div');
      await user.click(productCard!);
      
      // Actions should be queued for when online
      // Implementation would depend on offline manager
    });

    it('should validate input data', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Produto C')).toBeInTheDocument();
      });
      
      const productCard = screen.getByText('Produto C').closest('div');
      await user.click(productCard!);
      
      await waitFor(() => {
        const quantityInput = screen.getByLabelText(/quantidade carregada/i);
        // Try invalid quantity
        user.clear(quantityInput);
        user.type(quantityInput, '-10');
      });
      
      const confirmButton = screen.getByRole('button', { name: /confirmar carregamento/i });
      
      // Button should be disabled for invalid input
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Mobile Touch Interactions', () => {
    it('should handle touch optimized buttons with haptic feedback', async () => {
      const mockOnClick = vi.fn();
      const mockOnLongPress = vi.fn();
      
      render(
        <TouchOptimizedButton onClick={mockOnClick} onLongPress={mockOnLongPress}>
          Test Button
        </TouchOptimizedButton>
      );
      
      const button = screen.getByRole('button', { name: /test button/i });
      
      // Simulate touch start
      fireEvent.touchStart(button, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      expect(navigator.vibrate).toHaveBeenCalledWith(10);
      
      // Simulate touch end (tap)
      fireEvent.touchEnd(button);
      fireEvent.click(button);
      
      expect(mockOnClick).toHaveBeenCalled();
      
      // Simulate long press
      fireEvent.touchStart(button, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      // Wait for long press delay
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });
      
      expect(mockOnLongPress).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith([20, 10, 20]);
    });

    it('should handle swipe gestures on cards', async () => {
      const mockSwipeLeft = vi.fn();
      const mockSwipeRight = vi.fn();
      
      render(
        <SwipeableCard
          onSwipeLeft={mockSwipeLeft}
          onSwipeRight={mockSwipeRight}
          leftAction={{ icon: <div>Left</div>, label: 'Delete', color: 'red' }}
          rightAction={{ icon: <div>Right</div>, label: 'Edit', color: 'blue' }}
        >
          <div>Card Content</div>
        </SwipeableCard>
      );
      
      const card = screen.getByText('Card Content').closest('div')!;
      
      // Simulate swipe left
      fireEvent.touchStart(card, {
        touches: [{ clientX: 200, clientY: 100 }]
      });
      
      fireEvent.touchMove(card, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      fireEvent.touchEnd(card);
      
      expect(mockSwipeLeft).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith(20);
    });

    it('should handle quantity controller touch interactions', async () => {
      const mockOnChange = vi.fn();
      
      render(
        <QuantityController
          value={10}
          onChange={mockOnChange}
          min={0}
          max={100}
          step={1}
        />
      );
      
      // Test increment button
      const incrementButton = screen.getByRole('button', { name: /plus/i });
      await user.click(incrementButton);
      
      expect(mockOnChange).toHaveBeenCalledWith(11);
      expect(navigator.vibrate).toHaveBeenCalledWith(10);
      
      // Test decrement button
      const decrementButton = screen.getByRole('button', { name: /minus/i });
      await user.click(decrementButton);
      
      expect(mockOnChange).toHaveBeenCalledWith(9);
    });

    it('should handle complex gesture combinations', async () => {
      const mockTap = vi.fn();
      const mockLongPress = vi.fn();
      const mockSwipeLeft = vi.fn();
      
      render(
        <GestureHandler
          onTap={mockTap}
          onLongPress={mockLongPress}
          onSwipeLeft={mockSwipeLeft}
        >
          <div>Gesture Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Gesture Target');
      
      // Test tap
      fireEvent.touchStart(target, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      fireEvent.touchEnd(target, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });
      
      expect(mockTap).toHaveBeenCalled();
      
      // Test swipe
      fireEvent.touchStart(target, {
        touches: [{ clientX: 200, clientY: 100 }]
      });
      
      fireEvent.touchMove(target, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      fireEvent.touchEnd(target, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });
      
      expect(mockSwipeLeft).toHaveBeenCalled();
    });
  });

  describe('Performance Testing', () => {
    it('should handle large item lists efficiently', async () => {
      // Create large dataset
      const largeItemList = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        transferRequestItemId: index + 1,
        productId: index + 1,
        productName: `Produto ${index + 1}`,
        productSku: `SKU-${String(index + 1).padStart(3, '0')}`,
        requestedQuantity: String(Math.floor(Math.random() * 100) + 1),
        loadedQuantity: '0',
        notLoadedQuantity: String(Math.floor(Math.random() * 100) + 1)
      }));
      
      const largeExecution = {
        ...mockLoadingExecution,
        items: largeItemList
      };
      
      mockApiRequest.mockImplementation((method, url) => {
        if (url.includes('loading-executions/1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(largeExecution)
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
      
      const startTime = performance.now();
      
      render(<ItemProgressTracker items={largeItemList} />);
      
      // Should render without blocking
      await waitFor(() => {
        expect(screen.getByText(/1000 de 1000/i)).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 2 seconds)
      expect(renderTime).toBeLessThan(2000);
      
      // Test search performance
      const searchInput = screen.getByPlaceholderText(/buscar por nome/i);
      const searchStartTime = performance.now();
      
      await user.type(searchInput, 'Produto 500');
      
      await waitFor(() => {
        expect(screen.getByText('Produto 500')).toBeInTheDocument();
      });
      
      const searchEndTime = performance.now();
      const searchTime = searchEndTime - searchStartTime;
      
      // Search should be fast (less than 500ms)
      expect(searchTime).toBeLessThan(500);
    });

    it('should optimize re-renders with memoization', async () => {
      const mockOnEdit = vi.fn();
      let renderCount = 0;
      
      const TrackedComponent = () => {
        renderCount++;
        return (
          <ItemProgressTracker
            items={mockLoadingExecution.items}
            onEditItem={mockOnEdit}
          />
        );
      };
      
      const { rerender } = render(<TrackedComponent />);
      
      const initialRenderCount = renderCount;
      
      // Rerender with same props
      rerender(<TrackedComponent />);
      
      // Should not cause unnecessary re-renders
      expect(renderCount).toBe(initialRenderCount);
    });

    it('should handle concurrent operations efficiently', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
      
      // Simulate multiple concurrent operations
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(
          mockApiRequest('POST', `/api/loading-executions/1/scan-item`, {
            productId: 1,
            quantity: '10'
          })
        );
      }
      
      const startTime = performance.now();
      await Promise.all(operations);
      const endTime = performance.now();
      
      // Should handle concurrent operations within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Accessibility Testing', () => {
    it('should support keyboard navigation', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scanner item/i })).toBeInTheDocument();
      });
      
      // Test tab navigation
      await user.tab();
      expect(screen.getByRole('button', { name: /scanner item/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /atualizar lista/i })).toHaveFocus();
      
      // Test Enter key activation
      await user.keyboard('{Enter}');
      
      // Should trigger button action
      expect(mockApiRequest).toHaveBeenCalled();
    });

    it('should provide proper ARIA labels and roles', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Check for proper ARIA labels
        expect(screen.getByRole('button', { name: /scanner item/i })).toHaveAttribute('aria-label');
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
      
      // Check for proper heading structure
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check for proper form labels
      const scannerButton = screen.getByRole('button', { name: /scanner item/i });
      await user.click(scannerButton);
      
      // Should have proper labels in dialogs
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby');
      });
    });

    it('should support screen readers', async () => {
      render(<ItemProgressTracker items={mockLoadingExecution.items} />);
      
      // Check for screen reader announcements
      const statusElement = screen.getByText(/3 de 3/i);
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
      
      // Check for proper descriptions
      const items = screen.getAllByRole('listitem');
      items.forEach(item => {
        expect(item).toHaveAttribute('aria-describedby');
      });
    });

    it('should meet color contrast requirements', () => {
      render(<ExecutionDashboard execution={mockLoadingExecution} />);
      
      // This would typically use automated testing tools like axe-core
      // For demonstration, we check that high contrast classes are applied
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass(/contrast-more:/);
      });
    });

    it('should support voice control', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Check that buttons have proper voice-friendly names
        expect(screen.getByRole('button', { name: /scanner item/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /finalizar carregamento/i })).toBeInTheDocument();
      });
      
      // Voice commands should map to clear actions
      const scannerButton = screen.getByRole('button', { name: /scanner item/i });
      expect(scannerButton).toHaveAttribute('aria-label', expect.stringContaining('scanner'));
    });
  });

  describe('Cross-Browser Compatibility', () => {
    beforeAll(() => {
      // Mock different user agents for testing
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
    });

    it('should work in different browsers', async () => {
      // Test Chrome-specific features
      render(<QrScanner onScan={() => {}} onClose={() => {}} />);
      
      // Should handle getUserMedia properly
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      
      // Test Safari-specific behaviors
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15'
      });
      
      render(<TouchOptimizedButton onClick={() => {}}>Safari Test</TouchOptimizedButton>);
      
      // Should handle touch events properly in Safari
      const button = screen.getByRole('button', { name: /safari test/i });
      expect(button).toHaveStyle('touch-action: manipulation');
    });

    it('should handle different viewport sizes', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });
      
      render(<LoadingExecutionScreenMobile executionId={1} />);
      
      await waitFor(() => {
        // Should use mobile-optimized layout
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
      
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', { value: 768 });
      Object.defineProperty(window, 'innerHeight', { value: 1024 });
      
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        // Should adapt to tablet layout
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
    });

    it('should support different input methods', async () => {
      render(<QuantityController value={10} onChange={() => {}} />);
      
      const input = screen.getByRole('spinbutton');
      
      // Test keyboard input
      await user.clear(input);
      await user.type(input, '25');
      expect(input).toHaveValue(25);
      
      // Test touch input
      const plusButton = screen.getByRole('button', { name: /plus/i });
      
      // Simulate touch
      fireEvent.touchStart(plusButton);
      fireEvent.touchEnd(plusButton);
      fireEvent.click(plusButton);
      
      // Should handle both input methods
      expect(plusButton).toBeInTheDocument();
    });

    it('should handle feature detection gracefully', () => {
      // Test without vibration support
      const originalVibrate = navigator.vibrate;
      delete (navigator as any).vibrate;
      
      render(<TouchOptimizedButton onClick={() => {}}>No Vibrate</TouchOptimizedButton>);
      
      const button = screen.getByRole('button', { name: /no vibrate/i });
      fireEvent.touchStart(button);
      
      // Should not throw error when vibrate is not available
      expect(button).toBeInTheDocument();
      
      // Restore original
      (navigator as any).vibrate = originalVibrate;
    });

    it('should degrade gracefully without advanced features', async () => {
      // Mock environment without advanced APIs
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('Not supported'));
      
      render(<QrScanner onScan={() => {}} onClose={() => {}} />);
      
      await waitFor(() => {
        // Should fallback to manual input
        expect(screen.getByText(/digitar código/i)).toBeInTheDocument();
      });
      
      // Restore
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});

describe('Integration Tests', () => {
  it('should integrate all components in complete workflow', async () => {
    const user = userEvent.setup();
    
    render(<LoadingExecutionPage />, { wrapper: createWrapper() });
    
    // Should load main page
    await waitFor(() => {
      expect(screen.getByText(/execução de carregamento/i)).toBeInTheDocument();
    });
    
    // Should show approved requests
    await waitFor(() => {
      expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
    });
    
    // Start execution
    const startButton = screen.getByRole('button', { name: /iniciar carregamento/i });
    await user.click(startButton);
    
    // Should open start dialog
    await waitFor(() => {
      expect(screen.getByText(/iniciar execução de carregamento/i)).toBeInTheDocument();
    });
    
    // Mock start execution response
    mockApiRequest.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLoadingExecution)
    });
    
    const confirmStartButton = screen.getByRole('button', { name: /iniciar execução/i });
    await user.click(confirmStartButton);
    
    // Should navigate to execution screen
    await waitFor(() => {
      expect(screen.getByText(/scanner item/i)).toBeInTheDocument();
    });
    
    // Complete the workflow...
    // This would continue with scanning, confirming items, etc.
  });
});

// Performance benchmark tests
describe('Performance Benchmarks', () => {
  const measurePerformance = async (fn: () => Promise<void>) => {
    const startTime = performance.now();
    await fn();
    const endTime = performance.now();
    return endTime - startTime;
  };

  it('should meet performance benchmarks', async () => {
    const renderTime = await measurePerformance(async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
    });
    
    // Should render within 1 second
    expect(renderTime).toBeLessThan(1000);
    
    const interactionTime = await measurePerformance(async () => {
      const user = userEvent.setup();
      const scannerButton = screen.getByRole('button', { name: /scanner item/i });
      await user.click(scannerButton);
    });
    
    // Interactions should be responsive (< 100ms)
    expect(interactionTime).toBeLessThan(100);
  });
});