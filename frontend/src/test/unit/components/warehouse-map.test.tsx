import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WarehouseMap from '@/components/warehouse-map';
import { Position } from '@/types/api';

// Mock data
const mockPositions: Position[] = [
  {
    id: 1,
    street: 'A',
    number: 1,
    level: 1,
    side: 'L',
    status: 'disponivel',
    capacity: 100,
    currentStock: 0,
    productId: null,
    palletId: null,
    reservedBy: null,
    reservedAt: null,
    lastMovement: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 2,
    street: 'A',
    number: 2,
    level: 1,
    side: 'L',
    status: 'ocupada',
    capacity: 100,
    currentStock: 50,
    productId: 1,
    palletId: 1,
    reservedBy: null,
    reservedAt: null,
    lastMovement: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: 3,
    street: 'B',
    number: 1,
    level: 1,
    side: 'L',
    status: 'reservada',
    capacity: 100,
    currentStock: 0,
    productId: null,
    palletId: null,
    reservedBy: 1,
    reservedAt: new Date('2024-01-16'),
    lastMovement: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-16')
  },
  {
    id: 4,
    street: 'B',
    number: 2,
    level: 1,
    side: 'L',
    status: 'manutencao',
    capacity: 100,
    currentStock: 0,
    productId: null,
    palletId: null,
    reservedBy: null,
    reservedAt: null,
    lastMovement: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-10')
  },
  {
    id: 5,
    street: 'C',
    number: 1,
    level: 1,
    side: 'L',
    status: 'bloqueada',
    capacity: 100,
    currentStock: 0,
    productId: null,
    palletId: null,
    reservedBy: null,
    reservedAt: null,
    lastMovement: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-05')
  }
];

// Mock the API query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: mockPositions,
      isLoading: false,
      error: null
    }))
  };
});

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('WarehouseMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render warehouse map with positions', () => {
    renderWithQueryClient(<WarehouseMap />);
    
    expect(screen.getByText('Mapa do Armazém')).toBeInTheDocument();
    expect(screen.getByText('Rua A')).toBeInTheDocument();
    expect(screen.getByText('Rua B')).toBeInTheDocument();
    expect(screen.getByText('Rua C')).toBeInTheDocument();
  });

  it('should display position status correctly', () => {
    renderWithQueryClient(<WarehouseMap />);
    
    // Check for status indicators
    expect(screen.getByText('🟢')).toBeInTheDocument(); // disponivel
    expect(screen.getByText('🔴')).toBeInTheDocument(); // ocupada
    expect(screen.getByText('🟡')).toBeInTheDocument(); // reservada
    expect(screen.getByText('🟠')).toBeInTheDocument(); // manutencao
    expect(screen.getByText('⚫')).toBeInTheDocument(); // bloqueada
  });

  it('should show position details on hover', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WarehouseMap />);
    
    const positionCard = screen.getByText('A-1-1-L').closest('.position-card');
    expect(positionCard).toBeInTheDocument();
    
    if (positionCard) {
      await user.hover(positionCard);
      
      await waitFor(() => {
        expect(screen.getByText('Posição: A-1-1-L')).toBeInTheDocument();
        expect(screen.getByText('Status: Disponível')).toBeInTheDocument();
        expect(screen.getByText('Capacidade: 100')).toBeInTheDocument();
      });
    }
  });

  it('should filter positions by street', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WarehouseMap />);
    
    const streetButton = screen.getByText('Rua A');
    await user.click(streetButton);
    
    // Should highlight positions from street A
    expect(screen.getByText('A-1-1-L')).toBeInTheDocument();
    expect(screen.getByText('A-2-1-L')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { useQuery } = require('@tanstack/react-query');
    useQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null
    });

    renderWithQueryClient(<WarehouseMap />);
    
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    const { useQuery } = require('@tanstack/react-query');
    useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch positions')
    });

    renderWithQueryClient(<WarehouseMap />);
    
    expect(screen.getByText(/erro ao carregar/i)).toBeInTheDocument();
  });

  it('should display position statistics', () => {
    renderWithQueryClient(<WarehouseMap />);
    
    expect(screen.getByText(/total.*5/i)).toBeInTheDocument();
    expect(screen.getByText(/disponível.*1/i)).toBeInTheDocument();
    expect(screen.getByText(/ocupada.*1/i)).toBeInTheDocument();
    expect(screen.getByText(/reservada.*1/i)).toBeInTheDocument();
    expect(screen.getByText(/manutenção.*1/i)).toBeInTheDocument();
    expect(screen.getByText(/bloqueada.*1/i)).toBeInTheDocument();
  });

  it('should handle position click events', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WarehouseMap />);
    
    const positionCard = screen.getByText('A-1-1-L').closest('.position-card');
    expect(positionCard).toBeInTheDocument();
    
    if (positionCard) {
      await user.click(positionCard);
      
      // Should show position details modal or similar
      await waitFor(() => {
        expect(screen.getByText('Detalhes da Posição')).toBeInTheDocument();
      });
    }
  });

  it('should refresh data automatically', () => {
    const { useQuery } = require('@tanstack/react-query');
    renderWithQueryClient(<WarehouseMap />);
    
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['/api/positions'],
        refetchInterval: 30000
      })
    );
  });

  it('should handle empty positions data', () => {
    const { useQuery } = require('@tanstack/react-query');
    useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    });

    renderWithQueryClient(<WarehouseMap />);
    
    expect(screen.getByText(/nenhuma posição encontrada/i)).toBeInTheDocument();
  });

  it('should show different colors for different statuses', () => {
    renderWithQueryClient(<WarehouseMap />);
    
    const availablePosition = screen.getByText('A-1-1-L').closest('.position-card');
    const occupiedPosition = screen.getByText('A-2-1-L').closest('.position-card');
    const reservedPosition = screen.getByText('B-1-1-L').closest('.position-card');
    const maintenancePosition = screen.getByText('B-2-1-L').closest('.position-card');
    const blockedPosition = screen.getByText('C-1-1-L').closest('.position-card');
    
    expect(availablePosition).toHaveClass(/green/);
    expect(occupiedPosition).toHaveClass(/red/);
    expect(reservedPosition).toHaveClass(/yellow/);
    expect(maintenancePosition).toHaveClass(/orange/);
    expect(blockedPosition).toHaveClass(/gray/);
  });

  it('should display capacity usage for occupied positions', () => {
    renderWithQueryClient(<WarehouseMap />);
    
    // Position A-2-1-L is occupied with 50% capacity
    expect(screen.getByText('50/100')).toBeInTheDocument();
  });

  it('should handle street selection and deselection', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<WarehouseMap />);
    
    const streetButton = screen.getByText('Rua A');
    
    // Select street
    await user.click(streetButton);
    expect(streetButton).toHaveClass(/selected/);
    
    // Deselect street
    await user.click(streetButton);
    expect(streetButton).not.toHaveClass(/selected/);
  });
});