import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Request, Response } from 'express'
import { ProductsController } from '../../../controllers/products.controller'
import { storage } from '../../../storage'

// Mock dependencies
vi.mock('../../../storage')
vi.mock('../../../utils/logger')
vi.mock('../../../config/redis')

describe('ProductsController Unit Tests', () => {
  let controller: ProductsController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  beforeEach(() => {
    controller = new ProductsController()
    
    mockJson = vi.fn()
    mockStatus = vi.fn().mockReturnValue({ json: mockJson, send: vi.fn() })
    
    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: { id: 1, name: 'Test User' }
    } as any
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
      send: vi.fn()
    } as any
    
    vi.clearAllMocks()
  })

  describe('getProducts', () => {
    it('should return products without stock when includeStock is false', async () => {
      const mockProducts = [
        globalThis.testUtils.generateMockProduct(),
        globalThis.testUtils.generateMockProduct()
      ]
      
      vi.mocked(storage.getProducts).mockResolvedValue(mockProducts)
      
      mockRequest.query = { includeStock: 'false' }
      
      await controller.getProducts(mockRequest as Request, mockResponse as Response)
      
      expect(storage.getProducts).toHaveBeenCalledOnce()
      expect(mockJson).toHaveBeenCalledWith(mockProducts)
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it('should return products with stock when includeStock is true', async () => {
      const mockProductsWithStock = [
        { ...globalThis.testUtils.generateMockProduct(), stock: 100 },
        { ...globalThis.testUtils.generateMockProduct(), stock: 50 }
      ]
      
      vi.mocked(storage.getProductsWithStock).mockResolvedValue(mockProductsWithStock)
      
      mockRequest.query = { includeStock: 'true' }
      
      await controller.getProducts(mockRequest as Request, mockResponse as Response)
      
      expect(storage.getProductsWithStock).toHaveBeenCalledWith(undefined)
      expect(mockJson).toHaveBeenCalledWith(mockProductsWithStock)
    })

    it('should filter by id when provided', async () => {
      const productId = 123
      const mockProducts = [globalThis.testUtils.generateMockProduct()]
      
      vi.mocked(storage.getProductsWithStock).mockResolvedValue(mockProducts)
      
      mockRequest.query = { includeStock: 'true', id: productId.toString() }
      
      await controller.getProducts(mockRequest as Request, mockResponse as Response)
      
      expect(storage.getProductsWithStock).toHaveBeenCalledWith(productId)
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Database connection failed')
      vi.mocked(storage.getProducts).mockRejectedValue(error)
      
      await controller.getProducts(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ message: "Failed to fetch products" })
    })
  })

  describe('getProductById', () => {
    it('should return product by id without stock', async () => {
      const productId = 123
      const mockProduct = globalThis.testUtils.generateMockProduct()
      
      vi.mocked(storage.getProduct).mockResolvedValue(mockProduct)
      
      mockRequest.params = { id: productId.toString() }
      mockRequest.query = { includeStock: 'false' }
      
      await controller.getProductById(mockRequest as Request, mockResponse as Response)
      
      expect(storage.getProduct).toHaveBeenCalledWith(productId)
      expect(mockJson).toHaveBeenCalledWith(mockProduct)
    })

    it('should return 404 when product not found', async () => {
      const productId = 999
      
      vi.mocked(storage.getProduct).mockResolvedValue(null)
      
      mockRequest.params = { id: productId.toString() }
      
      await controller.getProductById(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ message: "Product not found" })
    })

    it('should handle invalid id parameter', async () => {
      mockRequest.params = { id: 'invalid' }
      
      await controller.getProductById(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(500)
    })
  })

  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      const productData = {
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        description: 'Test Description',
        weight: 1.5
      }
      
      const createdProduct = { id: 1, ...productData, createdBy: 1 }
      
      vi.mocked(storage.createProduct).mockResolvedValue(createdProduct)
      
      mockRequest.body = productData
      
      await controller.createProduct(mockRequest as Request, mockResponse as Response)
      
      expect(storage.createProduct).toHaveBeenCalledWith({
        ...productData,
        createdBy: 1
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith(createdProduct)
    })

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        // Missing required fields
        name: 'Test Product'
      }
      
      mockRequest.body = invalidData
      
      await controller.createProduct(mockRequest as Request, mockResponse as Response)
      
      expect(storage.createProduct).not.toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(400)
    })

    it('should handle creation errors', async () => {
      const productData = {
        sku: 'DUPLICATE-SKU',
        name: 'Test Product',
        description: 'Test Description'
      }
      
      const error = new Error('Duplicate SKU')
      vi.mocked(storage.createProduct).mockRejectedValue(error)
      
      mockRequest.body = productData
      
      await controller.createProduct(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ message: "Failed to create product" })
    })
  })

  describe('updateProduct', () => {
    it('should update product with valid data', async () => {
      const productId = 123
      const updateData = { name: 'Updated Product Name' }
      const updatedProduct = { id: productId, ...updateData }
      
      vi.mocked(storage.updateProduct).mockResolvedValue(updatedProduct)
      
      mockRequest.params = { id: productId.toString() }
      mockRequest.body = updateData
      
      await controller.updateProduct(mockRequest as Request, mockResponse as Response)
      
      expect(storage.updateProduct).toHaveBeenCalledWith(productId, updateData)
      expect(mockJson).toHaveBeenCalledWith(updatedProduct)
    })

    it('should return 404 when product not found for update', async () => {
      const productId = 999
      const updateData = { name: 'Updated Name' }
      
      vi.mocked(storage.updateProduct).mockResolvedValue(null)
      
      mockRequest.params = { id: productId.toString() }
      mockRequest.body = updateData
      
      await controller.updateProduct(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ message: "Product not found" })
    })
  })

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const productId = 123
      
      vi.mocked(storage.deleteProduct).mockResolvedValue(true)
      
      mockRequest.params = { id: productId.toString() }
      
      await controller.deleteProduct(mockRequest as Request, mockResponse as Response)
      
      expect(storage.deleteProduct).toHaveBeenCalledWith(productId)
      expect(mockStatus).toHaveBeenCalledWith(204)
    })

    it('should return 404 when product not found for deletion', async () => {
      const productId = 999
      
      vi.mocked(storage.deleteProduct).mockResolvedValue(false)
      
      mockRequest.params = { id: productId.toString() }
      
      await controller.deleteProduct(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ message: "Product not found" })
    })
  })

  describe('Photo Management', () => {
    describe('getProductPhotos', () => {
      it('should return paginated photos', async () => {
        const productId = 123
        const mockPhotoResult = {
          photos: [
            { id: 1, filename: 'photo1.jpg', url: '/photos/photo1.jpg' },
            { id: 2, filename: 'photo2.jpg', url: '/photos/photo2.jpg' }
          ],
          page: 1,
          limit: 20,
          total: 2,
          hasMore: false
        }
        
        vi.mocked(storage.getProductPhotos).mockResolvedValue(mockPhotoResult)
        
        mockRequest.params = { id: productId.toString() }
        mockRequest.query = { page: '1', limit: '20' }
        
        await controller.getProductPhotos(mockRequest as Request, mockResponse as Response)
        
        expect(storage.getProductPhotos).toHaveBeenCalledWith(productId, {
          page: 1,
          limit: 20,
          onlyPrimary: false
        })
        expect(mockJson).toHaveBeenCalledWith({
          photos: mockPhotoResult.photos,
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            hasMore: false,
            totalPages: 1
          }
        })
      })

      it('should validate pagination parameters', async () => {
        const productId = 123
        
        mockRequest.params = { id: productId.toString() }
        mockRequest.query = { page: '0', limit: '200' } // Invalid parameters
        
        await controller.getProductPhotos(mockRequest as Request, mockResponse as Response)
        
        expect(mockStatus).toHaveBeenCalledWith(400)
        expect(mockJson).toHaveBeenCalledWith({ 
          error: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100' 
        })
      })

      it('should return only primary photo when requested', async () => {
        const productId = 123
        const mockPhotoResult = {
          photos: [
            { id: 1, filename: 'primary.jpg', url: '/photos/primary.jpg', isPrimary: true }
          ],
          page: 1,
          limit: 20,
          total: 1,
          hasMore: false
        }
        
        vi.mocked(storage.getProductPhotos).mockResolvedValue(mockPhotoResult)
        
        mockRequest.params = { id: productId.toString() }
        mockRequest.query = { primary: 'true' }
        
        await controller.getProductPhotos(mockRequest as Request, mockResponse as Response)
        
        expect(storage.getProductPhotos).toHaveBeenCalledWith(productId, {
          page: 1,
          limit: 20,
          onlyPrimary: true
        })
      })
    })

    describe('addProductPhoto', () => {
      it('should add photo successfully', async () => {
        const productId = 123
        const photoData = {
          filename: 'new-photo.jpg',
          url: '/photos/new-photo.jpg',
          isPrimary: false
        }
        
        const addedPhoto = { id: 1, ...photoData, productId, uploadedBy: 1 }
        
        vi.mocked(storage.addProductPhoto).mockResolvedValue(addedPhoto)
        
        mockRequest.params = { id: productId.toString() }
        mockRequest.body = photoData
        
        await controller.addProductPhoto(mockRequest as Request, mockResponse as Response)
        
        expect(storage.addProductPhoto).toHaveBeenCalledWith({
          ...photoData,
          productId,
          uploadedBy: 1
        }, 1)
        expect(mockStatus).toHaveBeenCalledWith(201)
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          message: "Photo uploaded successfully",
          photo: addedPhoto
        })
      })
      
      it('should handle photo upload errors', async () => {
        const productId = 123
        const photoData = { filename: 'test.jpg' }
        
        const error = new Error('Upload failed')
        vi.mocked(storage.addProductPhoto).mockRejectedValue(error)
        
        mockRequest.params = { id: productId.toString() }
        mockRequest.body = photoData
        
        await controller.addProductPhoto(mockRequest as Request, mockResponse as Response)
        
        expect(mockStatus).toHaveBeenCalledWith(500)
        expect(mockJson).toHaveBeenCalledWith({ 
          message: "Failed to add product photo",
          detail: "Upload failed"
        })
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing user in request', async () => {
      mockRequest.user = undefined
      
      await controller.getProducts(mockRequest as Request, mockResponse as Response)
      
      // Should still work but log with undefined user
      expect(storage.getProducts).toHaveBeenCalled()
    })

    it('should handle non-numeric id parameters', async () => {
      mockRequest.params = { id: 'not-a-number' }
      
      await controller.getProductById(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(500)
    })

    it('should handle database timeout errors', async () => {
      const timeoutError = new Error('Connection timeout')
      timeoutError.name = 'TimeoutError'
      
      vi.mocked(storage.getProducts).mockRejectedValue(timeoutError)
      
      await controller.getProducts(mockRequest as Request, mockResponse as Response)
      
      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ message: "Failed to fetch products" })
    })
  })
})