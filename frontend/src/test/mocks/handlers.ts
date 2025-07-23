import { http, HttpResponse } from 'msw'
import { Pallet } from '@/types/api'

// Dados mock para pallets
const mockPallets: Pallet[] = [
  {
    id: 1,
    code: 'PLT0001',
    type: 'PBR',
    material: 'Madeira',
    width: 100,
    length: 120,
    height: 14,
    maxWeight: '1500.00',
    status: 'disponivel',
    photoUrl: null,
    observations: 'Pallet em bom estado',
    lastInspectionDate: null,
    createdBy: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    code: 'PLT0002',
    type: 'Europeu',
    material: 'Madeira',
    width: 80,
    length: 120,
    height: 14,
    maxWeight: '1000.00',
    status: 'em_uso',
    photoUrl: null,
    observations: null,
    lastInspectionDate: null,
    createdBy: 1,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 3,
    code: 'PLT0003',
    type: 'PBR',
    material: 'Plástico',
    width: 100,
    length: 120,
    height: 14,
    maxWeight: '1200.00',
    status: 'defeituoso',
    photoUrl: null,
    observations: 'Necessita reparo',
    lastInspectionDate: new Date('2024-01-15'),
    createdBy: 1,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-15'),
  }
]

export const handlers = [
  // GET /api/pallets - Listar pallets
  http.get('/api/pallets', () => {
    return HttpResponse.json(mockPallets)
  }),

  // GET /api/pallets/:id - Buscar pallet por ID
  http.get('/api/pallets/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    const pallet = mockPallets.find(p => p.id === id)
    
    if (!pallet) {
      return new HttpResponse('Pallet não encontrado', { status: 404 })
    }
    
    return HttpResponse.json(pallet)
  }),

  // GET /api/pallets/code/:code - Buscar pallet por código
  http.get('/api/pallets/code/:code', ({ params }) => {
    const code = params.code as string
    const pallet = mockPallets.find(p => p.code === code)
    
    if (!pallet) {
      return new HttpResponse('Pallet não encontrado', { status: 404 })
    }
    
    return HttpResponse.json(pallet)
  }),

  // GET /api/pallets/next-code - Próximo código disponível
  http.get('/api/pallets/next-code', () => {
    const nextCode = `PLT${(mockPallets.length + 1).toString().padStart(4, '0')}`
    return HttpResponse.json({ code: nextCode })
  }),

  // GET /api/pallets/available-for-ucp - Pallets disponíveis para UCP
  http.get('/api/pallets/available-for-ucp', () => {
    const availablePallets = mockPallets.filter(p => p.status === 'disponivel')
    return HttpResponse.json(availablePallets)
  }),

  // POST /api/pallets - Criar novo pallet
  http.post('/api/pallets', async ({ request }) => {
    const body = await request.json() as any
    const newPallet: Pallet = {
      id: mockPallets.length + 1,
      code: body.code || `PLT${(mockPallets.length + 1).toString().padStart(4, '0')}`,
      type: body.type,
      material: body.material,
      width: body.width,
      length: body.length,
      height: body.height,
      maxWeight: body.maxWeight,
      status: body.status || 'disponivel',
      photoUrl: body.photoUrl || null,
      observations: body.observations || null,
      lastInspectionDate: body.lastInspectionDate ? new Date(body.lastInspectionDate) : null,
      createdBy: body.createdBy || 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    mockPallets.push(newPallet)
    return HttpResponse.json(newPallet, { status: 201 })
  }),

  // PUT /api/pallets/:id - Atualizar pallet
  http.put('/api/pallets/:id', async ({ params, request }) => {
    const id = parseInt(params.id as string)
    const body = await request.json() as any
    const palletIndex = mockPallets.findIndex(p => p.id === id)
    
    if (palletIndex === -1) {
      return new HttpResponse('Pallet não encontrado', { status: 404 })
    }
    
    const updatedPallet = {
      ...mockPallets[palletIndex],
      ...body,
      updatedAt: new Date(),
    }
    
    mockPallets[palletIndex] = updatedPallet
    return HttpResponse.json(updatedPallet)
  }),

  // DELETE /api/pallets/:id - Deletar pallet
  http.delete('/api/pallets/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    const palletIndex = mockPallets.findIndex(p => p.id === id)
    
    if (palletIndex === -1) {
      return new HttpResponse('Pallet não encontrado', { status: 404 })
    }
    
    mockPallets.splice(palletIndex, 1)
    return new HttpResponse(null, { status: 204 })
  }),
] 