import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CompositionManager } from '../../../components/composition-manager';
import * as useCompositionHooks from '../../../hooks/useComposition';
import { PackagingComposition } from '../../../types/api';

// Mock the composition hooks
vi.mock('../../../hooks/useComposition', () => ({
  useCompositions: vi.fn(),
  useCreateComposition: vi.fn(),
  useValidateComposition: vi.fn(),
  useSaveComposition: vi.fn(),
  useDeleteComposition: vi.fn(),
  useUpdateCompositionStatus: vi.fn(),
  useGenerateCompositionReport: vi.fn(),
  useRealtimeCompositionValidation: vi.fn(),
}));

// Mock child components
vi.mock('../../../components/composition-assembly', () => ({
  CompositionAssembly: vi.fn(({ onCompositionCreate, onCompositionValidate, onCancel }) => (
    <div data-testid="composition-assembly">
      <button
        data-testid="create-composition"
        onClick={() => onCompositionCreate(
          {
            products: [{ productId: 1, quantity: 10 }],
            palletId: 1
          },
          { name: 'Test Composition', description: 'Test Description' }
        )}
      >
        Create Composition
      </button>
      <button
        data-testid="validate-composition"
        onClick={() => onCompositionValidate({
          products: [{ productId: 1, quantity: 10 }],
          palletId: 1
        })}
      >
        Validate Composition
      </button>
      <button data-testid="cancel-assembly" onClick={onCancel}>Cancel</button>
    </div>
  ))
}));

vi.mock('../../../components/composition-validator', () => ({
  CompositionValidator: vi.fn(({ validationResults, onDismiss }) => (
    <div data-testid="composition-validator">
      <div>Validation: {validationResults.isValid ? 'Valid' : 'Invalid'}</div>
      <button data-testid="dismiss-validation" onClick={onDismiss}>Dismiss</button>
    </div>
  ))
}));

vi.mock('../../../components/composition-visualization', () => ({
  CompositionVisualization: vi.fn(({ composition }) => (
    <div data-testid="composition-visualization">
      Viewing: {composition.name}
    </div>
  ))
}));

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock UI components
vi.mock('../../../components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {children}
      <button data-testid="close-dialog" onClick={() => onOpenChange(false)}>
        Close
      </button>
    </div>
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogTrigger: ({ children }: any) => children,
}));

vi.mock('../../../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  )
}));

vi.mock('../../../components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

vi.mock('../../../components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}));

vi.mock('../../../components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  )
}));

