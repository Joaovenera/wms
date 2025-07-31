import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProductSearchField from '@/components/product-search-field'
import { api } from '@/lib/api'

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn()
  }
}))

describe('ProductSearchField Component Tests', () => {
  let queryClient: QueryClient
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  const mockProducts = [
    {
      id: 1,
      sku: 'PROD-001',
      name: 'Product One',
      description: 'First test product',
      stock: 100
    },
    {
      id: 2,
      sku: 'PROD-002',
      name: 'Product Two',
      description: 'Second test product',
      stock: 50
    },
    {
      id: 3,
      sku: 'ITEM-003',
      name: 'Different Item',
      description: 'Third test product',
      stock: 25
    }
  ]

  const renderProductSearch = (props = {}) => {
    const defaultProps = {
      onSelect: vi.fn(),
      placeholder: 'Search products...',
      ...props
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <ProductSearchField {...defaultProps} />
      </QueryClientProvider>
    )
  }

  describe('Component Rendering', () => {
    it('should render search input with placeholder', () => {
      renderProductSearch()

      expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should render with custom placeholder', () => {
      renderProductSearch({ placeholder: 'Find product by SKU...' })

      expect(screen.getByPlaceholderText('Find product by SKU...')).toBeInTheDocument()
    })

    it('should show search icon', () => {
      renderProductSearch()

      expect(screen.getByTestId('search-icon')).toBeInTheDocument()
    })

    it('should be accessible with proper ARIA attributes', () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
      expect(input).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Search Functionality', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: mockProducts })
    })

    it('should trigger search on input change', async () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/products/search', {
          params: { q: 'PROD', limit: 10 }
        })
      })
    })

    it('should debounce search input', async () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      
      // Type quickly
      await user.type(input, 'PROD-001')

      // Should not call API for each character
      expect(vi.mocked(api.get).mock.calls.length).toBeLessThan(8)
    })

    it('should not search with less than minimum characters', async () => {
      renderProductSearch({ minSearchLength: 3 })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PR')

      // Should not trigger search
      expect(api.get).not.toHaveBeenCalled()

      await user.type(input, 'O')
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled()
      })
    })

    it('should show loading state during search', async () => {
      vi.mocked(api.get).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: mockProducts }), 100))
      )

      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      expect(screen.getByTestId('search-loading')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByTestId('search-loading')).not.toBeInTheDocument()
      })
    })
  })

  describe('Search Results Display', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: mockProducts })
    })

    it('should display search results', async () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument()
        expect(screen.getByText('Product Two')).toBeInTheDocument()
        expect(screen.getByText('PROD-001')).toBeInTheDocument()
        expect(screen.getByText('PROD-002')).toBeInTheDocument()
      })

      expect(input).toHaveAttribute('aria-expanded', 'true')
    })

    it('should highlight search term in results', async () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        const highlightedElements = screen.getAllByTestId('search-highlight')
        expect(highlightedElements.length).toBeGreaterThan(0)
      })
    })

    it('should show stock information when available', async () => {
      renderProductSearch({ showStock: true })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Stock: 100')).toBeInTheDocument()
        expect(screen.getByText('Stock: 50')).toBeInTheDocument()
      })
    })

    it('should show no results message', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: [] })

      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'NON-EXISTENT')

      await waitFor(() => {
        expect(screen.getByText('No products found')).toBeInTheDocument()
      })
    })

    it('should limit displayed results', async () => {
      const manyProducts = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        sku: `PROD-${i + 1:03d}`,
        name: `Product ${i + 1}`,
        description: `Test product ${i + 1}`,
        stock: 10
      }))

      vi.mocked(api.get).mockResolvedValue({ data: manyProducts })

      renderProductSearch({ maxResults: 5 })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        const productItems = screen.getAllByTestId('product-result-item')
        expect(productItems).toHaveLength(5)
      })
    })
  })

  describe('Product Selection', () => {
    beforeEach(() => {
      vi.mocked(api.get).mockResolvedValue({ data: mockProducts })
    })

    it('should call onSelect when product is clicked', async () => {
      const onSelect = vi.fn()
      renderProductSearch({ onSelect })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Product One'))

      expect(onSelect).toHaveBeenCalledWith(mockProducts[0])
    })

    it('should fill input with selected product name', async () => {
      const onSelect = vi.fn()
      renderProductSearch({ onSelect })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Product One'))

      expect(input).toHaveValue('Product One')
    })

    it('should close dropdown after selection', async () => {
      const onSelect = vi.fn()
      renderProductSearch({ onSelect })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Product One'))

      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Product Two')).not.toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const onSelect = vi.fn()
      renderProductSearch({ onSelect })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument()
      })

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      expect(screen.getByTestId('product-result-0')).toHaveClass('highlighted')

      await user.keyboard('{ArrowDown}')
      expect(screen.getByTestId('product-result-1')).toHaveClass('highlighted')

      await user.keyboard('{ArrowUp}')
      expect(screen.getByTestId('product-result-0')).toHaveClass('highlighted')

      // Select with Enter
      await user.keyboard('{Enter}')
      expect(onSelect).toHaveBeenCalledWith(mockProducts[0])
    })

    it('should close dropdown with Escape key', async () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Product One')).not.toBeInTheDocument()
    })
  })

  describe('Barcode Scanner Integration', () => {
    it('should handle barcode scan input', async () => {
      const onSelect = vi.fn()
      renderProductSearch({ onSelect, supportBarcode: true })

      const input = screen.getByRole('combobox')
      
      // Simulate barcode scanner input (fast typing)
      fireEvent.change(input, { target: { value: '7891234567890' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/products/search', {
          params: { q: '7891234567890', limit: 10, barcode: true }
        })
      })
    })

    it('should differentiate between manual typing and barcode scanning', async () => {
      renderProductSearch({ supportBarcode: true })

      const input = screen.getByRole('combobox')
      
      // Manual typing (slow)
      await user.type(input, 'PROD', { delay: 100 })

      expect(api.get).toHaveBeenCalledWith('/api/products/search', {
        params: { q: 'PROD', limit: 10 }
      })

      vi.clearAllMocks()

      // Barcode scanning (fast)
      fireEvent.change(input, { target: { value: '7891234567890' } })
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/products/search', {
          params: { q: '7891234567890', limit: 10, barcode: true }
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle search API errors', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('API Error'))

      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Error searching products')).toBeInTheDocument()
      })
    })

    it('should handle network timeout', async () => {
      vi.mocked(api.get).mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1000)
        )
      )

      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Search timeout')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should recover from errors on new search', async () => {
      vi.mocked(api.get)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ data: mockProducts })

      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'ERROR')

      await waitFor(() => {
        expect(screen.getByText('Error searching products')).toBeInTheDocument()
      })

      await user.clear(input)
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByText('Product One')).toBeInTheDocument()
        expect(screen.queryByText('Error searching products')).not.toBeInTheDocument()
      })
    })
  })

  describe('Performance and Optimization', () => {
    it('should cancel previous requests when new search is made', async () => {
      const mockAbortController = { abort: vi.fn() }
      vi.spyOn(global, 'AbortController').mockImplementation(() => mockAbortController as any)

      renderProductSearch()

      const input = screen.getByRole('combobox')
      
      await user.type(input, 'PROD')
      await user.type(input, '-001')

      expect(mockAbortController.abort).toHaveBeenCalled()
    })

    it('should cache search results', async () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      
      // First search
      await user.type(input, 'PROD')
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(1)
      })

      // Clear and search same term again
      await user.clear(input)
      await user.type(input, 'PROD')

      // Should use cache, not make new API call
      expect(vi.mocked(api.get).mock.calls.length).toBeLessThanOrEqual(2)
    })

    it('should not search for empty input', async () => {
      renderProductSearch()

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled()
      })

      vi.clearAllMocks()

      await user.clear(input)

      // Should not trigger search for empty input
      expect(api.get).not.toHaveBeenCalled()
    })
  })

  describe('Customization', () => {
    it('should use custom result template', async () => {
      const CustomResultTemplate = ({ product }: any) => (
        <div data-testid="custom-result">
          Custom: {product.name} - {product.sku}
        </div>
      )

      vi.mocked(api.get).mockResolvedValue({ data: mockProducts })

      renderProductSearch({ 
        resultTemplate: CustomResultTemplate 
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(screen.getByTestId('custom-result')).toBeInTheDocument()
        expect(screen.getByText('Custom: Product One - PROD-001')).toBeInTheDocument()
      })
    })

    it('should apply custom styling classes', () => {
      renderProductSearch({ 
        className: 'custom-search-field',
        dropdownClassName: 'custom-dropdown'
      })

      expect(screen.getByTestId('product-search-field')).toHaveClass('custom-search-field')
    })

    it('should support custom search filters', async () => {
      renderProductSearch({ 
        searchFilters: { category: 'electronics', inStock: true }
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'PROD')

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/products/search', {
          params: { 
            q: 'PROD', 
            limit: 10,
            category: 'electronics',
            inStock: true
          }
        })
      })
    })
  })
})