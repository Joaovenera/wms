import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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

describe('Workflow Completo de Pallets - Simulação de Usuário Real', () => {
  it('Cenário: Usuário gerencia pallets do início ao fim', async () => {
    const user = userEvent.setup()
    
    // ====================
    // ETAPA 1: Acesso inicial à página
    // ====================
    render(<PalletsPage />)
    
    // Verificar se a página carregou corretamente
    expect(screen.getByText('Pallets')).toBeInTheDocument()
    expect(screen.getByText('Gerencie os pallets do armazém')).toBeInTheDocument()
    
    // Aguardar carregamento dos dados
    await waitFor(() => {
      expect(screen.getByText('PLT0001')).toBeInTheDocument()
    })
    
    // Verificar se mostra a lista inicial (3 pallets)
    expect(screen.getByText('PLT0001')).toBeInTheDocument()
    expect(screen.getByText('PLT0002')).toBeInTheDocument()
    expect(screen.getByText('PLT0003')).toBeInTheDocument()
    
    // ====================
    // ETAPA 2: Explorar filtros
    // ====================
    
    // Testar busca por texto
    const searchInput = screen.getByPlaceholderText(/buscar por código, tipo ou material/i)
    await user.type(searchInput, 'PLT0001')
    
    // Verificar filtro aplicado
    expect(screen.getByText('PLT0001')).toBeInTheDocument()
    expect(screen.queryByText('PLT0002')).not.toBeInTheDocument()
    
    // Limpar busca
    await user.clear(searchInput)
    
    // Todos os pallets devem voltar
    await waitFor(() => {
      expect(screen.getByText('PLT0002')).toBeInTheDocument()
    })
    
    // ====================
    // ETAPA 3: Criar novo pallet
    // ====================
    
    // Clicar no botão de adicionar
    const addButton = screen.getByRole('button', { name: /adicionar pallet/i })
    await user.click(addButton)
    
    // Verificar se modal abriu
    expect(screen.getByText('Adicionar Pallet')).toBeInTheDocument()
    
    // Verificar se código foi preenchido automaticamente
    await waitFor(() => {
      const codeInput = screen.getByDisplayValue('PLT0004')
      expect(codeInput).toBeInTheDocument()
    })
    
    // Preencher formulário do novo pallet
    const typeSelect = screen.getByLabelText('Tipo')
    await user.selectOptions(typeSelect, 'PBR')
    
    const materialSelect = screen.getByLabelText('Material')
    await user.selectOptions(materialSelect, 'Madeira')
    
    const widthInput = screen.getByLabelText('Largura (cm)')
    await user.type(widthInput, '100')
    
    const lengthInput = screen.getByLabelText('Comprimento (cm)')
    await user.type(lengthInput, '120')
    
    const heightInput = screen.getByLabelText('Altura (cm)')
    await user.type(heightInput, '14')
    
    const maxWeightInput = screen.getByLabelText('Peso Máximo (kg)')
    await user.type(maxWeightInput, '1500')
    
    const observationsInput = screen.getByLabelText('Observações')
    await user.type(observationsInput, 'Pallet criado durante teste automatizado')
    
    // Salvar pallet
    const saveButton = screen.getByRole('button', { name: /salvar/i })
    await user.click(saveButton)
    
    // Verificar se modal fechou
    await waitFor(() => {
      expect(screen.queryByText('Adicionar Pallet')).not.toBeInTheDocument()
    })
    
    // Verificar se novo pallet aparece na lista
    await waitFor(() => {
      expect(screen.getByText('PLT0004')).toBeInTheDocument()
    })
    
    // ====================
    // ETAPA 4: Editar pallet existente
    // ====================
    
    // Encontrar e clicar no botão de editar do primeiro pallet
    const editButtons = screen.getAllByLabelText(/editar pallet/i)
    await user.click(editButtons[0])
    
    // Verificar se modal de edição abriu
    expect(screen.getByText('Editar Pallet')).toBeInTheDocument()
    
    // Verificar se dados foram pré-preenchidos
    expect(screen.getByDisplayValue('PLT0001')).toBeInTheDocument()
    
    // Modificar observações
    const editObservationsInput = screen.getByLabelText('Observações')
    await user.clear(editObservationsInput)
    await user.type(editObservationsInput, 'Pallet atualizado durante teste')
    
    // Alterar status
    const statusSelect = screen.getByLabelText('Status')
    await user.selectOptions(statusSelect, 'em_uso')
    
    // Salvar alterações
    const updateButton = screen.getByRole('button', { name: /salvar/i })
    await user.click(updateButton)
    
    // Verificar se modal fechou
    await waitFor(() => {
      expect(screen.queryByText('Editar Pallet')).not.toBeInTheDocument()
    })
    
    // ====================
    // ETAPA 5: Visualizar QR Code
    // ====================
    
    // Clicar no ícone de QR code de um pallet
    const qrButtons = screen.getAllByLabelText(/mostrar qr code/i)
    await user.click(qrButtons[0])
    
    // Verificar se dialog de QR code abriu
    expect(screen.getByText(/qr code/i)).toBeInTheDocument()
    
    // Fechar dialog
    const closeButton = screen.getByRole('button', { name: /fechar/i })
    await user.click(closeButton)
    
    // ====================
    // ETAPA 6: Filtrar por status
    // ====================
    
    // Aplicar filtro por status "Em Uso"
    const statusFilter = screen.getAllByRole('combobox')[0] // Primeiro combobox é do filtro
    await user.click(statusFilter)
    
    const emUsoOption = screen.getByText('Em Uso')
    await user.click(emUsoOption)
    
    // Verificar se mostra apenas pallets em uso
    await waitFor(() => {
      const palletCards = screen.getAllByText(/PLT\d+/)
      // Deve mostrar pelo menos o PLT0002 (em_uso) e possivelmente PLT0001 (que acabamos de alterar)
      expect(palletCards.length).toBeGreaterThan(0)
    })
    
    // ====================
    // ETAPA 7: Testar exclusão (com cancelamento)
    // ====================
    
    // Resetar filtro para ver todos os pallets
    await user.click(statusFilter)
    const todosOption = screen.getByText('Todos os Status')
    await user.click(todosOption)
    
    await waitFor(() => {
      expect(screen.getByText('PLT0003')).toBeInTheDocument()
    })
    
    // Tentar deletar um pallet
    const deleteButtons = screen.getAllByLabelText(/deletar pallet/i)
    await user.click(deleteButtons[2]) // Deletar o terceiro pallet (PLT0003)
    
    // Verificar confirmação
    expect(screen.getByText(/tem certeza que deseja deletar/i)).toBeInTheDocument()
    
    // Cancelar
    const cancelButton = screen.getByRole('button', { name: /cancelar/i })
    await user.click(cancelButton)
    
    // Verificar se pallet ainda está na lista
    expect(screen.getByText('PLT0003')).toBeInTheDocument()
    
    // ====================
    // ETAPA 8: Exclusão confirmada
    // ====================
    
    // Tentar deletar novamente
    await user.click(deleteButtons[2])
    
    // Confirmar exclusão
    const confirmDeleteButton = screen.getByRole('button', { name: /deletar/i })
    await user.click(confirmDeleteButton)
    
    // Verificar se pallet foi removido
    await waitFor(() => {
      expect(screen.queryByText('PLT0003')).not.toBeInTheDocument()
    })
    
    // ====================
    // ETAPA 9: Verificação final do estado
    // ====================
    
    // Contar pallets restantes
    const remainingPallets = screen.getAllByText(/PLT\d+/)
    expect(remainingPallets.length).toBe(3) // PLT0001, PLT0002, PLT0004
    
    // Verificar se pallets específicos estão presentes
    expect(screen.getByText('PLT0001')).toBeInTheDocument()
    expect(screen.getByText('PLT0002')).toBeInTheDocument()
    expect(screen.getByText('PLT0004')).toBeInTheDocument()
    
    // Verificar se status foram atualizados corretamente
    expect(screen.getByText('Disponível')).toBeInTheDocument() // PLT0004
    expect(screen.getByText('Em Uso')).toBeInTheDocument() // PLT0001 e PLT0002
  })

  it('Cenário: Usuário encontra e corrige problema de validação', async () => {
    const user = userEvent.setup()
    
    render(<PalletsPage />)
    
    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('PLT0001')).toBeInTheDocument()
    })
    
    // Tentar criar pallet sem preencher campos obrigatórios
    const addButton = screen.getByRole('button', { name: /adicionar pallet/i })
    await user.click(addButton)
    
    // Tentar salvar imediatamente
    const saveButton = screen.getByRole('button', { name: /salvar/i })
    await user.click(saveButton)
    
    // Verificar mensagens de erro
    await waitFor(() => {
      expect(screen.getByText(/tipo é obrigatório/i)).toBeInTheDocument()
    })
    
    // Corrigir preenchendo os campos
    const typeSelect = screen.getByLabelText('Tipo')
    await user.selectOptions(typeSelect, 'PBR')
    
    const materialSelect = screen.getByLabelText('Material')
    await user.selectOptions(materialSelect, 'Madeira')
    
    // Preencher campos numéricos
    await user.type(screen.getByLabelText('Largura (cm)'), '100')
    await user.type(screen.getByLabelText('Comprimento (cm)'), '120')
    await user.type(screen.getByLabelText('Altura (cm)'), '14')
    await user.type(screen.getByLabelText('Peso Máximo (kg)'), '1500')
    
    // Tentar salvar novamente
    await user.click(saveButton)
    
    // Verificar se salvou com sucesso (modal fechou)
    await waitFor(() => {
      expect(screen.queryByText('Adicionar Pallet')).not.toBeInTheDocument()
    })
  })

  it('Cenário: Usuário utiliza diferentes filtros em sequência', async () => {
    const user = userEvent.setup()
    
    render(<PalletsPage />)
    
    // Aguardar carregamento
    await waitFor(() => {
      expect(screen.getByText('PLT0001')).toBeInTheDocument()
    })
    
    // Filtrar por tipo
    const typeFilter = screen.getAllByRole('combobox')[1] // Segundo combobox é tipo
    await user.click(typeFilter)
    
    const pbrOption = screen.getByText('PBR')
    await user.click(pbrOption)
    
    // Verificar filtro aplicado
    const visiblePallets = screen.getAllByText(/PLT\d+/)
    expect(visiblePallets.length).toBeGreaterThan(0)
    
    // Filtrar por material também
    const materialFilter = screen.getAllByRole('combobox')[2] // Terceiro combobox é material
    await user.click(materialFilter)
    
    const madeiraOption = screen.getByText('Madeira')
    await user.click(madeiraOption)
    
    // Combinar com busca de texto
    const searchInput = screen.getByPlaceholderText(/buscar por código, tipo ou material/i)
    await user.type(searchInput, 'PLT0001')
    
    // Deve mostrar resultado muito específico
    expect(screen.getByText('PLT0001')).toBeInTheDocument()
    
    // Limpar todos os filtros
    await user.clear(searchInput)
    
    // Resetar filtros de select
    await user.click(typeFilter)
    const todosTiposOption = screen.getByText('Todos os Tipos')
    await user.click(todosTiposOption)
    
    await user.click(materialFilter)
    const todosMateriaisOption = screen.getByText('Todos os Materiais')
    await user.click(todosMateriaisOption)
    
    // Verificar se todos os pallets voltaram
    await waitFor(() => {
      const allPallets = screen.getAllByText(/PLT\d+/)
      expect(allPallets.length).toBe(3)
    })
  })
}) 