vi.mock('../../../components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

describe('CompositionManager', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  // Mock data
  const mockCompositions: PackagingComposition[] = [
    {
      id: 1,
      name: 'Test Composition 1',
      description: 'Test description 1',
      status: 'draft',
      palletId: 1,
      constraints: null,
      result: {
        isValid: true,
        efficiency: 0.85,
        layout: {
          layers: 2,
          itemsPerLayer: 10,
          totalItems: 20,
          arrangement: []
        },
        weight: { total: 100, limit: 1000, utilization: 0.1 },
        volume: { total: 0.5, limit: 2.4, utilization: 0.208 },
        height: { total: 50, limit: 200, utilization: 0.25 },
        recommendations: ['Consider optimizing layout'],
        warnings: [],
        products: []
      },
      efficiency: '0.85',
      totalWeight: '100',
      totalVolume: '0.5',
      totalHeight: '50',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 1,
      products: [
        { id: 1, productId: 1, quantity: 10, packagingTypeId: 1 }
      ],
      pallet: {
        id: 1,
        code: 'PAL001',
        type: 'standard',
        width: '120',
        length: '100',
        height: '15'
      }
    },
    {
      id: 2,
      name: 'Test Composition 2',
      description: 'Test description 2',
      status: 'validated',
      palletId: 2,
      constraints: null,
      result: {
        isValid: false,
        efficiency: 0.65,
        layout: {
          layers: 1,
          itemsPerLayer: 5,
          totalItems: 5,
          arrangement: []
        },
        weight: { total: 200, limit: 1000, utilization: 0.2 },
        volume: { total: 1.0, limit: 2.4, utilization: 0.417 },
        height: { total: 75, limit: 200, utilization: 0.375 },
        recommendations: [],
        warnings: ['Low efficiency detected'],
        products: []
      },
      efficiency: '0.65',
      totalWeight: '200',
      totalVolume: '1.0',
      totalHeight: '75',
      isActive: true,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      createdBy: 1,
      products: [
        { id: 2, productId: 2, quantity: 5, packagingTypeId: 2 }
      ],
      pallet: {
        id: 2,
        code: 'PAL002',
        type: 'heavy',
        width: '120',
        length: '100',
        height: '20'
      }
    }
  ];

  const mockHooks = {
    useCompositions: vi.fn(),
    useCreateComposition: vi.fn(),
    useValidateComposition: vi.fn(),
    useSaveComposition: vi.fn(),
    useDeleteComposition: vi.fn(),
    useUpdateCompositionStatus: vi.fn(),
    useGenerateCompositionReport: vi.fn(),
    useRealtimeCompositionValidation: vi.fn(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();

    // Setup default mock implementations
    mockHooks.useCompositions.mockReturnValue({
      data: mockCompositions,
      isLoading: false,
      error: null,
    });

    mockHooks.useCreateComposition.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockHooks.useValidateComposition.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockHooks.useSaveComposition.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockHooks.useDeleteComposition.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockHooks.useUpdateCompositionStatus.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockHooks.useGenerateCompositionReport.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    mockHooks.useRealtimeCompositionValidation.mockReturnValue({
      data: null,
    });

    // Apply mocks to the module
    Object.entries(mockHooks).forEach(([key, mock]) => {
      vi.mocked(useCompositionHooks[key as keyof typeof useCompositionHooks]).mockImplementation(mock);
    });

    vi.clearAllMocks();
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

  describe('Initial Rendering', () => {
    it('should render composition manager with compositions list', () => {
      renderWithProvider(<CompositionManager />);

      expect(screen.getByText('Gerenciador de Composições')).toBeInTheDocument();
      expect(screen.getByText('Test Composition 1')).toBeInTheDocument();
      expect(screen.getByText('Test Composition 2')).toBeInTheDocument();
    });

    it('should show loading state when compositions are loading', () => {
      mockHooks.useCompositions.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderWithProvider(<CompositionManager />);

      expect(screen.getByText('Carregando composições...')).toBeInTheDocument();
    });

    it('should show empty state when no compositions exist', () => {
      mockHooks.useCompositions.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      renderWithProvider(<CompositionManager />);

      expect(screen.getByText('Nenhuma composição encontrada')).toBeInTheDocument();
      expect(screen.getByText('Comece criando uma nova composição de produtos')).toBeInTheDocument();
    });
  });

  describe('Composition Creation', () => {
    it('should open create dialog when new composition button is clicked', async () => {
      renderWithProvider(<CompositionManager />);

      const newButton = screen.getByRole('button', { name: /nova composição/i });
      await user.click(newButton);

      expect(screen.getByTestId('composition-assembly')).toBeInTheDocument();
      expect(screen.getByText('Criar Nova Composição')).toBeInTheDocument();
    });

    it('should handle successful composition creation', async () => {
      const mockCreateComposition = vi.fn().mockResolvedValue({
        isValid: true,
        efficiency: 0.85,
        layout: { totalItems: 10 },
        weight: { total: 100 },
        volume: { total: 0.5 },
        height: { total: 50 },
        recommendations: [],
        warnings: [],
        products: []
      });

      const mockSaveComposition = vi.fn().mockResolvedValue({
        id: 3,
        name: 'New Composition',
        status: 'validated'
      });

      mockHooks.useCreateComposition.mockReturnValue({
        mutateAsync: mockCreateComposition,
        isPending: false,
      });

      mockHooks.useSaveComposition.mockReturnValue({
        mutateAsync: mockSaveComposition,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      // Open create dialog
      const newButton = screen.getByRole('button', { name: /nova composição/i });
      await user.click(newButton);

      // Click create composition in assembly component
      const createButton = screen.getByTestId('create-composition');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateComposition).toHaveBeenCalledWith({
          products: [{ productId: 1, quantity: 10 }],
          palletId: 1
        });
      });

      await waitFor(() => {
        expect(mockSaveComposition).toHaveBeenCalledWith({
          name: 'Test Composition',
          description: 'Test Description',
          compositionData: expect.any(Object),
          products: [{ productId: 1, quantity: 10 }],
          palletId: 1,
          status: 'validated',
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sucesso',
        description: 'Composição criada e validada com sucesso!',
      });
    });

    it('should handle invalid composition creation', async () => {
      const mockCreateComposition = vi.fn().mockResolvedValue({
        isValid: false,
        efficiency: 0.3,
        layout: { totalItems: 5 },
        recommendations: ['Optimize layout'],
        warnings: ['Low efficiency'],
        products: []
      });

      mockHooks.useCreateComposition.mockReturnValue({
        mutateAsync: mockCreateComposition,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      // Open create dialog and create composition
      const newButton = screen.getByRole('button', { name: /nova composição/i });
      await user.click(newButton);

      const createButton = screen.getByTestId('create-composition');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Composição inválida',
          description: 'A composição não atende aos requisitos. Verifique as recomendações.',
          variant: 'destructive',
        });
      });
    });

    it('should handle composition creation errors', async () => {
      const mockCreateComposition = vi.fn().mockRejectedValue(
        new Error('Failed to calculate composition')
      );

      mockHooks.useCreateComposition.mockReturnValue({
        mutateAsync: mockCreateComposition,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      // Open create dialog and create composition
      const newButton = screen.getByRole('button', { name: /nova composição/i });
      await user.click(newButton);

      const createButton = screen.getByTestId('create-composition');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Erro',
          description: 'Failed to calculate composition',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Composition Validation', () => {
    it('should handle composition validation', async () => {
      const mockValidateComposition = vi.fn().mockResolvedValue({
        isValid: true,
        violations: [],
        warnings: [],
        metrics: {
          efficiency: 0.85,
          totalWeight: 100,
          totalVolume: 0.5,
          totalHeight: 50
        }
      });

      mockHooks.useValidateComposition.mockReturnValue({
        mutateAsync: mockValidateComposition,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      // Open create dialog
      const newButton = screen.getByRole('button', { name: /nova composição/i });
      await user.click(newButton);

      // Click validate composition
      const validateButton = screen.getByTestId('validate-composition');
      await user.click(validateButton);

      await waitFor(() => {
        expect(mockValidateComposition).toHaveBeenCalledWith({
          products: [{ productId: 1, quantity: 10 }],
          palletId: 1
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validação bem-sucedida',
        description: 'Composição válida com eficiência de 85.0%',
      });
    });

    it('should handle validation failures', async () => {
      const mockValidateComposition = vi.fn().mockResolvedValue({
        isValid: false,
        violations: [
          { type: 'weight', severity: 'error', message: 'Weight exceeded' }
        ],
        warnings: ['Low efficiency'],
        metrics: {
          efficiency: 0.3,
          totalWeight: 1500,
          totalVolume: 3.0,
          totalHeight: 250
        }
      });

      mockHooks.useValidateComposition.mockReturnValue({
        mutateAsync: mockValidateComposition,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      // Open create dialog and validate
      const newButton = screen.getByRole('button', { name: /nova composição/i });
      await user.click(newButton);

      const validateButton = screen.getByTestId('validate-composition');
      await user.click(validateButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validação falhou',
          description: '1 violação(ões) encontrada(s)',
          variant: 'destructive',
        });
      });
    });

    it('should display real-time validation results', () => {
      const mockValidationResults = {
        isValid: true,
        violations: [],
        warnings: [],
        metrics: { efficiency: 0.85 }
      };

      mockHooks.useRealtimeCompositionValidation.mockReturnValue({
        data: mockValidationResults,
      });

      renderWithProvider(<CompositionManager />);

      expect(screen.getByTestId('composition-validator')).toBeInTheDocument();
      expect(screen.getByText('Validation: Valid')).toBeInTheDocument();
    });
  });

  describe('Status Management', () => {
    it('should update composition status', async () => {
      const mockUpdateStatus = vi.fn().mockResolvedValue({
        id: 1,
        status: 'validated',
        name: 'Test Composition 1'
      });

      mockHooks.useUpdateCompositionStatus.mockReturnValue({
        mutateAsync: mockUpdateStatus,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      // Find and click the validate button for draft composition
      const composition1Card = screen.getByText('Test Composition 1').closest('[data-testid="card"]');
      const validateButton = within(composition1Card!).getByText('Val');
      
      await user.click(validateButton);

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith({
          id: 1,
          status: 'validated',
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Status atualizado',
        description: 'Composição "Test Composition 1" marcada como Validado',
      });
    });

    it('should show appropriate action buttons based on status', () => {
      renderWithProvider(<CompositionManager />);

      // Draft composition should show validate button
      const composition1Card = screen.getByText('Test Composition 1').closest('[data-testid="card"]');
      expect(within(composition1Card!).queryByText('Val')).toBeInTheDocument();

      // Validated composition should show approve button
      const composition2Card = screen.getByText('Test Composition 2').closest('[data-testid="card"]');
      expect(within(composition2Card!).queryByText('Apr')).toBeInTheDocument();
    });
  });

  describe('Composition Management Actions', () => {
    it('should view composition details', async () => {
      renderWithProvider(<CompositionManager />);

      const composition1Card = screen.getByText('Test Composition 1').closest('[data-testid="card"]');
      const viewButton = within(composition1Card!).getByText('Ver');
      
      await user.click(viewButton);

      expect(screen.getByText('Visualizar Composição: Test Composition 1')).toBeInTheDocument();
      expect(screen.getByTestId('composition-visualization')).toBeInTheDocument();
    });

    it('should generate composition report', async () => {
      const mockGenerateReport = vi.fn().mockResolvedValue({
        id: 1,
        reportType: 'detailed',
        title: 'Composition Report'
      });

      mockHooks.useGenerateCompositionReport.mockReturnValue({
        mutateAsync: mockGenerateReport,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      const composition1Card = screen.getByText('Test Composition 1').closest('[data-testid="card"]');
      const reportButton = within(composition1Card!).getByText('Rel');
      
      await user.click(reportButton);

      await waitFor(() => {
        expect(mockGenerateReport).toHaveBeenCalledWith({
          compositionId: 1,
          includeMetrics: true,
          includeRecommendations: true,
          includeCostAnalysis: true,
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Relatório gerado',
        description: 'Relatório da composição "Test Composition 1" gerado com sucesso',
      });
    });

    it('should delete composition with confirmation', async () => {
      const mockDeleteComposition = vi.fn().mockResolvedValue(undefined);
      
      mockHooks.useDeleteComposition.mockReturnValue({
        mutateAsync: mockDeleteComposition,
        isPending: false,
      });

      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = vi.fn().mockReturnValue(true);

      renderWithProvider(<CompositionManager />);

      const composition1Card = screen.getByText('Test Composition 1').closest('[data-testid="card"]');
      const deleteButton = within(composition1Card!).getByText('Del');
      
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'Tem certeza que deseja excluir a composição "Test Composition 1"?'
      );

      await waitFor(() => {
        expect(mockDeleteComposition).toHaveBeenCalledWith(1);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sucesso',
        description: 'Composição excluída com sucesso!',
      });

      // Restore original confirm
      window.confirm = originalConfirm;
    });

    it('should not delete composition if user cancels confirmation', async () => {
      const mockDeleteComposition = vi.fn();
      
      mockHooks.useDeleteComposition.mockReturnValue({
        mutateAsync: mockDeleteComposition,
        isPending: false,
      });

      // Mock window.confirm to return false
      const originalConfirm = window.confirm;
      window.confirm = vi.fn().mockReturnValue(false);

      renderWithProvider(<CompositionManager />);

      const composition1Card = screen.getByText('Test Composition 1').closest('[data-testid="card"]');
      const deleteButton = within(composition1Card!).getByText('Del');
      
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteComposition).not.toHaveBeenCalled();

      // Restore original confirm
      window.confirm = originalConfirm;
    });
  });

  describe('Filtering and Search', () => {
    it('should filter compositions by status', async () => {
      renderWithProvider(<CompositionManager />);

      const statusSelect = screen.getByTestId('select');
      await user.selectOptions(statusSelect, 'validated');

      // Should call useCompositions with status filter
      expect(mockHooks.useCompositions).toHaveBeenLastCalledWith({ status: 'validated' });
    });

    it('should show filtered empty state message', () => {
      mockHooks.useCompositions.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      renderWithProvider(<CompositionManager />);

      // Simulate filtering by selecting a status
      const statusSelect = screen.getByTestId('select');
      fireEvent.change(statusSelect, { target: { value: 'executed' } });

      expect(screen.getByText('Não há composições com status "Executado"')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle composition action errors gracefully', async () => {
      const mockUpdateStatus = vi.fn().mockRejectedValue(
        new Error('Status update failed')
      );

      mockHooks.useUpdateCompositionStatus.mockReturnValue({
        mutateAsync: mockUpdateStatus,
        isPending: false,
      });

      renderWithProvider(<CompositionManager />);

      const composition1Card = screen.getByText('Test Composition 1').closest('[data-testid="card"]');
      const validateButton = within(composition1Card!).getByText('Val');
      
      await user.click(validateButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Erro',
          description: 'Status update failed',
          variant: 'destructive',
        });
      });
    });

    it('should show loading states during operations', () => {
      mockHooks.useCreateComposition.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
      });

      renderWithProvider(<CompositionManager />);

      // Open create dialog
      const newButton = screen.getByRole('button', { name: /nova composição/i });
      fireEvent.click(newButton);

      // Assembly component should receive loading state
      expect(screen.getByTestId('composition-assembly')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderWithProvider(<CompositionManager />);

      expect(screen.getByRole('button', { name: /nova composição/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // Status filter select
    });

    it('should handle keyboard navigation', async () => {
      renderWithProvider(<CompositionManager />);

      const newButton = screen.getByRole('button', { name: /nova composição/i });
      
      // Focus should work
      newButton.focus();
      expect(newButton).toHaveFocus();

      // Enter key should activate button
      fireEvent.keyDown(newButton, { key: 'Enter', code: 'Enter' });
      expect(screen.getByTestId('composition-assembly')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt button text for small screens', () => {
      renderWithProvider(<CompositionManager />);

      // Check for mobile-friendly button text
      expect(screen.getByText('Ver')).toBeInTheDocument();
      expect(screen.getByText('Rel')).toBeInTheDocument();
      expect(screen.getByText('Val')).toBeInTheDocument();
    });

    it('should handle mobile layout classes', () => {
      renderWithProvider(<CompositionManager />);

      const container = screen.getByText('Gerenciador de Composições').closest('div');
      expect(container).toHaveClass('space-y-4', 'md:space-y-6');
    });
  });
});