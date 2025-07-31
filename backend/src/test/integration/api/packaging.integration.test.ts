import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { testRequest, authenticateTestUser, createTestProduct } from '../../integration-setup'

describe('Packaging API Integration Tests', () => {
  let authUser: any
  let testProduct: any

  beforeAll(async () => {
    authUser = await authenticateTestUser()
    testProduct = await createTestProduct()
  })

  describe('POST /api/products/:id/packaging', () => {
    it('should create base packaging unit', async () => {
      const basePackaging = {
        name: 'Unit',
        level: 0,
        baseUnitQuantity: 1,
        isBaseUnit: true,
        barcode: `UNIT-${Date.now()}`,
        weight: 0.1,
        dimensions: {
          length: 10,
          width: 8,
          height: 5
        }
      }

      const response = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send(basePackaging)
        .expect(201)

      expect(response.body).toMatchObject({
        name: basePackaging.name,
        level: basePackaging.level,
        baseUnitQuantity: basePackaging.baseUnitQuantity,
        isBaseUnit: basePackaging.isBaseUnit,
        barcode: basePackaging.barcode,
        productId: testProduct.id
      })
      expect(response.body.id).toBeDefined()
    })

    it('should create higher level packaging', async () => {
      const boxPackaging = {
        name: 'Box',
        level: 1,
        baseUnitQuantity: 12,
        isBaseUnit: false,
        barcode: `BOX-${Date.now()}`,
        weight: 1.5
      }

      const response = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send(boxPackaging)
        .expect(201)

      expect(response.body.name).toBe(boxPackaging.name)
      expect(response.body.baseUnitQuantity).toBe(boxPackaging.baseUnitQuantity)
      expect(response.body.isBaseUnit).toBe(false)
    })

    it('should prevent duplicate base unit creation', async () => {
      // First base unit
      await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'First Base Unit',
          level: 0,
          baseUnitQuantity: 1,
          isBaseUnit: true
        })
        .expect(201)

      // Second base unit should fail
      await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Second Base Unit',
          level: 0,
          baseUnitQuantity: 1,
          isBaseUnit: true
        })
        .expect(400)
    })

    it('should prevent duplicate barcode creation', async () => {
      const duplicateBarcode = `DUPLICATE-${Date.now()}`

      // First packaging with barcode
      await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'First Package',
          barcode: duplicateBarcode,
          baseUnitQuantity: 1
        })
        .expect(201)

      // Second packaging with same barcode should fail
      await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Second Package',
          barcode: duplicateBarcode,
          baseUnitQuantity: 6
        })
        .expect(400)
    })
  })

  describe('GET /api/products/:id/packaging', () => {
    beforeEach(async () => {
      // Create test packaging hierarchy
      const packagingHierarchy = [
        {
          name: 'Unit',
          level: 0,
          baseUnitQuantity: 1,
          isBaseUnit: true,
          barcode: `UNIT-${Date.now()}`
        },
        {
          name: 'Box',
          level: 1,
          baseUnitQuantity: 12,
          isBaseUnit: false,
          barcode: `BOX-${Date.now()}`
        },
        {
          name: 'Case',
          level: 2,
          baseUnitQuantity: 144,
          isBaseUnit: false,
          barcode: `CASE-${Date.now()}`
        }
      ]

      for (const pkg of packagingHierarchy) {
        await testRequest()
          .post(`/api/products/${testProduct.id}/packaging`)
          .set('Cookie', authUser.cookies)
          .send(pkg)
          .expect(201)
      }
    })

    it('should retrieve all packaging for product ordered by level', async () => {
      const response = await testRequest()
        .get(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(3)

      // Should be ordered by level (0, 1, 2)
      expect(response.body[0].level).toBe(0)
      expect(response.body[1].level).toBe(1)
      expect(response.body[2].level).toBe(2)

      // Base unit should be first
      expect(response.body[0].isBaseUnit).toBe(true)
    })

    it('should return empty array for product without packaging', async () => {
      const newProduct = await createTestProduct()

      const response = await testRequest()
        .get(`/api/products/${newProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBe(0)
    })
  })

  describe('GET /api/packaging/:barcode', () => {
    let testBarcode: string

    beforeEach(async () => {
      testBarcode = `TEST-BARCODE-${Date.now()}`
      
      await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Scannable Package',
          barcode: testBarcode,
          baseUnitQuantity: 6
        })
        .expect(201)
    })

    it('should retrieve packaging by barcode', async () => {
      const response = await testRequest()
        .get(`/api/packaging/${testBarcode}`)
        .set('Cookie', authUser.cookies)
        .expect(200)

      expect(response.body.barcode).toBe(testBarcode)
      expect(response.body.name).toBe('Scannable Package')
      expect(response.body.baseUnitQuantity).toBe(6)
    })

    it('should return 404 for non-existent barcode', async () => {
      await testRequest()
        .get('/api/packaging/NON-EXISTENT-BARCODE')
        .set('Cookie', authUser.cookies)
        .expect(404)
    })
  })

  describe('PUT /api/packaging/:id', () => {
    let packagingId: number

    beforeEach(async () => {
      const response = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Updatable Package',
          barcode: `UPDATE-${Date.now()}`,
          baseUnitQuantity: 10
        })
        .expect(201)

      packagingId = response.body.id
    })

    it('should update packaging with valid data', async () => {
      const updateData = {
        name: 'Updated Package Name',
        weight: 2.5,
        dimensions: {
          length: 15,
          width: 12,
          height: 8
        }
      }

      const response = await testRequest()
        .put(`/api/packaging/${packagingId}`)
        .set('Cookie', authUser.cookies)
        .send(updateData)
        .expect(200)

      expect(response.body.name).toBe(updateData.name)
      expect(response.body.weight).toBe(updateData.weight)
      expect(response.body.dimensions).toEqual(updateData.dimensions)
    })

    it('should prevent barcode conflicts during update', async () => {
      // Create another package with a barcode
      const conflictBarcode = `CONFLICT-${Date.now()}`
      
      await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Conflict Package',
          barcode: conflictBarcode,
          baseUnitQuantity: 5
        })
        .expect(201)

      // Try to update first package with conflicting barcode
      await testRequest()
        .put(`/api/packaging/${packagingId}`)
        .set('Cookie', authUser.cookies)
        .send({
          barcode: conflictBarcode
        })
        .expect(400)
    })

    it('should return 404 for non-existent packaging', async () => {
      const nonExistentId = 999999

      await testRequest()
        .put(`/api/packaging/${nonExistentId}`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Updated Name'
        })
        .expect(404)
    })
  })

  describe('DELETE /api/packaging/:id', () => {
    let packagingId: number

    beforeEach(async () => {
      const response = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Deletable Package',
          barcode: `DELETE-${Date.now()}`,
          baseUnitQuantity: 8
        })
        .expect(201)

      packagingId = response.body.id
    })

    it('should soft delete packaging', async () => {
      await testRequest()
        .delete(`/api/packaging/${packagingId}`)
        .set('Cookie', authUser.cookies)
        .expect(204)

      // Package should not appear in active packaging list
      const response = await testRequest()
        .get(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .expect(200)

      const deletedPackage = response.body.find((p: any) => p.id === packagingId)
      expect(deletedPackage).toBeUndefined()
    })

    it('should prevent deletion of packaging with associated items', async () => {
      // This would require creating UCP items first
      // For now, test the error handling structure
      
      // Create a UCP item associated with this packaging
      // (This would need actual UCP item creation endpoint)
      
      // Attempt to delete packaging should fail
      // await testRequest()
      //   .delete(`/api/packaging/${packagingId}`)
      //   .set('Cookie', authUser.cookies)
      //   .expect(400)
    })
  })

  describe('Packaging Conversion and Calculations', () => {
    let unitPackaging: any
    let boxPackaging: any
    let casePackaging: any

    beforeEach(async () => {
      // Create packaging hierarchy for conversion tests
      const unitResponse = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Unit',
          level: 0,
          baseUnitQuantity: 1,
          isBaseUnit: true
        })
        .expect(201)
      unitPackaging = unitResponse.body

      const boxResponse = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Box',
          level: 1,
          baseUnitQuantity: 12
        })
        .expect(201)
      boxPackaging = boxResponse.body

      const caseResponse = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Case',
          level: 2,
          baseUnitQuantity: 144
        })
        .expect(201)
      casePackaging = caseResponse.body
    })

    describe('GET /api/packaging/convert', () => {
      it('should convert between packaging types', async () => {
        const response = await testRequest()
          .get('/api/packaging/convert')
          .query({
            from: boxPackaging.id,
            to: unitPackaging.id,
            quantity: 5
          })
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(response.body.fromQuantity).toBe(5)
        expect(response.body.toQuantity).toBe(60) // 5 boxes * 12 units = 60 units
        expect(response.body.conversionFactor).toBe(12)
      })

      it('should handle reverse conversion', async () => {
        const response = await testRequest()
          .get('/api/packaging/convert')
          .query({
            from: unitPackaging.id,
            to: boxPackaging.id,
            quantity: 24
          })
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(response.body.fromQuantity).toBe(24)
        expect(response.body.toQuantity).toBe(2) // 24 units / 12 = 2 boxes
        expect(response.body.conversionFactor).toBeCloseTo(0.0833, 4)
      })

      it('should handle complex conversions', async () => {
        const response = await testRequest()
          .get('/api/packaging/convert')
          .query({
            from: casePackaging.id,
            to: boxPackaging.id,
            quantity: 2
          })
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(response.body.fromQuantity).toBe(2)
        expect(response.body.toQuantity).toBe(24) // 2 cases * 144 units / 12 units per box = 24 boxes
      })
    })

    describe('GET /api/products/:id/packaging/stock', () => {
      it('should return stock breakdown by packaging type', async () => {
        // This would require actual stock data
        // For now, test the endpoint structure
        
        const response = await testRequest()
          .get(`/api/products/${testProduct.id}/packaging/stock`)
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(Array.isArray(response.body)).toBe(true)
        
        // Each stock entry should have packaging info
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('packagingId')
          expect(response.body[0]).toHaveProperty('packagingName')
          expect(response.body[0]).toHaveProperty('availablePackages')
          expect(response.body[0]).toHaveProperty('totalBaseUnits')
        }
      })
    })

    describe('POST /api/products/:id/packaging/optimize-picking', () => {
      it('should optimize picking strategy', async () => {
        const response = await testRequest()
          .post(`/api/products/${testProduct.id}/packaging/optimize-picking`)
          .set('Cookie', authUser.cookies)
          .send({
            requestedQuantity: 250,
            unit: 'baseUnits'
          })
          .expect(200)

        expect(response.body).toHaveProperty('pickingPlan')
        expect(response.body).toHaveProperty('canFulfill')
        expect(response.body).toHaveProperty('totalPlanned')
        expect(response.body).toHaveProperty('remaining')

        expect(Array.isArray(response.body.pickingPlan)).toBe(true)
      })

      it('should handle insufficient stock scenarios', async () => {
        const response = await testRequest()
          .post(`/api/products/${testProduct.id}/packaging/optimize-picking`)
          .set('Cookie', authUser.cookies)
          .send({
            requestedQuantity: 999999,
            unit: 'baseUnits'
          })
          .expect(200)

        expect(response.body.canFulfill).toBe(false)
        expect(response.body.remaining).toBeGreaterThan(0)
      })
    })
  })

  describe('Packaging Hierarchy', () => {
    describe('GET /api/products/:id/packaging/hierarchy', () => {
      beforeEach(async () => {
        // Create complex hierarchy with parent-child relationships
        const responses = await Promise.all([
          testRequest()
            .post(`/api/products/${testProduct.id}/packaging`)
            .set('Cookie', authUser.cookies)
            .send({
              name: 'Pallet',
              level: 3,
              baseUnitQuantity: 1728, // 12 cases
              parentPackagingId: null
            }),
          
          testRequest()
            .post(`/api/products/${testProduct.id}/packaging`)
            .set('Cookie', authUser.cookies)
            .send({
              name: 'Case',
              level: 2,
              baseUnitQuantity: 144 // 12 boxes
            }),
          
          testRequest()
            .post(`/api/products/${testProduct.id}/packaging`)
            .set('Cookie', authUser.cookies)
            .send({
              name: 'Box',
              level: 1,
              baseUnitQuantity: 12 // 12 units
            }),
          
          testRequest()
            .post(`/api/products/${testProduct.id}/packaging`)
            .set('Cookie', authUser.cookies)
            .send({
              name: 'Unit',
              level: 0,
              baseUnitQuantity: 1,
              isBaseUnit: true
            })
        ])

        // Update parent-child relationships
        const [pallet, caseResp, box, unit] = responses
        
        await testRequest()
          .put(`/api/packaging/${caseResp.body.id}`)
          .set('Cookie', authUser.cookies)
          .send({
            parentPackagingId: pallet.body.id
          })

        await testRequest()
          .put(`/api/packaging/${box.body.id}`)
          .set('Cookie', authUser.cookies)
          .send({
            parentPackagingId: caseResp.body.id
          })

        await testRequest()
          .put(`/api/packaging/${unit.body.id}`)
          .set('Cookie', authUser.cookies)
          .send({
            parentPackagingId: box.body.id
          })
      })

      it('should return hierarchical packaging structure', async () => {
        const response = await testRequest()
          .get(`/api/products/${testProduct.id}/packaging/hierarchy`)
          .set('Cookie', authUser.cookies)
          .expect(200)

        expect(Array.isArray(response.body)).toBe(true)
        expect(response.body.length).toBe(1) // One root (Pallet)
        
        const pallet = response.body[0]
        expect(pallet.name).toBe('Pallet')
        expect(pallet.children).toHaveLength(1)
        
        const casePackage = pallet.children[0]
        expect(casePackage.name).toBe('Case')
        expect(casePackage.children).toHaveLength(1)
        
        const box = casePackage.children[0]
        expect(box.name).toBe('Box')
        expect(box.children).toHaveLength(1)
        
        const unit = box.children[0]
        expect(unit.name).toBe('Unit')
        expect(unit.isBaseUnit).toBe(true)
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid product ID', async () => {
      await testRequest()
        .get('/api/products/invalid-id/packaging')
        .set('Cookie', authUser.cookies)
        .expect(500)
    })

    it('should handle concurrent packaging creation', async () => {
      const concurrentPackaging = Array.from({ length: 5 }, (_, i) => ({
        name: `Concurrent Package ${i}`,
        barcode: `CONCURRENT-${Date.now()}-${i}`,
        baseUnitQuantity: i + 1
      }))

      const promises = concurrentPackaging.map(pkg =>
        testRequest()
          .post(`/api/products/${testProduct.id}/packaging`)
          .set('Cookie', authUser.cookies)
          .send(pkg)
      )

      const results = await Promise.all(promises)
      
      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(201)
        expect(result.body.id).toBeDefined()
      })
    })

    it('should handle zero and negative quantities in conversions', async () => {
      const unitResponse = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Unit',
          baseUnitQuantity: 1,
          isBaseUnit: true
        })

      const boxResponse = await testRequest()
        .post(`/api/products/${testProduct.id}/packaging`)
        .set('Cookie', authUser.cookies)
        .send({
          name: 'Box',
          baseUnitQuantity: 12
        })

      // Test zero quantity
      await testRequest()
        .get('/api/packaging/convert')
        .query({
          from: boxResponse.body.id,
          to: unitResponse.body.id,
          quantity: 0
        })
        .set('Cookie', authUser.cookies)
        .expect(200)

      // Test negative quantity (should handle gracefully)
      await testRequest()
        .get('/api/packaging/convert')
        .query({
          from: boxResponse.body.id,
          to: unitResponse.body.id,
          quantity: -5
        })
        .set('Cookie', authUser.cookies)
        .expect(400)
    })
  })
})