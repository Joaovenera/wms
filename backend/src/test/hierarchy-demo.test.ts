import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { packagingService } from '../services/packaging.service';
import { db } from '../db';
import { products, packagingTypes } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Packaging Hierarchy Demo - 3 Levels (1→2→10)', () => {
  let testProductId: number;
  let testUserId = 1;

  beforeAll(async () => {
    try {
      // Criar produto de teste
      const testProduct = await db.insert(products).values({
        sku: 'TEST-HIERARCHY-001',
        name: 'Produto Teste Hierarquia',
        description: 'Produto para testar hierarquia de embalagens',
        unit: 'un',
        createdBy: testUserId,
      }).returning();
      
      if (testProduct && testProduct.length > 0) {
        testProductId = testProduct[0].id;
      } else {
        throw new Error('Failed to create test product');
      }
    } catch (error) {
      console.error('Error in beforeAll:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Limpar dados de teste
    await db.delete(packagingTypes).where(eq(packagingTypes.productId, testProductId));
    await db.delete(products).where(eq(products.id, testProductId));
  });

  it('should create a complete 3-level hierarchy (1→2→10)', async () => {
    // Usar o método createExampleHierarchy do serviço
    const hierarchy = await packagingService.createExampleHierarchy(testProductId, testUserId);
    
    // Verificar que todas as embalagens foram criadas
    expect(hierarchy.baseUnit).toBeDefined();
    expect(hierarchy.level2).toBeDefined();
    expect(hierarchy.level3).toBeDefined();
    
    // Verificar nível 1 - Unidade Individual
    expect(hierarchy.baseUnit.name).toBe('Unidade Individual');
    expect(hierarchy.baseUnit.baseUnitQuantity).toBe('1');
    expect(hierarchy.baseUnit.isBaseUnit).toBe(true);
    expect(hierarchy.baseUnit.level).toBe(1);
    expect(hierarchy.baseUnit.parentPackagingId).toBe(null);
    expect(hierarchy.baseUnit.dimensions).toEqual({
      length: 5, width: 3, height: 2, weight: 0.1
    });

    // Verificar nível 2 - Caixa com 2 unidades
    expect(hierarchy.level2.name).toBe('Caixa 2 Unidades');
    expect(hierarchy.level2.baseUnitQuantity).toBe('2');
    expect(hierarchy.level2.isBaseUnit).toBe(false);
    expect(hierarchy.level2.level).toBe(2);
    expect(hierarchy.level2.parentPackagingId).toBe(hierarchy.baseUnit.id);
    expect(hierarchy.level2.dimensions).toEqual({
      length: 12, width: 8, height: 5, weight: 0.05
    });

    // Verificar nível 3 - Embalagem com 5 caixas = 10 unidades
    expect(hierarchy.level3.name).toBe('Embalagem 5 Caixas (10 Unidades)');
    expect(hierarchy.level3.baseUnitQuantity).toBe('10');
    expect(hierarchy.level3.isBaseUnit).toBe(false);
    expect(hierarchy.level3.level).toBe(3);
    expect(hierarchy.level3.parentPackagingId).toBe(hierarchy.level2.id);
    expect(hierarchy.level3.dimensions).toEqual({
      length: 25, width: 20, height: 15, weight: 0.1
    });
  });

  it('should validate hierarchy integrity correctly', async () => {
    const validation = await packagingService.validateHierarchyIntegrity(testProductId);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.warnings).toHaveLength(0);
  });

  it('should build hierarchy tree with metadata', async () => {
    const hierarchyData = await packagingService.getPackagingHierarchy(testProductId);
    
    expect(hierarchyData.hierarchy).toHaveLength(1); // 1 raiz
    expect(hierarchyData.metadata.totalLevels).toBe(3);
    expect(hierarchyData.metadata.totalPackagings).toBe(3);
    expect(hierarchyData.metadata.hasBaseUnit).toBe(true);
    expect(hierarchyData.metadata.rootCount).toBe(1);

    // Verificar estrutura da árvore
    const root = hierarchyData.hierarchy[0];
    expect(root.level).toBe(1);
    expect(root.children).toHaveLength(1);
    
    const level2 = root.children[0];
    expect(level2.level).toBe(2);
    expect(level2.children).toHaveLength(1);
    
    const level3 = level2.children[0];
    expect(level3.level).toBe(3);
    expect(level3.children).toHaveLength(0);
  });

  it('should perform conversions correctly between levels', async () => {
    const packagings = await packagingService.getPackagingsByProduct(testProductId);
    
    const baseUnit = packagings.find(p => p.level === 1);
    const level2 = packagings.find(p => p.level === 2);
    const level3 = packagings.find(p => p.level === 3);
    
    // Conversão: 1 caixa nível 2 → unidades base
    const conversion1 = await packagingService.convertBetweenPackagings(
      level2!.id, baseUnit!.id, 1
    );
    expect(conversion1.convertedQuantity).toBe(2);
    expect(conversion1.isExact).toBe(true);

    // Conversão: 1 embalagem nível 3 → unidades base
    const conversion2 = await packagingService.convertBetweenPackagings(
      level3!.id, baseUnit!.id, 1
    );
    expect(conversion2.convertedQuantity).toBe(10);
    expect(conversion2.isExact).toBe(true);

    // Conversão: 1 embalagem nível 3 → caixas nível 2
    const conversion3 = await packagingService.convertBetweenPackagings(
      level3!.id, level2!.id, 1
    );
    expect(conversion3.convertedQuantity).toBe(5);
    expect(conversion3.isExact).toBe(true);

    // Conversão reversa: 5 caixas nível 2 → embalagem nível 3
    const conversion4 = await packagingService.convertBetweenPackagings(
      level2!.id, level3!.id, 5
    );
    expect(conversion4.convertedQuantity).toBe(1);
    expect(conversion4.isExact).toBe(true);
  });

  it('should validate dimensions correctly', async () => {
    // Dimensões válidas (filho menor que pai)
    const validDimensions = { length: 10, width: 6, height: 3 };
    const parentDimensions = { length: 12, width: 8, height: 5 };
    
    await expect(
      packagingService.validateDimensions(validDimensions, parentDimensions)
    ).resolves.not.toThrow();

    // Dimensões inválidas (filho maior que pai)
    const invalidDimensions = { length: 15, width: 10, height: 7 };
    
    await expect(
      packagingService.validateDimensions(invalidDimensions, parentDimensions)
    ).rejects.toThrow('não cabem na embalagem pai');
  });

  it('should calculate hierarchy path correctly', async () => {
    const packagings = await packagingService.getPackagingsByProduct(testProductId);
    const level3 = packagings.find(p => p.level === 3);
    
    const path = await packagingService.getHierarchyPath(level3!.id);
    
    expect(path).toHaveLength(3);
    expect(path[0].level).toBe(1); // Base unit
    expect(path[1].level).toBe(2); // Level 2
    expect(path[2].level).toBe(3); // Level 3
    
    // Verificar ordem hierárquica
    expect(path[0].name).toBe('Unidade Individual');
    expect(path[1].name).toBe('Caixa 2 Unidades');
    expect(path[2].name).toBe('Embalagem 5 Caixas (10 Unidades)');
  });

  it('should demonstrate real-world scenario calculations', async () => {
    // Cenário: Cliente quer 25 unidades do produto
    // Sistema deve otimizar: 2 embalagens nível 3 (20 un) + 2 caixas nível 2 (4 un) + 1 unidade individual (1 un) = 25 un
    
    const pickingPlan = await packagingService.optimizePickingByPackaging(testProductId, 25);
    
    // Verificar que o plano foi criado
    expect(pickingPlan.pickingPlan.length).toBeGreaterThan(0);
    expect(pickingPlan.totalPlanned).toBeLessThanOrEqual(25);
    
    console.log('Plano de separação para 25 unidades:', JSON.stringify(pickingPlan, null, 2));
  });
});