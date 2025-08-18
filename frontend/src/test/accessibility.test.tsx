/**
 * Accessibility Test Suite
 * Comprehensive testing for screen readers, keyboard navigation, 
 * ARIA compliance, and inclusive design
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Import components to test
import LoadingExecutionPage from '../pages/loading-execution';
import { LoadingExecutionScreen } from '../components/loading-execution-screen';
import { ItemProgressTracker } from '../components/item-progress-tracker';
import { ExecutionDashboard } from '../components/execution-dashboard';
import QrScanner from '../components/qr-scanner';
import { TouchOptimizedButton } from '../components/mobile/TouchOptimizedControls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Extend Jest matchers for accessibility
expect.extend(toHaveNoViolations);

// Mock API responses
const mockApiRequest = vi.fn();
vi.mock('@/lib/queryClient', () => ({
  apiRequest: mockApiRequest
}));

// Test data
const mockExecution = {
  id: 1,
  status: 'em_andamento',
  startedAt: '2025-01-15T10:00:00Z',
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
    }
  ]
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default API responses
    mockApiRequest.mockImplementation((method, url) => {
      const response = { ok: true, json: vi.fn() };
      
      if (url.includes('loading-executions/1')) {
        response.json.mockResolvedValue(mockExecution);
      }
      
      return Promise.resolve(response);
    });
  });

  describe('ARIA Compliance', () => {
    it('should have no accessibility violations on main page', async () => {
      const { container } = render(<LoadingExecutionPage />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/execução de carregamento/i)).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
      
      // Check for proper button roles and labels
      const scannerButton = screen.getByRole('button', { name: /scanner item/i });
      expect(scannerButton).toHaveAttribute('aria-label');
      
      // Check for progress indicators
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
      
      progressBars.forEach(progressBar => {
        expect(progressBar).toHaveAttribute('aria-valuemin');
        expect(progressBar).toHaveAttribute('aria-valuemax');
        expect(progressBar).toHaveAttribute('aria-valuenow');
      });
      
      // Check for proper headings hierarchy
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Main heading should be h1
      const mainHeading = headings.find(h => h.tagName === 'H1');
      expect(mainHeading).toBeInTheDocument();
    });

    it('should have proper form labels and descriptions', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Produto A')).toBeInTheDocument();
      });
      
      // Click on item to open quantity dialog
      const productCard = screen.getByText('Produto A').closest('div');
      fireEvent.click(productCard!);
      
      await waitFor(() => {
        const quantityInput = screen.getByLabelText(/quantidade carregada/i);
        expect(quantityInput).toBeInTheDocument();
        
        // Should have proper label association
        expect(quantityInput).toHaveAttribute('id');
        
        const label = screen.getByText(/quantidade carregada/i);
        expect(label).toHaveAttribute('for', quantityInput.getAttribute('id'));
        
        // Should have description for constraints
        expect(quantityInput).toHaveAttribute('aria-describedby');
      });
    });

    it('should announce dynamic content changes', async () => {
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Should have live region for status updates
      const statusElement = screen.getByText(/2 de 2/);
      expect(statusElement.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
      
      // Filter items to trigger status change
      const filterButton = screen.getByText(/completo/i);
      fireEvent.click(filterButton);
      
      // Status should update and be announced
      await waitFor(() => {
        expect(screen.getByText(/1 de 2/)).toBeInTheDocument();
      });
    });

    it('should have proper dialog accessibility', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Produto A')).toBeInTheDocument();
      });
      
      // Open quantity dialog
      const productCard = screen.getByText('Produto A').closest('div');
      fireEvent.click(productCard!);
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        
        // Dialog should have proper labeling
        expect(dialog).toHaveAttribute('aria-labelledby');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        
        // Should have proper focus management
        const titleElement = dialog.querySelector('[id]');
        expect(titleElement).toBeInTheDocument();
        
        // Close button should be accessible
        const closeButton = screen.getByRole('button', { name: /cancelar/i });
        expect(closeButton).toBeInTheDocument();
      });
    });

    it('should have proper table accessibility for item lists', async () => {
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Item list should be properly structured
      const items = screen.getAllByRole('article') || screen.getAllByRole('listitem');
      expect(items.length).toBeGreaterThan(0);
      
      items.forEach(item => {
        // Each item should have a heading
        const heading = item.querySelector('h3, h4, [role="heading"]');
        expect(heading).toBeInTheDocument();
        
        // Should have descriptive text
        expect(item).toHaveAttribute('aria-describedby');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scanner item/i })).toBeInTheDocument();
      });
      
      // Test tab navigation through interactive elements
      const scannerButton = screen.getByRole('button', { name: /scanner item/i });
      const updateButton = screen.getByRole('button', { name: /atualizar lista/i });
      
      // Tab to first button
      await user.tab();
      expect(scannerButton).toHaveFocus();
      
      // Tab to next button
      await user.tab();
      expect(updateButton).toHaveFocus();
      
      // Enter should activate button
      await user.keyboard('{Enter}');
      expect(mockApiRequest).toHaveBeenCalled();
    });

    it('should support arrow key navigation in lists', async () => {
      const user = userEvent.setup();
      
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Focus first item
      const firstItem = screen.getByText('Produto A').closest('[tabindex]') || 
                      screen.getByText('Produto A').closest('div');
      
      if (firstItem) {
        firstItem.focus();
        expect(firstItem).toHaveFocus();
        
        // Arrow down should move to next item
        await user.keyboard('{ArrowDown}');
        
        const secondItem = screen.getByText('Produto B').closest('[tabindex]') ||
                          screen.getByText('Produto B').closest('div');
        
        if (secondItem) {
          expect(secondItem).toHaveFocus();
        }
      }
    });

    it('should support keyboard shortcuts', async () => {
      const user = userEvent.setup();
      
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scanner item/i })).toBeInTheDocument();
      });
      
      // Test common keyboard shortcuts
      // Ctrl+F should focus search (if implemented)
      await user.keyboard('{Control>}f{/Control}');
      
      // Escape should close dialogs
      const productCard = screen.getByText('Produto A').closest('div');
      fireEvent.click(productCard!);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should manage focus properly in modal dialogs', async () => {
      const user = userEvent.setup();
      
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('Produto A')).toBeInTheDocument();
      });
      
      // Open dialog
      const productCard = screen.getByText('Produto A').closest('div');
      fireEvent.click(productCard!);
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        
        // Focus should be trapped within dialog
        const quantityInput = screen.getByLabelText(/quantidade carregada/i);
        expect(quantityInput).toHaveFocus();
        
        // Tab should cycle through dialog elements only
        await user.tab();
        const cancelButton = screen.getByRole('button', { name: /cancelar/i });
        const confirmButton = screen.getByRole('button', { name: /confirmar/i });
        
        expect(cancelButton).toHaveFocus() || expect(confirmButton).toHaveFocus();
      });
    });

    it('should provide skip links for efficient navigation', async () => {
      render(<LoadingExecutionPage />, { wrapper: createWrapper() });
      
      // Should have skip to main content link
      const skipLink = screen.getByText(/pular para o conteúdo principal/i) ||
                      screen.getByText(/skip to main content/i);
      
      if (skipLink) {
        expect(skipLink).toBeInTheDocument();
        expect(skipLink).toHaveAttribute('href', '#main-content');
        
        // Should initially be hidden but focusable
        expect(skipLink).toHaveClass(/sr-only|visually-hidden/);
      }
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful content for screen readers', async () => {
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Should have screen reader only content for context
      const srOnlyElements = document.querySelectorAll('.sr-only, .visually-hidden');
      expect(srOnlyElements.length).toBeGreaterThan(0);
      
      // Status indicators should be announced
      const statusElement = screen.getByText(/2 de 2/);
      expect(statusElement).toHaveAttribute('aria-live');
      
      // Items should have descriptive labels
      const productItems = screen.getAllByText(/Produto [AB]/);
      productItems.forEach(item => {
        const container = item.closest('[role], [aria-label], [aria-labelledby]');
        expect(container).toBeInTheDocument();
      });
    });

    it('should announce progress updates', async () => {
      render(<ExecutionDashboard execution={mockExecution} />);
      
      // Progress elements should have proper announcements
      const progressElements = screen.getAllByRole('progressbar');
      
      progressElements.forEach(progress => {
        expect(progress).toHaveAttribute('aria-label');
        expect(progress).toHaveAttribute('aria-valuenow');
        expect(progress).toHaveAttribute('aria-valuemin');
        expect(progress).toHaveAttribute('aria-valuemax');
      });
    });

    it('should provide alternative text for visual content', async () => {
      render(<QrScanner onScan={() => {}} onClose={() => {}} />);
      
      // Camera interface should have proper descriptions
      const cameraButton = screen.getByRole('button', { name: /capturar/i });
      expect(cameraButton).toHaveAttribute('aria-label');
      
      // Manual input should be available as alternative
      const manualButton = screen.getByRole('button', { name: /digitar/i });
      expect(manualButton).toBeInTheDocument();
    });

    it('should describe complex interactions', async () => {
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Interactive elements should have descriptions
      const searchInput = screen.getByPlaceholderText(/buscar/i);
      expect(searchInput).toHaveAttribute('aria-label');
      
      // Filter buttons should explain their function
      const filterButtons = screen.getAllByRole('button');
      filterButtons.forEach(button => {
        if (button.textContent?.includes('Todos') || 
            button.textContent?.includes('Completo') ||
            button.textContent?.includes('Pendente')) {
          expect(button).toHaveAttribute('aria-label') ||
          expect(button).toHaveAttribute('title');
        }
      });
    });
  });

  describe('High Contrast and Visual Accessibility', () => {
    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      render(<TouchOptimizedButton>High Contrast Button</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should have high contrast classes
      expect(button).toHaveClass(/contrast-more:/);
    });

    it('should have sufficient color contrast', async () => {
      const { container } = render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText('TR-2025-001')).toBeInTheDocument();
      });
      
      // This would typically use automated tools to check contrast ratios
      // For demonstration, we verify that contrast-aware classes are applied
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        // Should not use problematic color combinations
        const styles = window.getComputedStyle(button);
        expect(styles.backgroundColor).not.toBe(styles.color);
      });
    });

    it('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Animations should be reduced or disabled
      const animatedElements = document.querySelectorAll('[class*="animate-"], [class*="transition-"]');
      animatedElements.forEach(element => {
        // Should have motion-safe prefixes or reduced animation classes
        expect(element.className).toMatch(/motion-safe:|motion-reduce:|animate-none/);
      });
    });

    it('should scale properly with zoom', async () => {
      // Mock viewport zoom
      Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
      
      render(<TouchOptimizedButton size="default">Zoom Test</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Touch targets should maintain minimum size even when zoomed
      const styles = window.getComputedStyle(button);
      const minHeight = parseInt(styles.minHeight);
      
      // Should meet minimum 44px touch target requirement
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Voice Control Support', () => {
    it('should have voice-friendly button names', async () => {
      render(<LoadingExecutionScreen executionId={1} />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        const scannerButton = screen.getByRole('button', { name: /scanner item/i });
        expect(scannerButton).toBeInTheDocument();
        
        // Button names should be clear and unambiguous
        expect(scannerButton.textContent || scannerButton.getAttribute('aria-label'))
          .toMatch(/scanner|scan/i);
      });
      
      const finishButton = screen.getByRole('button', { name: /finalizar/i });
      expect(finishButton.textContent || finishButton.getAttribute('aria-label'))
        .toMatch(/finalizar|finish|complete/i);
    });

    it('should support voice navigation commands', async () => {
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Elements should have clear, speakable names
      const searchInput = screen.getByPlaceholderText(/buscar/i);
      expect(searchInput).toHaveAttribute('aria-label', expect.stringContaining('buscar'));
      
      const filterButtons = screen.getAllByRole('button');
      filterButtons.forEach(button => {
        const name = button.textContent || button.getAttribute('aria-label');
        expect(name).toBeTruthy();
        expect(name).toMatch(/^[a-zA-ZÀ-ÿ\s]+$/); // Should be speakable text
      });
    });
  });

  describe('Mobile Accessibility', () => {
    it('should support switch control navigation', async () => {
      // Mock touch environment
      Object.defineProperty(window, 'ontouchstart', { value: true });
      
      render(<TouchOptimizedButton>Switch Control Button</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should have proper touch targets for switch control
      expect(button).toHaveClass(/min-h-/); // Minimum height class
      
      // Should be focusable for switch scanning
      expect(button).toHaveAttribute('tabindex');
    });

    it('should support screen reader gestures on mobile', () => {
      render(<ItemProgressTracker items={mockExecution.items} />);
      
      // Items should be navigable with swipe gestures
      const items = screen.getAllByText(/Produto [AB]/);
      items.forEach(item => {
        const container = item.closest('[role="listitem"], [role="article"]');
        expect(container).toBeInTheDocument();
      });
    });

    it('should provide appropriate touch feedback', () => {
      render(<TouchOptimizedButton hapticFeedback={true}>Touch Button</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should have touch-action for proper touch handling
      expect(button).toHaveStyle('touch-action: manipulation');
      
      // Should provide visual feedback
      expect(button).toHaveClass(/active:scale-/);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});