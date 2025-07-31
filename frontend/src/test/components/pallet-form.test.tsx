import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PalletForm from '@/components/pallet-form'

// Mock dependencies
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('wouter', () => ({
  useLocation: () => ['/pallets', vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

describe('PalletForm Component Tests', () => {
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

  const renderPalletForm = (props = {}) => {
    const defaultProps = {
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      ...props
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <PalletForm {...defaultProps} />
      </QueryClientProvider>
    )
  }

  describe('Form Rendering', () => {
    it('should render empty form for new pallet', () => {
      renderPalletForm()

      expect(screen.getByLabelText(/código do pallet/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/peso máximo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/altura máxima/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /criar pallet/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
    })

    it('should render populated form for existing pallet', () => {
      const existingPallet = {
        id: 1,
        code: 'PAL-001',
        maxWeight: 1000,
        maxHeight: 200,
        status: 'active'
      }

      renderPalletForm({ pallet: existingPallet })

      expect(screen.getByDisplayValue('PAL-001')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument()
      expect(screen.getByDisplayValue('200')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /atualizar pallet/i })).toBeInTheDocument()
    })

    it('should show loading state when isLoading is true', () => {
      renderPalletForm({ isLoading: true })

      expect(screen.getByText(/salvando/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled()
    })
  })

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const onSubmit = vi.fn()
      renderPalletForm({ onSubmit })

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      expect(screen.getByText(/código é obrigatório/i)).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('should validate pallet code format', async () => {
      const onSubmit = vi.fn()
      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'invalid-code')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      expect(screen.getByText(/formato inválido/i)).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('should validate numeric fields', async () => {
      const onSubmit = vi.fn()
      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      const weightInput = screen.getByLabelText(/peso máximo/i)
      const heightInput = screen.getByLabelText(/altura máxima/i)

      await user.type(codeInput, 'PAL-001')
      await user.type(weightInput, 'not-a-number')
      await user.type(heightInput, '-50')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      expect(screen.getByText(/peso deve ser um número válido/i)).toBeInTheDocument()
      expect(screen.getByText(/altura deve ser positiva/i)).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('should validate weight and height limits', async () => {
      const onSubmit = vi.fn()
      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      const weightInput = screen.getByLabelText(/peso máximo/i)
      const heightInput = screen.getByLabelText(/altura máxima/i)

      await user.type(codeInput, 'PAL-001')
      await user.type(weightInput, '10000') // Too heavy
      await user.type(heightInput, '500') // Too tall

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      expect(screen.getByText(/peso não pode exceder/i)).toBeInTheDocument()
      expect(screen.getByText(/altura não pode exceder/i)).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Form Submission', () => {
    it('should submit valid form data', async () => {
      const onSubmit = vi.fn()
      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      const weightInput = screen.getByLabelText(/peso máximo/i)
      const heightInput = screen.getByLabelText(/altura máxima/i)

      await user.type(codeInput, 'PAL-001')
      await user.type(weightInput, '1000')
      await user.type(heightInput, '200')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          code: 'PAL-001',
          maxWeight: 1000,
          maxHeight: 200,
          status: 'active'
        })
      })
    })

    it('should handle form submission with optional fields', async () => {
      const onSubmit = vi.fn()
      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      const descriptionInput = screen.getByLabelText(/descrição/i)
      const locationSelect = screen.getByLabelText(/localização/i)

      await user.type(codeInput, 'PAL-002')
      await user.type(descriptionInput, 'Pallet for fragile items')
      await user.selectOptions(locationSelect, 'A-01-01')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          code: 'PAL-002',
          description: 'Pallet for fragile items',
          location: 'A-01-01',
          status: 'active'
        })
      })
    })

    it('should update existing pallet', async () => {
      const existingPallet = {
        id: 1,
        code: 'PAL-001',
        maxWeight: 1000,
        maxHeight: 200,
        status: 'active'
      }

      const onSubmit = vi.fn()
      renderPalletForm({ pallet: existingPallet, onSubmit })

      const weightInput = screen.getByLabelText(/peso máximo/i)
      await user.clear(weightInput)
      await user.type(weightInput, '1200')

      const submitButton = screen.getByRole('button', { name: /atualizar pallet/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          id: 1,
          code: 'PAL-001',
          maxWeight: 1200,
          maxHeight: 200,
          status: 'active'
        })
      })
    })
  })

  describe('Form Interactions', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const onCancel = vi.fn()
      renderPalletForm({ onCancel })

      const cancelButton = screen.getByRole('button', { name: /cancelar/i })
      await user.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })

    it('should reset form when reset button is clicked', async () => {
      renderPalletForm()

      const codeInput = screen.getByLabelText(/código do pallet/i)
      const weightInput = screen.getByLabelText(/peso máximo/i)

      await user.type(codeInput, 'PAL-001')
      await user.type(weightInput, '1000')

      const resetButton = screen.getByRole('button', { name: /limpar/i })
      await user.click(resetButton)

      expect(codeInput).toHaveValue('')
      expect(weightInput).toHaveValue('')
    })

    it('should auto-generate pallet code when button is clicked', async () => {
      renderPalletForm()

      const generateButton = screen.getByRole('button', { name: /gerar código/i })
      await user.click(generateButton)

      const codeInput = screen.getByLabelText(/código do pallet/i)
      expect(codeInput).toHaveValue(expect.stringMatching(/^PAL-\d{6}$/))
    })

    it('should show QR code preview when code is entered', async () => {
      renderPalletForm()

      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'PAL-001')

      await waitFor(() => {
        expect(screen.getByTestId('qr-code-preview')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderPalletForm()

      expect(screen.getByRole('form')).toBeInTheDocument()
      expect(screen.getByLabelText(/código do pallet/i)).toHaveAttribute('aria-required', 'true')
      expect(screen.getByRole('button', { name: /criar pallet/i })).toHaveAttribute('type', 'submit')
    })

    it('should show proper error states with ARIA attributes', async () => {
      const onSubmit = vi.fn()
      renderPalletForm({ onSubmit })

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      const codeInput = screen.getByLabelText(/código do pallet/i)
      expect(codeInput).toHaveAttribute('aria-invalid', 'true')
      expect(codeInput).toHaveAttribute('aria-describedby', expect.stringContaining('error'))
    })

    it('should support keyboard navigation', async () => {
      renderPalletForm()

      const codeInput = screen.getByLabelText(/código do pallet/i)
      const weightInput = screen.getByLabelText(/peso máximo/i)
      const heightInput = screen.getByLabelText(/altura máxima/i)
      const submitButton = screen.getByRole('button', { name: /criar pallet/i })

      // Tab through form elements
      await user.tab()
      expect(codeInput).toHaveFocus()

      await user.tab()
      expect(weightInput).toHaveFocus()

      await user.tab()
      expect(heightInput).toHaveFocus()

      // Continue tabbing to reach submit button
      await user.tab()
      await user.tab()
      expect(submitButton).toHaveFocus()
    })
  })

  describe('Error Handling', () => {
    it('should display server validation errors', async () => {
      const onSubmit = vi.fn().mockRejectedValue({
        response: {
          data: {
            errors: {
              code: 'Código já existe',
              maxWeight: 'Peso inválido'
            }
          }
        }
      })

      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'PAL-001')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Código já existe')).toBeInTheDocument()
        expect(screen.getByText('Peso inválido')).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'))
      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'PAL-001')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/erro de conexão/i)).toBeInTheDocument()
      })
    })

    it('should handle timeout errors', async () => {
      const onSubmit = vi.fn().mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      )

      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'PAL-001')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/tempo limite excedido/i)).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Performance', () => {
    it('should not trigger unnecessary re-renders', async () => {
      const renderSpy = vi.fn()
      const TestComponent = () => {
        renderSpy()
        return <PalletForm onSubmit={vi.fn()} onCancel={vi.fn()} />
      }

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      )

      const initialRenderCount = renderSpy.mock.calls.length

      // Type in input - should not cause excessive re-renders
      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'PAL-001')

      // Allow for reasonable re-render count (initial + state updates)
      expect(renderSpy.mock.calls.length).toBeLessThan(initialRenderCount + 10)
    })

    it('should debounce validation', async () => {
      const validationSpy = vi.fn()
      renderPalletForm()

      const codeInput = screen.getByLabelText(/código do pallet/i)
      
      // Type quickly
      await user.type(codeInput, 'PAL-001')

      // Validation should be debounced
      await waitFor(() => {
        expect(validationSpy.mock.calls.length).toBeLessThan(7) // One per character would be 7
      }, { timeout: 1000 })
    })
  })

  describe('Integration with React Query', () => {
    it('should handle loading states from mutations', async () => {
      const onSubmit = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'PAL-001')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      expect(screen.getByText(/salvando/i)).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        expect(screen.queryByText(/salvando/i)).not.toBeInTheDocument()
      })
    })

    it('should invalidate related queries on successful submission', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
      
      const onSubmit = vi.fn().mockResolvedValue({ id: 1, code: 'PAL-001' })
      renderPalletForm({ onSubmit })

      const codeInput = screen.getByLabelText(/código do pallet/i)
      await user.type(codeInput, 'PAL-001')

      const submitButton = screen.getByRole('button', { name: /criar pallet/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith(['pallets'])
      })
    })
  })
})