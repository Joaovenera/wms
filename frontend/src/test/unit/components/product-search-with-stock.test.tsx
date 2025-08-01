import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductSearchWithStock } from '@/components/product-search-with-stock';

// Mock API request
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}));

const mockProducts = [
  {
    id: 1,
    sku: 'SKU001',
    name: 'Produto A',
    unit: 'UN',
    totalStock: 100,
    dimensions: {
      length: 10,
      width: 5,
      height: 3
    }
  },
  {
    id: 2,
    sku: 'SKU002',
    name: 'Produto B',
    unit: 'KG',
    totalStock: 0,
    dimensions: {
      length: 20,
      width: 10,
      height: 5
    }
  },
  {
    id: 3,
    sku: 'SKU003',
    name: 'Produto C',
    unit: 'UN',
    totalStock: 50,
    dimensions: {
      length: 15,
      width: 8,
      height: 4
    }
  }
];

// Mock useQuery
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: mockProducts,
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

describe('ProductSearchWithStock Component', () => {
  const mockOnProductSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnProductSelect.mockClear();
  });

  it('should render search input with placeholder', () => {
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    expect(screen.getByPlaceholderText('Pesquisar produto com estoque...')).toBeInTheDocument();
  });

  it('should render custom placeholder', () => {
    renderWithQueryClient(
      <ProductSearchWithStock 
        onProductSelect={mockOnProductSelect}
        placeholder="Buscar produto..."
      />
    );
    
    expect(screen.getByPlaceholderText('Buscar produto...')).toBeInTheDocument();
  });

  it('should filter products by search term', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'Produto A');
    
    await waitFor(() => {
      expect(screen.getByText('Produto A')).toBeInTheDocument();
      expect(screen.queryByText('Produto B')).not.toBeInTheDocument();
      expect(screen.queryByText('Produto C')).not.toBeInTheDocument();
    });
  });

  it('should filter products by SKU', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'SKU002');
    
    await waitFor(() => {
      expect(screen.getByText('Produto B')).toBeInTheDocument();
      expect(screen.queryByText('Produto A')).not.toBeInTheDocument();
    });
  });

  it('should show only products with stock when showOnlyInStock is true', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock 
        onProductSelect={mockOnProductSelect}
        showOnlyInStock={true}
      />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('Produto A')).toBeInTheDocument(); // stock: 100
      expect(screen.getByText('Produto C')).toBeInTheDocument(); // stock: 50
      expect(screen.queryByText('Produto B')).not.toBeInTheDocument(); // stock: 0
    });
  });

  it('should show all products when showOnlyInStock is false', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock 
        onProductSelect={mockOnProductSelect}
        showOnlyInStock={false}
      />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('Produto A')).toBeInTheDocument();
      expect(screen.getByText('Produto B')).toBeInTheDocument();
      expect(screen.getByText('Produto C')).toBeInTheDocument();
    });
  });

  it('should display product information correctly', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('SKU001')).toBeInTheDocument();
      expect(screen.getByText('Produto A')).toBeInTheDocument();
      expect(screen.getByText('UN')).toBeInTheDocument();
      expect(screen.getByText('100 em estoque')).toBeInTheDocument();
    });
  });

  it('should call onProductSelect when product is selected', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('Produto A')).toBeInTheDocument();
    });
    
    const productOption = screen.getByText('Produto A');
    await user.click(productOption);
    
    expect(mockOnProductSelect).toHaveBeenCalledWith(mockProducts[0]);
  });

  it('should display selected product', () => {
    renderWithQueryClient(
      <ProductSearchWithStock 
        onProductSelect={mockOnProductSelect}
        selectedProduct={mockProducts[0]}
      />
    );
    
    expect(screen.getByDisplayValue('SKU001 - Produto A')).toBeInTheDocument();
  });

  it('should allow clearing selected product', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock 
        onProductSelect={mockOnProductSelect}
        selectedProduct={mockProducts[0]}
      />
    );
    
    const clearButton = screen.getByRole('button', { name: /limpar/i });
    await user.click(clearButton);
    
    expect(mockOnProductSelect).toHaveBeenCalledWith(null);
  });

  it('should show loading state', () => {
    const { useQuery } = require('@tanstack/react-query');
    useQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null
    });

    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    const { useQuery } = require('@tanstack/react-query');
    useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch products')
    });

    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    expect(screen.getByText(/erro ao carregar produtos/i)).toBeInTheDocument();
  });

  it('should show no results message when search has no matches', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'produto inexistente');
    
    await waitFor(() => {
      expect(screen.getByText(/nenhum produto encontrado/i)).toBeInTheDocument();
    });
  });

  it('should show stock warning for out of stock products', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock 
        onProductSelect={mockOnProductSelect}
        showOnlyInStock={false}
      />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'Produto B');
    
    await waitFor(() => {
      expect(screen.getByText(/sem estoque/i)).toBeInTheDocument();
    });
  });

  it('should display product dimensions when available', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    
    await waitFor(() => {
      expect(screen.getByText('10x5x3')).toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    
    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    
    expect(mockOnProductSelect).toHaveBeenCalledWith(mockProducts[1]);
  });

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );
    
    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    
    // Click outside
    await user.click(document.body);
    
    await waitFor(() => {
      expect(screen.queryByText('Produto A')).not.toBeInTheDocument();
    });
  });
});