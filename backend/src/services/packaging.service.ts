import { db } from "../db";
import { 
  packagingTypes, 
  packagingConversionRules, 
  ucpItems, 
  products,
  PackagingType,
  InsertPackagingType,
  InsertPackagingConversionRule 
} from "../db/schema";
import { and, eq, sql, desc, asc, isNull } from "drizzle-orm";

export class PackagingService {
  
  /**
   * Busca todas as embalagens de um produto ordenadas por nível
   */
  async getPackagingsByProduct(productId: number): Promise<PackagingType[]> {
    return await db.select()
      .from(packagingTypes)
      .where(and(
        eq(packagingTypes.productId, productId),
        eq(packagingTypes.isActive, true)
      ))
      .orderBy(asc(packagingTypes.level));
  }

  /**
   * Busca embalagem por código de barras
   */
  async getPackagingByBarcode(barcode: string): Promise<PackagingType> {
    const result = await db.select()
      .from(packagingTypes)
      .where(and(
        eq(packagingTypes.barcode, barcode),
        eq(packagingTypes.isActive, true)
      ))
      .limit(1);
    
    if (!result.length) {
      throw new Error(`Embalagem não encontrada para o código de barras: ${barcode}`);
    }
    
    return result[0];
  }

  /**
   * Busca embalagem base de um produto
   */
  async getBasePackaging(productId: number): Promise<PackagingType> {
    const result = await db.select()
      .from(packagingTypes)
      .where(and(
        eq(packagingTypes.productId, productId),
        eq(packagingTypes.isBaseUnit, true),
        eq(packagingTypes.isActive, true)
      ))
      .limit(1);
    
    if (!result.length) {
      throw new Error(`Embalagem base não encontrada para o produto: ${productId}`);
    }
    
    return result[0];
  }

  /**
   * Converte quantidade para unidade base
   */
  async convertToBaseUnits(quantity: number, packagingTypeId: number): Promise<number> {
    const result = await db.select({
      baseUnitQuantity: packagingTypes.baseUnitQuantity
    })
    .from(packagingTypes)
    .where(eq(packagingTypes.id, packagingTypeId))
    .limit(1);
    
    if (!result.length) {
      throw new Error(`Tipo de embalagem não encontrado: ${packagingTypeId}`);
    }
    
    return quantity * Number(result[0].baseUnitQuantity);
  }

  /**
   * Converte da unidade base para uma embalagem específica
   */
  async convertFromBaseUnits(baseQuantity: number, targetPackagingId: number): Promise<number> {
    const result = await db.select({
      baseUnitQuantity: packagingTypes.baseUnitQuantity
    })
    .from(packagingTypes)
    .where(eq(packagingTypes.id, targetPackagingId))
    .limit(1);
    
    if (!result.length) {
      throw new Error(`Tipo de embalagem não encontrado: ${targetPackagingId}`);
    }
    
    return baseQuantity / Number(result[0].baseUnitQuantity);
  }

  /**
   * Obtém estoque consolidado por produto (sempre em unidade base)
   */
  async getStockConsolidated(productId: number) {
    const result = await db.select({
      productId: sql<number>`${productId}`,
      totalBaseUnits: sql<number>`COALESCE(SUM(${ucpItems.quantity}), 0)`,
      locationsCount: sql<number>`COUNT(DISTINCT ${ucpItems.ucpId})`,
      itemsCount: sql<number>`COUNT(${ucpItems.id})`
    })
    .from(ucpItems)
    .where(and(
      eq(ucpItems.productId, productId),
      eq(ucpItems.isActive, true)
    ));
    
    return result[0];
  }

  /**
   * Obtém estoque detalhado por tipo de embalagem
   */
  async getStockByPackaging(productId: number) {
    return await db.select({
      packagingId: packagingTypes.id,
      packagingName: packagingTypes.name,
      barcode: packagingTypes.barcode,
      baseUnitQuantity: packagingTypes.baseUnitQuantity,
      level: packagingTypes.level,
      availablePackages: sql<number>`FLOOR(COALESCE(SUM(${ucpItems.quantity}), 0) / ${packagingTypes.baseUnitQuantity})`,
      remainingBaseUnits: sql<number>`COALESCE(SUM(${ucpItems.quantity}), 0) % ${packagingTypes.baseUnitQuantity}`,
      totalBaseUnits: sql<number>`COALESCE(SUM(${ucpItems.quantity}), 0)`
    })
    .from(packagingTypes)
    .leftJoin(ucpItems, and(
      eq(packagingTypes.productId, ucpItems.productId),
      eq(ucpItems.isActive, true),
      eq(ucpItems.packagingTypeId, packagingTypes.id)
    ))
    .where(and(
      eq(packagingTypes.productId, productId),
      eq(packagingTypes.isActive, true)
    ))
    .groupBy(packagingTypes.id, packagingTypes.name, packagingTypes.barcode, packagingTypes.baseUnitQuantity, packagingTypes.level)
    .orderBy(asc(packagingTypes.level));
  }

