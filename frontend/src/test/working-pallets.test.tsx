import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from './utils'
import { server } from './mocks/server'
import PalletsPage from '../pages/pallets'

// Configurar servidor de mocks
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock do router
vi.mock('wouter', () => ({
  useLocation: () => ['/pallets', vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// Mock dos componentes que podem causar problemas
vi.mock('@/components/camera-capture', () => ({
  default: () => <div data-testid="camera-capture">Camera Capture</div>
}))

vi.mock('@/components/qr-code-dialog', () => ({
  default: () => <div data-testid="qr-code-dialog">QR Code Dialog</div>
}))

describe('Página de Pallets - Testes Funcionais', () => {
  describe('Renderização Inicial', () => {
    it('deve renderizar o título e descrição da página', async () => {
      render(<PalletsPage />)
      
      expect(screen.getByText('Pallets')).toBeInTheDocument()
      expect(screen.getByText('Gerenciamento de pallets do armazém')).toBeInTheDocument()
    })

    it('deve exibir o botão de adicionar pallet', async () => {
      render(<PalletsPage />)
      
      expect(screen.getByRole('button', { name: /novo pallet/i })).toBeInTheDocument()
    })

    it('deve exibir controles de filtro', async () => {
      render(<PalletsPage />)
      
      expect(screen.getByPlaceholderText(/buscar pallets/i)).toBeInTheDocument()
      expect(screen.getByText('Todos os Status')).toBeInTheDocument()
    })
  })

  describe('Carregamento de Dados', () => {
    it('deve carregar e exibir a lista de pallets', async () => {
      render(<PalletsPage />)
      
      // Aguardar o carregamento
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      expect(screen.getByText('PLT0002')).toBeInTheDocument()
      expect(screen.getByText('PLT0003')).toBeInTheDocument()
    })

    it('deve exibir informações corretas dos pallets', async () => {
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Verificar tipo
      expect(screen.getByText('PBR')).toBeInTheDocument()
      expect(screen.getByText('Europeu')).toBeInTheDocument()
      
      // Verificar material
      expect(screen.getByText('Madeira')).toBeInTheDocument()
      expect(screen.getByText('Plástico')).toBeInTheDocument()
      
      // Verificar dimensões
      expect(screen.getByText('100×120×14cm')).toBeInTheDocument()
      expect(screen.getByText('80×120×14cm')).toBeInTheDocument()
    })

    it('deve exibir status corretos dos pallets', async () => {
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Disponível')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      expect(screen.getByText('Em Uso')).toBeInTheDocument()
      expect(screen.getByText('Defeituoso')).toBeInTheDocument()
    })
  })

  describe('Filtros', () => {
    it('deve filtrar pallets por busca de texto', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      const searchInput = screen.getByPlaceholderText(/buscar pallets/i)
      await user.type(searchInput, 'PLT0001')
      
      // Deve mostrar apenas PLT0001
      expect(screen.getByText('PLT0001')).toBeInTheDocument()
      expect(screen.queryByText('PLT0002')).not.toBeInTheDocument()
    })

    it('deve limpar filtros', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Aplicar filtro
      const searchInput = screen.getByPlaceholderText(/buscar pallets/i)
      await user.type(searchInput, 'PLT0001')
      
      // Limpar filtro
      await user.clear(searchInput)
      
      // Deve mostrar todos os pallets novamente
      await waitFor(() => {
        expect(screen.getByText('PLT0002')).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Criação de Pallet', () => {
    it('deve abrir modal de criação ao clicar no botão adicionar', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      const addButton = screen.getByRole('button', { name: /novo pallet/i })
      await user.click(addButton)
      
      expect(screen.getByText('Nova Layers')).toBeInTheDocument()
      expect(screen.getByLabelText('Código')).toBeInTheDocument()
      expect(screen.getByLabelText('Tipo')).toBeInTheDocument()
    })

    it('deve preencher automaticamente o código do pallet', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      const addButton = screen.getByRole('button', { name: /novo pallet/i })
      await user.click(addButton)
      
      await waitFor(() => {
        const codeInput = screen.getByDisplayValue('PLT0004')
        expect(codeInput).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Edição de Pallet', () => {
    it('deve abrir modal de edição ao clicar no botão editar', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Encontrar e clicar no botão de editar do primeiro pallet
      const editButtons = screen.getAllByTitle(/editar/i)
      await user.click(editButtons[0])
      
      expect(screen.getByText('Editar Layers')).toBeInTheDocument()
      expect(screen.getByDisplayValue('PLT0001')).toBeInTheDocument()
    })
  })

  describe('Visualização de Detalhes', () => {
    it('deve mostrar QR code ao clicar no ícone', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Encontrar e clicar no botão de QR code
      const qrButtons = screen.getAllByTitle(/gerar qr code/i)
      await user.click(qrButtons[0])
      
      // Deve mostrar algum dialog relacionado ao QR code
      expect(screen.getByTestId('qr-code-dialog')).toBeInTheDocument()
    })

    it('deve mostrar observações quando disponíveis', async () => {
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Pallet em bom estado')).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Estados de Loading e Erro', () => {
    it('deve mostrar estado vazio quando não há pallets', async () => {
      render(<PalletsPage />)
      
      // Verificar se existe algum indicador de estado vazio
      await waitFor(() => {
        const emptyState = screen.queryByText(/nenhum pallet encontrado/i) || 
                          screen.queryByText(/comece criando/i)
        expect(emptyState).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })
}) 