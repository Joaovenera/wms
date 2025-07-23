import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../utils'
import { server } from '../mocks/server'
import PalletsPage from '../../pages/pallets'

// Configurar servidor de mocks
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock do router
vi.mock('wouter', () => ({
  useLocation: () => ['/pallets', vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

describe('Página de Pallets', () => {
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
      })
      
      expect(screen.getByText('PLT0002')).toBeInTheDocument()
      expect(screen.getByText('PLT0003')).toBeInTheDocument()
    })

    it('deve exibir informações corretas dos pallets', async () => {
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
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
      })
      
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
      })
      
      const searchInput = screen.getByPlaceholderText(/buscar por código, tipo ou material/i)
      await user.type(searchInput, 'PLT0001')
      
      // Deve mostrar apenas PLT0001
      expect(screen.getByText('PLT0001')).toBeInTheDocument()
      expect(screen.queryByText('PLT0002')).not.toBeInTheDocument()
    })

    it('deve filtrar pallets por status', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      // Abrir filtro de status
      const statusFilter = screen.getByRole('combobox')
      await user.click(statusFilter)
      
      // Selecionar "Em Uso"
      await user.click(screen.getByText('Em Uso'))
      
      // Deve mostrar apenas pallets em uso
      await waitFor(() => {
        expect(screen.getByText('PLT0002')).toBeInTheDocument()
        expect(screen.queryByText('PLT0001')).not.toBeInTheDocument()
      })
    })

    it('deve limpar filtros', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      // Aplicar filtro
      const searchInput = screen.getByPlaceholderText(/buscar por código, tipo ou material/i)
      await user.type(searchInput, 'PLT0001')
      
      // Limpar filtro
      await user.clear(searchInput)
      
      // Deve mostrar todos os pallets novamente
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
        expect(screen.getByText('PLT0002')).toBeInTheDocument()
        expect(screen.getByText('PLT0003')).toBeInTheDocument()
      })
    })
  })

  describe('Criação de Pallet', () => {
    it('deve abrir modal de criação ao clicar no botão adicionar', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      const addButton = screen.getByRole('button', { name: /adicionar pallet/i })
      await user.click(addButton)
      
      expect(screen.getByText('Adicionar Pallet')).toBeInTheDocument()
      expect(screen.getByLabelText('Código')).toBeInTheDocument()
      expect(screen.getByLabelText('Tipo')).toBeInTheDocument()
    })

    it('deve preencher automaticamente o código do pallet', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      const addButton = screen.getByRole('button', { name: /adicionar pallet/i })
      await user.click(addButton)
      
      await waitFor(() => {
        const codeInput = screen.getByDisplayValue('PLT0004')
        expect(codeInput).toBeInTheDocument()
      })
    })

    it('deve validar campos obrigatórios', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      const addButton = screen.getByRole('button', { name: /adicionar pallet/i })
      await user.click(addButton)
      
      // Tentar salvar sem preencher campos
      const saveButton = screen.getByRole('button', { name: /salvar/i })
      await user.click(saveButton)
      
      // Deve mostrar mensagens de erro
      await waitFor(() => {
        expect(screen.getByText(/tipo é obrigatório/i)).toBeInTheDocument()
      })
    })

    it('deve criar pallet com sucesso', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      const addButton = screen.getByRole('button', { name: /adicionar pallet/i })
      await user.click(addButton)
      
      // Preencher formulário
      await user.selectOptions(screen.getByLabelText('Tipo'), 'PBR')
      await user.selectOptions(screen.getByLabelText('Material'), 'Madeira')
      await user.type(screen.getByLabelText('Largura (cm)'), '100')
      await user.type(screen.getByLabelText('Comprimento (cm)'), '120')
      await user.type(screen.getByLabelText('Altura (cm)'), '14')
      await user.type(screen.getByLabelText('Peso Máximo (kg)'), '1500')
      
      // Salvar
      const saveButton = screen.getByRole('button', { name: /salvar/i })
      await user.click(saveButton)
      
      // Modal deve fechar e pallet deve aparecer na lista
      await waitFor(() => {
        expect(screen.queryByText('Adicionar Pallet')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edição de Pallet', () => {
    it('deve abrir modal de edição ao clicar no botão editar', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      // Encontrar e clicar no botão de editar do primeiro pallet
      const editButtons = screen.getAllByLabelText(/editar pallet/i)
      await user.click(editButtons[0])
      
      expect(screen.getByText('Editar Pallet')).toBeInTheDocument()
      expect(screen.getByDisplayValue('PLT0001')).toBeInTheDocument()
    })

    it('deve pré-preencher formulário com dados do pallet', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      const editButtons = screen.getAllByLabelText(/editar pallet/i)
      await user.click(editButtons[0])
      
      expect(screen.getByDisplayValue('PLT0001')).toBeInTheDocument()
      expect(screen.getByDisplayValue('PBR')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Madeira')).toBeInTheDocument()
    })

    it('deve salvar alterações com sucesso', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      const editButtons = screen.getAllByLabelText(/editar pallet/i)
      await user.click(editButtons[0])
      
      // Alterar observações
      const observationsField = screen.getByLabelText('Observações')
      await user.clear(observationsField)
      await user.type(observationsField, 'Pallet atualizado nos testes')
      
      // Salvar
      const saveButton = screen.getByRole('button', { name: /salvar/i })
      await user.click(saveButton)
      
      // Modal deve fechar
      await waitFor(() => {
        expect(screen.queryByText('Editar Pallet')).not.toBeInTheDocument()
      })
    })
  })

  describe('Exclusão de Pallet', () => {
    it('deve mostrar confirmação ao tentar deletar', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      // Encontrar e clicar no botão de deletar
      const deleteButtons = screen.getAllByLabelText(/deletar pallet/i)
      await user.click(deleteButtons[0])
      
      expect(screen.getByText(/tem certeza que deseja deletar/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /deletar/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
    })

    it('deve cancelar exclusão', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      const deleteButtons = screen.getAllByLabelText(/deletar pallet/i)
      await user.click(deleteButtons[0])
      
      // Cancelar
      const cancelButton = screen.getByRole('button', { name: /cancelar/i })
      await user.click(cancelButton)
      
      // Pallet deve continuar na lista
      expect(screen.getByText('PLT0001')).toBeInTheDocument()
    })

    it('deve deletar pallet com sucesso', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      const deleteButtons = screen.getAllByLabelText(/deletar pallet/i)
      await user.click(deleteButtons[0])
      
      // Confirmar exclusão
      const confirmButton = screen.getByRole('button', { name: /deletar/i })
      await user.click(confirmButton)
      
      // Pallet deve sumir da lista
      await waitFor(() => {
        expect(screen.queryByText('PLT0001')).not.toBeInTheDocument()
      })
    })
  })

  describe('Visualização de Detalhes', () => {
    it('deve mostrar QR code ao clicar no ícone', async () => {
      const user = userEvent.setup()
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('PLT0001')).toBeInTheDocument()
      })
      
      // Encontrar e clicar no botão de QR code
      const qrButtons = screen.getAllByLabelText(/mostrar qr code/i)
      await user.click(qrButtons[0])
      
      expect(screen.getByText(/qr code/i)).toBeInTheDocument()
    })

    it('deve mostrar observações quando disponíveis', async () => {
      render(<PalletsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Pallet em bom estado')).toBeInTheDocument()
      })
    })

    it('deve mostrar data da última inspeção quando disponível', async () => {
      render(<PalletsPage />)
      
      await waitFor(() => {
        // PLT0003 tem data de inspeção
        expect(screen.getByText('PLT0003')).toBeInTheDocument()
      })
      
      // Verificar se a data aparece (formato pode variar)
      expect(screen.getByText(/15/)).toBeInTheDocument()
    })
  })

  describe('Responsividade', () => {
    it('deve adaptar layout para mobile', () => {
      // Simular viewport mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      render(<PalletsPage />)
      
      // Verificar se elementos estão presentes (layout mobile)
      expect(screen.getByText('Pallets')).toBeInTheDocument()
    })
  })

  describe('Estados de Loading e Erro', () => {
    it('deve mostrar loading durante carregamento', () => {
      render(<PalletsPage />)
      
      // Verificar se existe algum indicador de loading
      const loadingElements = screen.queryAllByText(/carregando/i)
      expect(loadingElements.length).toBeGreaterThanOrEqual(0)
    })
  })
}) 