  /**
   * Cria nova embalagem para um produto
   */
  async createPackaging(data: InsertPackagingType): Promise<PackagingType> {
    // Verificar se já existe uma embalagem base para este produto se isBaseUnit = true
    if (data.isBaseUnit) {
      const existing = await db.select()
        .from(packagingTypes)
        .where(and(
          eq(packagingTypes.productId, data.productId),
          eq(packagingTypes.isBaseUnit, true),
          eq(packagingTypes.isActive, true)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error('Já existe uma embalagem base para este produto');
      }
    }

    // Verificar se o código de barras já existe (se fornecido)
    if (data.barcode) {
      const existing = await db.select()
        .from(packagingTypes)
        .where(and(
          eq(packagingTypes.barcode, data.barcode),
          eq(packagingTypes.isActive, true)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error('Código de barras já existe em outra embalagem');
      }
    }

    const result = await db.insert(packagingTypes)
      .values(data)
      .returning();
    
    return result[0];
  }

  /**
   * Atualiza embalagem existente
   */
  async updatePackaging(id: number, data: Partial<InsertPackagingType>): Promise<PackagingType> {
    // Verificar se o código de barras já existe em outra embalagem (se fornecido)
    if (data.barcode) {
      const existing = await db.select()
        .from(packagingTypes)
        .where(and(
          eq(packagingTypes.barcode, data.barcode),
          eq(packagingTypes.isActive, true),
          sql`id != ${id}`
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error('Código de barras já existe em outra embalagem');
      }
    }

    const result = await db.update(packagingTypes)
      .set({
        ...data,
        updatedAt: sql`NOW()`
      })
      .where(eq(packagingTypes.id, id))
      .returning();
    
    if (!result.length) {
      throw new Error(`Embalagem não encontrada: ${id}`);
    }
    
    return result[0];
  }

  /**
   * Remove embalagem (soft delete)
   */
  async deletePackaging(id: number): Promise<void> {
    // Verificar se há itens usando esta embalagem
    const itemsUsingPackaging = await db.select()
      .from(ucpItems)
      .where(and(
        eq(ucpItems.packagingTypeId, id),
        eq(ucpItems.isActive, true)
      ))
      .limit(1);
    
    if (itemsUsingPackaging.length > 0) {
      throw new Error('Não é possível remover embalagem que possui itens associados');
    }

    const result = await db.update(packagingTypes)
      .set({
        isActive: false,
        updatedAt: sql`NOW()`
      })
      .where(eq(packagingTypes.id, id))
      .returning();
    
    if (!result.length) {
      throw new Error(`Embalagem não encontrada: ${id}`);
    }
  }

  /**
   * Calcula fator de conversão entre duas embalagens
   */
  async calculateConversionFactor(fromPackagingId: number, toPackagingId: number): Promise<number> {
    const result = await db.select({
      fromBaseQty: packagingTypes.baseUnitQuantity,
      toBaseQty: sql<number>`(SELECT base_unit_quantity FROM packaging_types WHERE id = ${toPackagingId})`
    })
    .from(packagingTypes)
    .where(eq(packagingTypes.id, fromPackagingId))
    .limit(1);
    
    if (!result.length) {
      throw new Error(`Embalagem de origem não encontrada: ${fromPackagingId}`);
    }
    
    const { fromBaseQty, toBaseQty } = result[0];
    
    if (!toBaseQty) {
      throw new Error(`Embalagem de destino não encontrada: ${toPackagingId}`);
    }
    
    return Number(fromBaseQty) / Number(toBaseQty);
  }

  /**
   * Otimiza separação usando combinação de embalagens
   */
  async optimizePickingByPackaging(productId: number, requestedBaseUnits: number) {
    const packagings = await this.getPackagingsByProduct(productId);
    const stockByPackaging = await this.getStockByPackaging(productId);
    
    // Criar mapa de estoque disponível por embalagem
    const availableStock: Record<number, number> = {};
    stockByPackaging.forEach(stock => {
      availableStock[stock.packagingId] = Number(stock.availablePackages);
    });
    
    const pickingPlan: Array<{
      packaging: PackagingType;
      quantity: number;
      baseUnits: number;
    }> = [];
    
    let remaining = requestedBaseUnits;
    
    // Ordenar embalagens por quantidade base DESC (maior primeiro para otimizar)
    const sortedPackagings = packagings
      .sort((a, b) => Number(b.baseUnitQuantity) - Number(a.baseUnitQuantity));
    
    for (const pkg of sortedPackagings) {
      const availableInThisPackaging = availableStock[pkg.id] || 0;
      const packagesNeeded = Math.floor(remaining / Number(pkg.baseUnitQuantity));
      const packagesToUse = Math.min(packagesNeeded, availableInThisPackaging);
      
      if (packagesToUse > 0) {
        const baseUnitsUsed = packagesToUse * Number(pkg.baseUnitQuantity);
        pickingPlan.push({
          packaging: pkg,
          quantity: packagesToUse,
          baseUnits: baseUnitsUsed
        });
        remaining -= baseUnitsUsed;
      }
      
      if (remaining <= 0) break;
    }
    
    return { 
      pickingPlan, 
      remaining,
      totalPlanned: requestedBaseUnits - remaining,
      canFulfill: remaining === 0
    };
  }

  /**
   * Cria regra de conversão entre embalagens
   */
  async createConversionRule(data: InsertPackagingConversionRule): Promise<void> {
    await db.insert(packagingConversionRules)
      .values(data);
  }

  /**
   * Busca hierarquia completa de embalagens de um produto
   */
  async getPackagingHierarchy(productId: number) {
    const allPackagings = await this.getPackagingsByProduct(productId);
    
    // Construir árvore hierárquica
    const packagingMap = new Map(allPackagings.map(p => [p.id, { ...p, children: [] as any[] }]));
    const rootPackagings: any[] = [];
    
    allPackagings.forEach(pkg => {
      const packageWithChildren = packagingMap.get(pkg.id)!;
      
      if (pkg.parentPackagingId) {
        const parent = packagingMap.get(pkg.parentPackagingId);
        if (parent) {
          parent.children.push(packageWithChildren);
        }
      } else {
        rootPackagings.push(packageWithChildren);
      }
    });
    
    return rootPackagings;
  }
}

export const packagingService = new PackagingService();