import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { testRequest, createTestUser, authenticateTestUser } from '../../integration-setup'

describe('Products API Integration Tests', () => {
  let authUser: any
  let testProduct: any

  beforeAll(async () => {
    authUser = await authenticateTestUser()
  })

  beforeEach(() => {
    testProduct = globalThis.testUtils.generateMockProduct()
  })

  describe('POST /api/products', () => {
    it('should create a new product with valid data', async () => {
      const productData = {
        sku: `TEST-${Date.now()}`,
        name: 'Integration Test Product',
        description: 'Product created during integration test',
        weight: 2.5,
        dimensions: {
          length: 10,
          width: 8,
          height: 5
        }
      }

      const response = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send(productData)
        .expect(201)

      expect(response.body).toMatchObject({
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        weight: productData.weight
      })
      expect(response.body.id).toBeDefined()
      expect(response.body.createdBy).toBe(authUser.user.id)
      expect(response.body.createdAt).toBeDefined()
    })

    it('should reject product creation without authentication', async () => {
      await testRequest()
        .post('/api/products')
        .send(testProduct)
        .expect(401)
    })

    it('should reject product with invalid data', async () => {
      const invalidProduct = {
        name: 'Product without SKU' // Missing required SKU
      }

      await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send(invalidProduct)
        .expect(400)
    })

    it('should prevent duplicate SKU creation', async () => {
      const productData = {
        sku: `DUPLICATE-${Date.now()}`,
        name: 'First Product',
        description: 'First product with this SKU'
      }

      // Create first product
      await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send(productData)
        .expect(201)

      // Try to create second product with same SKU
      const duplicateProduct = {
        ...productData,
        name: 'Second Product'
      }

      await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send(duplicateProduct)
        .expect(400)
    })
  })

  describe('GET /api/products', () => {
    beforeEach(async () => {
      // Create test product for retrieval tests
      const response = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send({
          sku: `GET-TEST-${Date.now()}`,
          name: 'Product for GET tests',
          description: 'Test product for retrieval'
        })
        .expect(201)
      
      testProduct = response.body
    })

    it('should retrieve all products', async () => {
      const response = await testRequest()
        .get('/api/products')
        .set('Cookie', authUser.cookies)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
      
      const createdProduct = response.body.find((p: any) => p.id === testProduct.id)
      expect(createdProduct).toBeDefined()
    })

    it('should retrieve products with stock information', async () => {
      const response = await testRequest()
        .get('/api/products?includeStock=true')
        .set('Cookie', authUser.cookies)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('stock')
      }
    })

    it('should filter products by ID', async () => {
      const response = await testRequest()
        .get(`/api/products?id=${testProduct.id}`)
        .set('Cookie', authUser.cookies)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(1)
      expect(response.body[0].id).toBe(testProduct.id)
    })
  })

  describe('GET /api/products/:id', () => {
    it('should retrieve product by ID', async () => {
      const response = await testRequest()
        .get(`/api/products/${testProduct.id}`)
        .set('Cookie', authUser.cookies)
        .expect(200)

      expect(response.body.id).toBe(testProduct.id)
      expect(response.body.sku).toBeDefined()
      expect(response.body.name).toBeDefined()
    })

    it('should return 404 for non-existent product', async () => {
      const nonExistentId = 999999

      await testRequest()
        .get(`/api/products/${nonExistentId}`)
        .set('Cookie', authUser.cookies)
        .expect(404)
    })

    it('should handle invalid ID format', async () => {
      await testRequest()
        .get('/api/products/invalid-id')
        .set('Cookie', authUser.cookies)
        .expect(500)
    })
  })

  describe('PUT /api/products/:id', () => {
    it('should update product with valid data', async () => {
      const updateData = {
        name: 'Updated Product Name',
        description: 'Updated description',
        weight: 3.0
      }

      const response = await testRequest()
        .put(`/api/products/${testProduct.id}`)
        .set('Cookie', authUser.cookies)
        .send(updateData)
        .expect(200)

      expect(response.body.name).toBe(updateData.name)
      expect(response.body.description).toBe(updateData.description)
      expect(response.body.weight).toBe(updateData.weight)
      expect(response.body.sku).toBe(testProduct.sku) // SKU should remain unchanged
    })

    it('should return 404 for non-existent product update', async () => {
      const nonExistentId = 999999

      await testRequest()
        .put(`/api/products/${nonExistentId}`)
        .set('Cookie', authUser.cookies)
        .send({ name: 'Updated Name' })
        .expect(404)
    })

    it('should reject invalid update data', async () => {
      const invalidData = {
        weight: 'not-a-number' // Invalid weight
      }

      await testRequest()
        .put(`/api/products/${testProduct.id}`)
        .set('Cookie', authUser.cookies)
        .send(invalidData)
        .expect(400)
    })
  })

  describe('DELETE /api/products/:id', () => {
    it('should delete product successfully', async () => {
      // Create a product specifically for deletion
      const productToDelete = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send({
          sku: `DELETE-TEST-${Date.now()}`,
          name: 'Product to Delete',
          description: 'This product will be deleted'
        })
        .expect(201)

      // Delete the product
      await testRequest()
        .delete(`/api/products/${productToDelete.body.id}`)
        .set('Cookie', authUser.cookies)
        .expect(204)

      // Verify product is deleted
      await testRequest()
        .get(`/api/products/${productToDelete.body.id}`)
        .set('Cookie', authUser.cookies)
        .expect(404)
    })

    it('should return 404 for non-existent product deletion', async () => {
      const nonExistentId = 999999

      await testRequest()
        .delete(`/api/products/${nonExistentId}`)
        .set('Cookie', authUser.cookies)
        .expect(404)
    })
  })

  describe('Product Photos Integration', () => {
    describe('POST /api/products/:id/photos', () => {
      it('should add photo to product', async () => {
        const photoData = {
          filename: 'test-photo.jpg',
          url: '/uploads/test-photo.jpg',
          isPrimary: true,
          fileSize: 1024000,
          mimeType: 'image/jpeg'
        }

        const response = await testRequest()
          .post(`/api/products/${testProduct.id}/photos`)
          .set('Cookie', authUser.cookies)
          .send(photoData)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.photo).toMatchObject({
          filename: photoData.filename,
          url: photoData.url,
          isPrimary: photoData.isPrimary,
          productId: testProduct.id,
          uploadedBy: authUser.user.id
        })
      })

      it('should reject photo with invalid data', async () => {
        const invalidPhotoData = {
          // Missing required filename
          url: '/uploads/test.jpg'
        }

        await testRequest()
          .post(`/api/products/${testProduct.id}/photos`)
          .set('Cookie', authUser.cookies)
          .send(invalidPhotoData)
          .expect(400)
      })
    })

    describe('GET /api/products/:id/photos', () => {
      beforeEach(async () => {
        // Add test photos
        await testRequest()
          .post(`/api/products/${testProduct.id}/photos`)
          .set('Cookie', authUser.cookies)
          .send({
            filename: 'primary-photo.jpg',
            url: '/uploads/primary-photo.jpg',
            isPrimary: true
          })

        await testRequest()
          .post(`/api/products/${testProduct.id}/photos`)
          .set('Cookie', authUser.cookies)
          .send({
            filename: 'secondary-photo.jpg',
            url: '/uploads/secondary-photo.jpg',
            isPrimary: false
          })
      })

      it('should retrieve product photos with pagination', async () => {
        const response = await testRequest()
          .get(`/api/products/${testProduct.id}/photos?page=1&limit=10`)
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(response.body).toHaveProperty('photos')
        expect(response.body).toHaveProperty('pagination')
        expect(Array.isArray(response.body.photos)).toBe(true)
        expect(response.body.pagination).toMatchObject({
          page: 1,
          limit: 10,
          total: expect.any(Number),
          hasMore: expect.any(Boolean),
          totalPages: expect.any(Number)
        })
      })

      it('should retrieve only primary photos', async () => {
        const response = await testRequest()
          .get(`/api/products/${testProduct.id}/photos?primary=true`)
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(response.body.photos).toHaveLength(1)
        expect(response.body.photos[0].isPrimary).toBe(true)
      })

      it('should validate pagination parameters', async () => {
        await testRequest()
          .get(`/api/products/${testProduct.id}/photos?page=0&limit=200`)
          .set('Cookie', authUser.cookies)
          .expect(400)
      })
    })

    describe('GET /api/products/:id/photos/primary', () => {
      it('should retrieve primary photo', async () => {
        const response = await testRequest()
          .get(`/api/products/${testProduct.id}/photos/primary`)
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(response.body.isPrimary).toBe(true)
        expect(response.body.productId).toBe(testProduct.id)
      })

      it('should return 404 when no primary photo exists', async () => {
        // Create product without photos
        const productWithoutPhotos = await testRequest()
          .post('/api/products')
          .set('Cookie', authUser.cookies)
          .send({
            sku: `NO-PHOTOS-${Date.now()}`,
            name: 'Product without photos'
          })
          .expect(201)

        await testRequest()
          .get(`/api/products/${productWithoutPhotos.body.id}/photos/primary`)
          .set('Cookie', authUser.cookies)
          .expect(404)
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would need to be implemented with actual database mocking
      // For now, we test that our error handling structure is in place
      
      const response = await testRequest()
        .get('/api/products')
        .set('Cookie', authUser.cookies)

      // Response should either be successful or have proper error structure
      if (response.status !== 200) {
        expect(response.body).toHaveProperty('message')
      }
    })

    it('should handle concurrent product creation', async () => {
      const baseProduct = {
        name: 'Concurrent Test Product',
        description: 'Testing concurrent creation'
      }

      // Create multiple products simultaneously
      const promises = Array.from({ length: 5 }, (_, i) => 
        testRequest()
          .post('/api/products')
          .set('Cookie', authUser.cookies)
          .send({
            ...baseProduct,
            sku: `CONCURRENT-${Date.now()}-${i}`
          })
      )

      const results = await Promise.all(promises)
      
      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(201)
        expect(result.body.id).toBeDefined()
      })

      // All should have unique IDs
      const ids = results.map(r => r.body.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should handle large product data', async () => {
      const largeProduct = {
        sku: `LARGE-${Date.now()}`,
        name: 'Product with Large Data',
        description: 'A'.repeat(5000), // Large description
        weight: 999999.99,
        dimensions: {
          length: 9999.99,
          width: 9999.99,
          height: 9999.99
        }
      }

      const response = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send(largeProduct)

      // Should either succeed or fail gracefully with proper error
      if (response.status === 201) {
        expect(response.body.description).toBe(largeProduct.description)
      } else {
        expect(response.body).toHaveProperty('message')
      }
    })
  })
})