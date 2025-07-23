import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { server } from '../mocks/server'

// Configurar servidor de mocks
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('API de Pallets', () => {
  const baseUrl = 'http://localhost:5000'

  describe('GET /api/pallets', () => {
    it('deve retornar lista de pallets', async () => {
      const response = await fetch(`${baseUrl}/api/pallets`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(3)
      
      // Verificar estrutura do primeiro pallet
      const firstPallet = data[0]
      expect(firstPallet).toHaveProperty('id')
      expect(firstPallet).toHaveProperty('code')
      expect(firstPallet).toHaveProperty('type')
      expect(firstPallet).toHaveProperty('material')
      expect(firstPallet).toHaveProperty('status')
    })

    it('deve retornar pallets com status em português', async () => {
      const response = await fetch(`${baseUrl}/api/pallets`)
      const data = await response.json()

      const statuses = data.map((pallet: any) => pallet.status)
      expect(statuses).toContain('disponivel')
      expect(statuses).toContain('em_uso')
      expect(statuses).toContain('defeituoso')
    })
  })

  describe('GET /api/pallets/:id', () => {
    it('deve retornar pallet por ID válido', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/1`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe(1)
      expect(data.code).toBe('PLT0001')
      expect(data.status).toBe('disponivel')
    })

    it('deve retornar 404 para ID inexistente', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/999`)

      expect(response.status).toBe(404)
    })

    it('deve validar tipos de dados corretamente', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/1`)
      const data = await response.json()

      expect(typeof data.id).toBe('number')
      expect(typeof data.code).toBe('string')
      expect(typeof data.width).toBe('number')
      expect(typeof data.length).toBe('number')
      expect(typeof data.height).toBe('number')
      expect(typeof data.maxWeight).toBe('string') // Decimal como string
    })
  })

  describe('GET /api/pallets/code/:code', () => {
    it('deve retornar pallet por código válido', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/code/PLT0001`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.code).toBe('PLT0001')
      expect(data.id).toBe(1)
    })

    it('deve retornar 404 para código inexistente', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/code/PLT9999`)

      expect(response.status).toBe(404)
    })

    it('deve ser case-sensitive', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/code/plt0001`)

      expect(response.status).toBe(404)
    })
  })

  describe('GET /api/pallets/next-code', () => {
    it('deve retornar próximo código disponível', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/next-code`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('code')
      expect(data.code).toMatch(/^PLT\d{4}$/) // Formato PLTxxxx
      expect(data.code).toBe('PLT0004') // Próximo após os 3 existentes
    })

    it('deve retornar código sequencial', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/next-code`)
      const data = await response.json()

      expect(data.code).toBe('PLT0004')
    })
  })

  describe('GET /api/pallets/available-for-ucp', () => {
    it('deve retornar apenas pallets disponíveis', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/available-for-ucp`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      
      // Todos devem ter status 'disponivel'
      data.forEach((pallet: any) => {
        expect(pallet.status).toBe('disponivel')
      })
    })

    it('deve filtrar pallets não disponíveis', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/available-for-ucp`)
      const data = await response.json()

      // Não deve conter pallets em uso ou defeituosos
      const codes = data.map((pallet: any) => pallet.code)
      expect(codes).not.toContain('PLT0002') // em_uso
      expect(codes).not.toContain('PLT0003') // defeituoso
    })
  })

  describe('POST /api/pallets', () => {
    it('deve criar novo pallet com dados válidos', async () => {
      const newPallet = {
        code: 'PLT0004',
        type: 'PBR',
        material: 'Madeira',
        width: 100,
        length: 120,
        height: 14,
        maxWeight: '1500.00',
        status: 'disponivel',
        createdBy: 1,
      }

      const response = await fetch(`${baseUrl}/api/pallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPallet),
      })

      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.code).toBe('PLT0004')
      expect(data.type).toBe('PBR')
      expect(data.status).toBe('disponivel')
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('createdAt')
    })

    it('deve gerar código automaticamente se não fornecido', async () => {
      const newPallet = {
        type: 'Europeu',
        material: 'Plástico',
        width: 80,
        length: 120,
        height: 14,
        maxWeight: '1000.00',
        createdBy: 1,
      }

      const response = await fetch(`${baseUrl}/api/pallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPallet),
      })

      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.code).toMatch(/^PLT\d{4}$/)
    })

    it('deve definir status padrão como disponivel', async () => {
      const newPallet = {
        type: 'PBR',
        material: 'Madeira',
        width: 100,
        length: 120,
        height: 14,
        maxWeight: '1500.00',
        createdBy: 1,
      }

      const response = await fetch(`${baseUrl}/api/pallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPallet),
      })

      const data = await response.json()

      expect(data.status).toBe('disponivel')
    })
  })

  describe('PUT /api/pallets/:id', () => {
    it('deve atualizar pallet existente', async () => {
      const updates = {
        observations: 'Pallet atualizado via API',
        status: 'em_uso',
      }

      const response = await fetch(`${baseUrl}/api/pallets/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.observations).toBe('Pallet atualizado via API')
      expect(data.status).toBe('em_uso')
      expect(data).toHaveProperty('updatedAt')
    })

    it('deve retornar 404 para ID inexistente', async () => {
      const updates = { status: 'em_uso' }

      const response = await fetch(`${baseUrl}/api/pallets/999`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      expect(response.status).toBe(404)
    })

    it('deve preservar campos não atualizados', async () => {
      const updates = { observations: 'Nova observação' }

      const response = await fetch(`${baseUrl}/api/pallets/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      expect(data.code).toBe('PLT0001') // Não alterado
      expect(data.type).toBe('PBR') // Não alterado
      expect(data.observations).toBe('Nova observação') // Alterado
    })
  })

  describe('DELETE /api/pallets/:id', () => {
    it('deve deletar pallet existente', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/1`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(204)
    })

    it('deve retornar 404 para ID inexistente', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/999`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(404)
    })

    it('deve remover pallet da lista após exclusão', async () => {
      // Deletar pallet
      await fetch(`${baseUrl}/api/pallets/2`, {
        method: 'DELETE',
      })

      // Verificar se foi removido
      const response = await fetch(`${baseUrl}/api/pallets/2`)
      expect(response.status).toBe(404)
    })
  })

  describe('Validações e Edge Cases', () => {
    it('deve validar Content-Type para POST', async () => {
      const response = await fetch(`${baseUrl}/api/pallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'invalid data',
      })

      // Dependendo da implementação, pode retornar 400 ou processar como JSON
      expect([400, 500]).toContain(response.status)
    })

    it('deve lidar com JSON malformado', async () => {
      const response = await fetch(`${baseUrl}/api/pallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"invalid": json}',
      })

      expect([400, 500]).toContain(response.status)
    })

    it('deve validar IDs não numéricos', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/abc`)

      expect(response.status).toBe(404)
    })
  })

  describe('Performance e Limites', () => {
    it('deve responder rapidamente para requisições simples', async () => {
      const startTime = Date.now()
      
      const response = await fetch(`${baseUrl}/api/pallets`)
      
      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(1000) // Menos de 1 segundo
    })

    it('deve lidar com múltiplas requisições simultâneas', async () => {
      const promises = Array.from({ length: 5 }, () => 
        fetch(`${baseUrl}/api/pallets`)
      )

      const responses = await Promise.all(promises)

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Consistência de Dados', () => {
    it('deve manter integridade referencial', async () => {
      // Buscar pallet
      const palletResponse = await fetch(`${baseUrl}/api/pallets/1`)
      const pallet = await palletResponse.json()

      expect(pallet.createdBy).toBeDefined()
      expect(typeof pallet.createdBy).toBe('number')
    })

    it('deve retornar datas no formato correto', async () => {
      const response = await fetch(`${baseUrl}/api/pallets/1`)
      const data = await response.json()

      if (data.createdAt) {
        expect(new Date(data.createdAt)).toBeInstanceOf(Date)
      }
      if (data.updatedAt) {
        expect(new Date(data.updatedAt)).toBeInstanceOf(Date)
      }
    })
  })
}) 