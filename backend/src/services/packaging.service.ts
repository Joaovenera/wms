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
   * Valida hierarquia de embalagens
   */
  async validateHierarchy(data: InsertPackagingType, existingId?: number): Promise<void> {
    // Validar unidade base única
    if (data.isBaseUnit) {
      const existing = await db.select()
        .from(packagingTypes)
        .where(and(
          eq(packagingTypes.productId, data.productId),
          eq(packagingTypes.isBaseUnit, true),
          eq(packagingTypes.isActive, true),
          existingId ? sql`id != ${existingId}` : sql`1=1`
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error('Já existe uma embalagem base para este produto');
      }
    }

    // Validar parent-child relationship
    if (data.parentPackagingId) {
      const parent = await db.select()
        .from(packagingTypes)
        .where(and(
          eq(packagingTypes.id, data.parentPackagingId),
          eq(packagingTypes.productId, data.productId),
          eq(packagingTypes.isActive, true)
        ))
        .limit(1);
      
      if (!parent.length) {
        throw new Error('Embalagem pai não encontrada ou não pertence ao mesmo produto');
      }

      // Verificar referência circular
      if (existingId && typeof data.parentPackagingId === 'number' && await this.hasCircularReference(existingId, data.parentPackagingId)) {
        throw new Error('Criação desta hierarquia resultaria em referência circular');
      }

      // Validar nível hierárquico - filho deve ter nível MENOR que pai (pai = container)
      const parentLevel = parent[0].level;
      if (typeof data.level === 'number' && typeof parentLevel === 'number' && data.level >= parentLevel) {
        throw new Error(`Nível da embalagem filho (${data.level}) deve ser menor que o nível do container pai (${parentLevel})`);
      }

      // Validar dimensões - filho deve caber no pai (container)
      if (data.dimensions && parent[0].dimensions) {
        await this.validateDimensions(data.dimensions, parent[0].dimensions);
      }

      // Validar quantidade base - filho deve ter quantidade MENOR que pai (pai = container)
      const parentBaseQty = Number(parent[0].baseUnitQuantity);
      const childBaseQty = Number(data.baseUnitQuantity);
      
      if (childBaseQty >= parentBaseQty) {
        throw new Error(`Quantidade base da embalagem (${childBaseQty}) deve ser menor que a do container pai (${parentBaseQty})`);
      }
    }

    // Validar código de barras único
    if (data.barcode) {
      const existing = await db.select()
        .from(packagingTypes)
        .where(and(
          eq(packagingTypes.barcode, data.barcode),
          eq(packagingTypes.isActive, true),
          existingId ? sql`id != ${existingId}` : sql`1=1`
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error('Código de barras já existe em outra embalagem');
      }
    }
  }

  /**
   * Verifica se existe referência circular na hierarquia
   */
  async hasCircularReference(childId: number, parentId: number): Promise<boolean> {
    const visited = new Set<number>();
    let currentId = parentId;
    
    while (currentId && !visited.has(currentId)) {
      if (currentId === childId) {
        return true;
      }
      
      visited.add(currentId);
      
      const parent = await db.select({ parentPackagingId: packagingTypes.parentPackagingId })
        .from(packagingTypes)
        .where(eq(packagingTypes.id, currentId))
        .limit(1);
      
      currentId = parent[0]?.parentPackagingId || 0;
    }
    
    return false;
  }

  /**
   * Valida se as dimensões filhas cabem nas dimensões pai
   */
  async validateDimensions(childDimensions: any, parentDimensions: any): Promise<void> {
    if (!childDimensions || !parentDimensions) return;

    const child = childDimensions;
    const parent = parentDimensions;
    
    // Verificar se todas as dimensões do filho são menores ou iguais ao pai
    if (child.length > parent.length || 
        child.width > parent.width || 
        child.height > parent.height) {
      throw new Error(
        `Dimensões da embalagem filha (${child.length}x${child.width}x${child.height}cm) ` +
        `não cabem na embalagem pai (${parent.length}x${parent.width}x${parent.height}cm)`
      );
    }
  }

  /**
   * Calcula nível automático baseado no pai
   */
  async calculateAutomaticLevel(parentPackagingId?: number): Promise<number> {
    if (!parentPackagingId) {
      return 1; // Nível raiz
    }

    const parent = await db.select({ level: packagingTypes.level })
      .from(packagingTypes)
      .where(eq(packagingTypes.id, parentPackagingId))
      .limit(1);
    
    if (!parent.length) {
      throw new Error('Embalagem pai não encontrada');
    }
    
    return parent[0].level + 1;
  }

  /**
   * Cria nova embalagem para um produto com validação completa
   */
  async createPackaging(data: InsertPackagingType): Promise<PackagingType> {
    // Calcular nível automaticamente se não fornecido
    if (!data.level) {
      data.level = await this.calculateAutomaticLevel(data.parentPackagingId || undefined);
    }

    // Validar hierarquia completa
    await this.validateHierarchy(data);

    const result = await db.insert(packagingTypes)
      .values(data)
      .returning();
    
    return (result as PackagingType[])[0];
  }

  /**
   * Atualiza embalagem existente com validação completa
   */
  async updatePackaging(id: number, data: Partial<InsertPackagingType>): Promise<PackagingType> {
    // Obter embalagem atual
    const current = await db.select()
      .from(packagingTypes)
      .where(eq(packagingTypes.id, id))
      .limit(1);
    
    if (!current.length) {
      throw new Error(`Embalagem não encontrada: ${id}`);
    }

    // Mesclar dados atuais com atualizações
    const updatedData = { ...current[0], ...data } as InsertPackagingType;
    
    // Calcular nível automaticamente se parentPackagingId mudou
    if (data.parentPackagingId !== undefined && !data.level) {
      updatedData.level = await this.calculateAutomaticLevel(data.parentPackagingId || undefined);
    }

    // Validar hierarquia completa
    await this.validateHierarchy(updatedData, id);

    const result = await db.update(packagingTypes)
      .set({
        ...data,
        updatedAt: sql`NOW()`
      })
      .where(eq(packagingTypes.id, id))
      .returning();
    
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
   * Busca hierarquia completa de embalagens de um produto com metadados
   */
  async getPackagingHierarchy(productId: number) {
    const allPackagings = await this.getPackagingsByProduct(productId);
    
    // Construir árvore hierárquica com metadados
    const packagingMap = new Map(allPackagings.map(p => [p.id, { 
      ...p, 
      children: [] as any[],
      depth: 0,
      path: [] as number[],
      effectiveWeight: this.calculateEffectiveWeight(p),
      effectiveVolume: this.calculateEffectiveVolume(p)
    }]));
    
    const rootPackagings: any[] = [];
    
    // Primeiro passo: identificar raízes e calcular profundidade
    allPackagings.forEach(pkg => {
      const packageWithChildren = packagingMap.get(pkg.id)!;
      
      if (pkg.parentPackagingId) {
        const parent = packagingMap.get(pkg.parentPackagingId);
        if (parent) {
          parent.children.push(packageWithChildren);
          // Calcular profundidade e caminho
          packageWithChildren.depth = parent.depth + 1;
          packageWithChildren.path = [...parent.path, pkg.id];
        }
      } else {
        rootPackagings.push(packageWithChildren);
        packageWithChildren.path = [pkg.id];
      }
    });
    
    // Ordenar hierarquia por nível
    const sortHierarchy = (items: any[]) => {
      items.sort((a, b) => a.level - b.level);
      items.forEach(item => {
        if (item.children.length > 0) {
          sortHierarchy(item.children);
        }
      });
    };
    
    sortHierarchy(rootPackagings);
    
    return {
      hierarchy: rootPackagings,
      metadata: {
        totalLevels: Math.max(...allPackagings.map(p => p.level)),
        totalPackagings: allPackagings.length,
        hasBaseUnit: allPackagings.some(p => p.isBaseUnit),
        rootCount: rootPackagings.length
      }
    };
  }

  /**
   * Calcula conversão entre duas embalagens através de caminho hierárquico
   */
  async convertBetweenPackagings(fromPackagingId: number, toPackagingId: number, quantity: number): Promise<{
    convertedQuantity: number;
    conversionPath: Array<{ from: PackagingType; to: PackagingType; factor: number; }>;
    isExact: boolean;
  }> {
    // Buscar ambas as embalagens
    const [fromPkg, toPkg] = await Promise.all([
      db.select().from(packagingTypes).where(eq(packagingTypes.id, fromPackagingId)).limit(1),
      db.select().from(packagingTypes).where(eq(packagingTypes.id, toPackagingId)).limit(1)
    ]);

    if (!fromPkg.length || !toPkg.length) {
      throw new Error('Uma ou ambas as embalagens não foram encontradas');
    }

    if (fromPkg[0].productId !== toPkg[0].productId) {
      throw new Error('Embalagens devem pertencer ao mesmo produto');
    }

    // Conversão direta através de unidades base
    const fromBaseQty = Number(fromPkg[0].baseUnitQuantity);
    const toBaseQty = Number(toPkg[0].baseUnitQuantity);
    
    const baseUnits = quantity * fromBaseQty;
    const convertedQuantity = baseUnits / toBaseQty;
    const isExact = convertedQuantity === Math.floor(convertedQuantity);

    return {
      convertedQuantity: isExact ? convertedQuantity : Math.floor(convertedQuantity),
      conversionPath: [{
        from: fromPkg[0],
        to: toPkg[0],
        factor: fromBaseQty / toBaseQty
      }],
      isExact
    };
  }

  /**
   * Obtém caminho completo da hierarquia para uma embalagem
   */
  async getHierarchyPath(packagingId: number): Promise<PackagingType[]> {
    const path: PackagingType[] = [];
    let currentId = packagingId;

    while (currentId) {
      const current = await db.select()
        .from(packagingTypes)
        .where(eq(packagingTypes.id, currentId))
        .limit(1);
      
      if (!current.length) break;
      
      path.unshift(current[0]); // Adicionar no início para ordem correta
      currentId = current[0].parentPackagingId || 0;
    }

    return path;
  }

  /**
   * Valida integridade completa da hierarquia de um produto
   */
  async validateHierarchyIntegrity(productId: number): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const packagings = await this.getPackagingsByProduct(productId);
    
    // Verificar unidade base única
    const baseUnits = packagings.filter(p => p.isBaseUnit);
    if (baseUnits.length === 0) {
      errors.push('Produto não possui embalagem base definida');
    } else if (baseUnits.length > 1) {
      errors.push('Produto possui múltiplas embalagens base');
    }

    // Verificar consistência de níveis
    for (const pkg of packagings) {
      if (pkg.parentPackagingId) {
        const parent = packagings.find(p => p.id === pkg.parentPackagingId);
        if (!parent) {
          errors.push(`Embalagem ${pkg.name} referencia pai inexistente`);
        } else if (pkg.level <= parent.level) {
          errors.push(`Embalagem ${pkg.name} tem nível inconsistente com pai`);
        } else if (Number(pkg.baseUnitQuantity) <= Number(parent.baseUnitQuantity)) {
          errors.push(`Embalagem ${pkg.name} tem quantidade base menor que o pai`);
        }
      }
    }

    // Verificar referências circulares
    for (const pkg of packagings) {
      if (pkg.parentPackagingId && await this.hasCircularReference(pkg.id, pkg.parentPackagingId)) {
        errors.push(`Embalagem ${pkg.name} possui referência circular`);
      }
    }

    // Verificar dimensões quando disponíveis
    for (const pkg of packagings) {
      if (pkg.parentPackagingId && pkg.dimensions) {
        const parent = packagings.find(p => p.id === pkg.parentPackagingId);
        if (parent?.dimensions) {
          try {
            await this.validateDimensions(pkg.dimensions, parent.dimensions);
      } catch (error) {
        warnings.push(`Problema de dimensões: ${(error as Error).message}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calcula peso efetivo de uma embalagem (incluindo conteúdo)
   */
  private calculateEffectiveWeight(packaging: PackagingType): number {
    // Peso base da embalagem (se disponível)
    const baseWeight = packaging.dimensions?.weight || 0;
    
    // Para cálculo real, seria necessário peso do produto
    // Por enquanto, retorna peso da embalagem
    return baseWeight;
  }

  /**
   * Calcula volume efetivo de uma embalagem
   */
  private calculateEffectiveVolume(packaging: PackagingType): number {
    if (!packaging.dimensions) return 0;
    
    const { length = 0, width = 0, height = 0 } = packaging.dimensions;
    return length * width * height; // cm³
  }

  /**
   * Cria hierarquia de exemplo para testes (1 → 2 → 10 unidades)
   * CONCEITO CORRIGIDO: Embalagem master contém caixas que contém unidades individuais
   */
  async createExampleHierarchy(productId: number, createdBy: number): Promise<{
    baseUnit: PackagingType;
    level2: PackagingType;
    level3: PackagingType;
  }> {
    // Criar hierarquia de baixo para cima, começando pelo container maior
    
    // Nível 3: Embalagem Master (container principal - sem pai)
    const level3 = await this.createPackaging({
      productId,
      name: 'Embalagem Master (10 Unidades)',
      baseUnitQuantity: '10',
      parentPackagingId: null,
      level: 3,
      dimensions: { length: 30, width: 25, height: 18, weight: 0.2 },
      createdBy: createdBy as any
    });

    // Nível 2: Caixa 2 Unidades (filho do master, pai da unidade individual)
    const level2 = await this.createPackaging({
      productId,
      name: 'Caixa 2 Unidades',
      baseUnitQuantity: '2',
      parentPackagingId: level3.id,
      level: 2,
      dimensions: { length: 12, width: 10, height: 8, weight: 0.05 },
      createdBy: createdBy as any
    });

    // Nível 1: Unidade Individual (produto básico - filho da caixa)
    const baseUnit = await this.createPackaging({
      productId,
      name: 'Unidade Individual',
      baseUnitQuantity: '1',
      isBaseUnit: true,
      parentPackagingId: level2.id,
      level: 1,
      dimensions: { length: 5, width: 4, height: 3, weight: 0.1 },
      createdBy: createdBy as any
    });

    return { 
      baseUnit, 
      level2, 
      level3 
    };
  }
}

export const packagingService = new PackagingService();