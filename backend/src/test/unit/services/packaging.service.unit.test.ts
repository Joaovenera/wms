import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PackagingService } from '../../../services/packaging.service'
import { db } from '../../../db'

// Mock database
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

describe('PackagingService Unit Tests', () => {
  let service: PackagingService
  let mockSelect: ReturnType<typeof vi.fn>
  let mockFrom: ReturnType<typeof vi.fn>
  let mockWhere: ReturnType<typeof vi.fn>
  let mockOrderBy: ReturnType<typeof vi.fn>
  let mockLimit: ReturnType<typeof vi.fn>
  let mockGroupBy: ReturnType<typeof vi.fn>
  let mockLeftJoin: ReturnType<typeof vi.fn>

  beforeEach(() => {
    service = new PackagingService()
    
    // Setup fluent query mocks
    mockLimit = vi.fn().mockResolvedValue([])
    mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit })
    mockGroupBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    mockLeftJoin = vi.fn().mockReturnValue({ 
      where: vi.fn().mockReturnValue({ 
        groupBy: mockGroupBy, 
        orderBy: mockOrderBy 
      }) 
    })
    mockWhere = vi.fn().mockReturnValue({ 
      orderBy: mockOrderBy, 
      limit: mockLimit,
      groupBy: mockGroupBy
    })
    mockFrom = vi.fn().mockReturnValue({ 
      where: mockWhere,
      leftJoin: mockLeftJoin,
      orderBy: mockOrderBy,
      limit: mockLimit
    })
    mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
    
    vi.mocked(db.select).mockImplementation(mockSelect)
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([])
      })
    })
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([])
        })
      })
    })
    
    vi.clearAllMocks()
  })

  describe('getPackagingsByProduct', () => {
    it('should return packagings ordered by level', async () => {
      const productId = 1
      const mockPackagings = [
        {
          id: 1,
          productId,
          name: 'Unit',
          level: 0,
          baseUnitQuantity: 1,
          isBaseUnit: true,
          isActive: true
        },
        {
          id: 2,
          productId,
          name: 'Box',
          level: 1,
          baseUnitQuantity: 12,
          isBaseUnit: false,
          isActive: true
        }
      ]
      
      mockLimit.mockResolvedValue(mockPackagings)
      
      const result = await service.getPackagingsByProduct(productId)
      
      expect(db.select).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalled()
      expect(mockWhere).toHaveBeenCalled()
      expect(mockOrderBy).toHaveBeenCalled()
      expect(result).toEqual(mockPackagings)
    })

    it('should filter only active packagings', async () => {
      const productId = 1
      
      await service.getPackagingsByProduct(productId)
      
      expect(mockWhere).toHaveBeenCalled()
      // Verify that the where clause includes isActive: true filter
    })
  })

  describe('getPackagingByBarcode', () => {
    it('should return packaging by barcode', async () => {
      const barcode = 'TEST123456'
      const mockPackaging = {
        id: 1,
        barcode,
        name: 'Test Package',
        isActive: true
      }
      
      mockLimit.mockResolvedValue([mockPackaging])
      
      const result = await service.getPackagingByBarcode(barcode)
      
      expect(result).toEqual(mockPackaging)
    })

    it('should throw error when packaging not found', async () => {
      const barcode = 'NOTFOUND'
      
      mockLimit.mockResolvedValue([])
      
      await expect(service.getPackagingByBarcode(barcode))
        .rejects.toThrow(`Embalagem não encontrada para o código de barras: ${barcode}`)
    })
  })

  describe('getBasePackaging', () => {
    it('should return base packaging for product', async () => {
      const productId = 1
      const mockBasePackaging = {
        id: 1,
        productId,
        name: 'Base Unit',
        isBaseUnit: true,
        baseUnitQuantity: 1,
        isActive: true
      }
      
      mockLimit.mockResolvedValue([mockBasePackaging])
      
      const result = await service.getBasePackaging(productId)
      
      expect(result).toEqual(mockBasePackaging)
    })

    it('should throw error when base packaging not found', async () => {
      const productId = 999
      
      mockLimit.mockResolvedValue([])
      
      await expect(service.getBasePackaging(productId))
        .rejects.toThrow(`Embalagem base não encontrada para o produto: ${productId}`)
    })
  })

  describe('convertToBaseUnits', () => {
    it('should convert quantity to base units', async () => {
      const quantity = 5
      const packagingTypeId = 2
      const baseUnitQuantity = 12
      
      mockLimit.mockResolvedValue([{ baseUnitQuantity }])
      
      const result = await service.convertToBaseUnits(quantity, packagingTypeId)
      
      expect(result).toBe(60) // 5 * 12 = 60
    })

    it('should throw error for invalid packaging type', async () => {
      const quantity = 5
      const packagingTypeId = 999
      
      mockLimit.mockResolvedValue([])
      
      await expect(service.convertToBaseUnits(quantity, packagingTypeId))
        .rejects.toThrow(`Tipo de embalagem não encontrado: ${packagingTypeId}`)
    })

    it('should handle decimal quantities correctly', async () => {
      const quantity = 2.5
      const packagingTypeId = 1
      const baseUnitQuantity = 4
      
      mockLimit.mockResolvedValue([{ baseUnitQuantity }])
      
      const result = await service.convertToBaseUnits(quantity, packagingTypeId)
      
      expect(result).toBe(10) // 2.5 * 4 = 10
    })
  })

  describe('convertFromBaseUnits', () => {
    it('should convert from base units to target packaging', async () => {
      const baseQuantity = 60
      const targetPackagingId = 2
      const baseUnitQuantity = 12
      
      mockLimit.mockResolvedValue([{ baseUnitQuantity }])
      
      const result = await service.convertFromBaseUnits(baseQuantity, targetPackagingId)
      
      expect(result).toBe(5) // 60 / 12 = 5
    })

    it('should handle partial quantities', async () => {
      const baseQuantity = 25
      const targetPackagingId = 2
      const baseUnitQuantity = 12
      
      mockLimit.mockResolvedValue([{ baseUnitQuantity }])
      
      const result = await service.convertFromBaseUnits(baseQuantity, targetPackagingId)
      
      expect(result).toBeCloseTo(2.083, 3) // 25 / 12 ≈ 2.083
    })
  })

  describe('createPackaging', () => {
    it('should create new packaging successfully', async () => {
      const packageData = {
        productId: 1,
        name: 'Case',
        level: 2,
        baseUnitQuantity: 24,
        isBaseUnit: false,
        isActive: true,
        barcode: 'CASE123'
      }
      
      const createdPackaging = { id: 3, ...packageData }
      
      // Mock no existing base unit
      mockLimit.mockResolvedValueOnce([])
      // Mock no existing barcode
      mockLimit.mockResolvedValueOnce([])
      
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdPackaging])
        })
      } as any)
      
      const result = await service.createPackaging(packageData)
      
      expect(result).toEqual(createdPackaging)
    })

    it('should prevent duplicate base unit creation', async () => {
      const packageData = {
        productId: 1,
        name: 'Base',
        isBaseUnit: true,
        baseUnitQuantity: 1
      }
      
      // Mock existing base unit
      mockLimit.mockResolvedValue([{ id: 1, isBaseUnit: true }])
      
      await expect(service.createPackaging(packageData))
        .rejects.toThrow('Já existe uma embalagem base para este produto')
    })

    it('should prevent duplicate barcode creation', async () => {
      const packageData = {
        productId: 1,
        name: 'Test',
        barcode: 'DUPLICATE123'
      }
      
      // Mock no existing base unit
      mockLimit.mockResolvedValueOnce([])
      // Mock existing barcode
      mockLimit.mockResolvedValueOnce([{ id: 2, barcode: 'DUPLICATE123' }])
      
      await expect(service.createPackaging(packageData))
        .rejects.toThrow('Código de barras já existe em outra embalagem')
    })
  })

  describe('optimizePickingByPackaging', () => {
    it('should optimize picking using largest packages first', async () => {
      const productId = 1
      const requestedBaseUnits = 250
      
      const mockPackagings = [
        { id: 1, baseUnitQuantity: 1, level: 0 },   // Unit
        { id: 2, baseUnitQuantity: 12, level: 1 },  // Box
        { id: 3, baseUnitQuantity: 144, level: 2 }  // Case (12 boxes)
      ]
      
      const mockStock = [
        { packagingId: 1, availablePackages: 1000 },
        { packagingId: 2, availablePackages: 20 },
        { packagingId: 3, availablePackages: 2 }
      ]
      
      // Mock packaging query
      mockLimit.mockResolvedValueOnce(mockPackagings)
      // Mock stock query  
      mockOrderBy.mockResolvedValueOnce(mockStock)
      
      const result = await service.optimizePickingByPackaging(productId, requestedBaseUnits)
      
      expect(result.canFulfill).toBe(true)
      expect(result.remaining).toBe(0)
      expect(result.totalPlanned).toBe(250)
      
      // Should use: 1 case (144) + 8 boxes (96) + 10 units (10) = 250
      expect(result.pickingPlan).toHaveLength(3)
      expect(result.pickingPlan[0].baseUnits).toBe(144) // 1 case
      expect(result.pickingPlan[1].baseUnits).toBe(96)  // 8 boxes
      expect(result.pickingPlan[2].baseUnits).toBe(10)  // 10 units
    })

    it('should handle insufficient stock', async () => {
      const productId = 1
      const requestedBaseUnits = 1000
      
      const mockPackagings = [
        { id: 1, baseUnitQuantity: 1, level: 0 },
        { id: 2, baseUnitQuantity: 12, level: 1 }
      ]
      
      const mockStock = [
        { packagingId: 1, availablePackages: 50 },
        { packagingId: 2, availablePackages: 5 }
      ]
      
      mockLimit.mockResolvedValueOnce(mockPackagings)
      mockOrderBy.mockResolvedValueOnce(mockStock)
      
      const result = await service.optimizePickingByPackaging(productId, requestedBaseUnits)
      
      expect(result.canFulfill).toBe(false)
      expect(result.remaining).toBeGreaterThan(0)
      expect(result.totalPlanned).toBe(110) // 5*12 + 50*1 = 110
    })
  })

  describe('calculateConversionFactor', () => {
    it('should calculate conversion factor between packagings', async () => {
      const fromPackagingId = 1 // Unit (1)
      const toPackagingId = 2   // Box (12)
      
      mockLimit.mockResolvedValue([{
        fromBaseQty: 1,
        toBaseQty: 12
      }])
      
      const result = await service.calculateConversionFactor(fromPackagingId, toPackagingId)
      
      expect(result).toBeCloseTo(0.0833, 4) // 1/12 ≈ 0.0833
    })

    it('should handle reverse conversion', async () => {
      const fromPackagingId = 2 // Box (12)
      const toPackagingId = 1   // Unit (1)
      
      mockLimit.mockResolvedValue([{
        fromBaseQty: 12,
        toBaseQty: 1
      }])
      
      const result = await service.calculateConversionFactor(fromPackagingId, toPackagingId)
      
      expect(result).toBe(12) // 12/1 = 12
    })

    it('should throw error for invalid packaging IDs', async () => {
      const fromPackagingId = 999
      const toPackagingId = 1
      
      mockLimit.mockResolvedValue([])
      
      await expect(service.calculateConversionFactor(fromPackagingId, toPackagingId))
        .rejects.toThrow(`Embalagem de origem não encontrada: ${fromPackagingId}`)
    })
  })

  describe('getPackagingHierarchy', () => {
    it('should build hierarchical structure correctly', async () => {
      const productId = 1
      const mockPackagings = [
        { id: 1, parentPackagingId: null, name: 'Pallet', level: 3 },
        { id: 2, parentPackagingId: 1, name: 'Case', level: 2 },
        { id: 3, parentPackagingId: 2, name: 'Box', level: 1 },
        { id: 4, parentPackagingId: 3, name: 'Unit', level: 0 }
      ]
      
      mockLimit.mockResolvedValue(mockPackagings)
      
      const result = await service.getPackagingHierarchy(productId)
      
      expect(result).toHaveLength(1) // One root (Pallet)
      expect(result[0].name).toBe('Pallet')
      expect(result[0].children).toHaveLength(1) // One child (Case)
      expect(result[0].children[0].name).toBe('Case')
      expect(result[0].children[0].children[0].name).toBe('Box')
      expect(result[0].children[0].children[0].children[0].name).toBe('Unit')
    })

    it('should handle multiple root packagings', async () => {
      const productId = 1
      const mockPackagings = [
        { id: 1, parentPackagingId: null, name: 'Pallet A', level: 2 },
        { id: 2, parentPackagingId: null, name: 'Pallet B', level: 2 },
        { id: 3, parentPackagingId: 1, name: 'Box A', level: 1 }
      ]
      
      mockLimit.mockResolvedValue(mockPackagings)
      
      const result = await service.getPackagingHierarchy(productId)
      
      expect(result).toHaveLength(2) // Two roots
      expect(result.find(p => p.name === 'Pallet A')).toBeDefined()
      expect(result.find(p => p.name === 'Pallet B')).toBeDefined()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors', async () => {
      const error = new Error('Database connection failed')
      mockLimit.mockRejectedValue(error)
      
      await expect(service.getPackagingsByProduct(1))
        .rejects.toThrow('Database connection failed')
    })

    it('should handle zero base unit quantities', async () => {
      const quantity = 10
      const packagingTypeId = 1
      
      mockLimit.mockResolvedValue([{ baseUnitQuantity: 0 }])
      
      const result = await service.convertToBaseUnits(quantity, packagingTypeId)
      
      expect(result).toBe(0)
    })

    it('should handle negative quantities gracefully', async () => {
      const productId = 1
      const requestedBaseUnits = -100
      
      const mockPackagings = [
        { id: 1, baseUnitQuantity: 1, level: 0 }
      ]
      
      const mockStock = [
        { packagingId: 1, availablePackages: 50 }
      ]
      
      mockLimit.mockResolvedValueOnce(mockPackagings)
      mockOrderBy.mockResolvedValueOnce(mockStock)
      
      const result = await service.optimizePickingByPackaging(productId, requestedBaseUnits)
      
      expect(result.pickingPlan).toHaveLength(0)
      expect(result.canFulfill).toBe(true)
      expect(result.remaining).toBe(-100)
    })
  })
})