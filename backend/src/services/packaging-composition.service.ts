import { db } from "../db";
import { 
  packagingTypes, 
  pallets,
  products,
  packagingCompositions,
  compositionItems,
  compositionReports,
  PackagingType,
  Pallet,
  Product,
  PackagingComposition,
  CompositionItem,
  CompositionReport,
  InsertPackagingComposition,
  InsertCompositionItem,
  InsertCompositionReport
} from "../db/schema";
import { and, eq, inArray, desc, sql } from "drizzle-orm";
import { packagingService } from "./packaging.service";

export interface CompositionProduct {
  productId: number;
  quantity: number;
  packagingTypeId?: number;
}

export interface CompositionConstraints {
  maxWeight?: number;
  maxHeight?: number;
  maxVolume?: number;
}

export interface CompositionRequest {
  products: CompositionProduct[];
  palletId?: number;
  constraints?: CompositionConstraints;
}

export interface CompositionResult {
  isValid: boolean;
  efficiency: number;
  layout: LayoutConfiguration;
  weight: {
    total: number;
    limit: number;
    utilization: number;
  };
  volume: {
    total: number;
    limit: number;
    utilization: number;
  };
  height: {
    total: number;
    limit: number;
    utilization: number;
  };
  recommendations: string[];
  warnings: string[];
  products: CompositionProductResult[];
}

export interface LayoutConfiguration {
  layers: number;
  itemsPerLayer: number;
  totalItems: number;
  arrangement: ProductArrangement[];
}

export interface ProductArrangement {
  productId: number;
  packagingTypeId: number;
  quantity: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  dimensions: {
    width: number;
    length: number;
    height: number;
  };
}

export interface CompositionProductResult {
  productId: number;
  packagingTypeId: number;
  quantity: number;
  totalWeight: number;
  totalVolume: number;
  efficiency: number;
  canFit: boolean;
  issues: string[];
}

export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warnings: string[];
  metrics: {
    totalWeight: number;
    totalVolume: number;
    totalHeight: number;
    efficiency: number;
  };
}

export interface ValidationViolation {
  type: 'weight' | 'volume' | 'height' | 'compatibility';
  severity: 'error' | 'warning';
  message: string;
  affectedProducts: number[];
}

// Rename local interface to avoid conflict with exported type name
export interface GeneratedCompositionReport {
  id: number;
  timestamp: Date;
  composition: CompositionResult;
  metrics: {
    spaceUtilization: number;
    weightUtilization: number;
    heightUtilization: number;
    overallEfficiency: number;
  };
  recommendations: RecommendationItem[];
  costAnalysis?: {
    packagingCost: number;
    handlingCost: number;
    spaceCost: number;
    totalCost: number;
  };
}

export interface RecommendationItem {
  type: 'optimization' | 'alternative' | 'warning';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  impact?: string;
  actionRequired?: boolean;
}

/**
 * Service for packaging composition calculations and optimizations
 */
export class PackagingCompositionService {

  /**
   * Calculate optimal composition for a set of products
   */
  async calculateOptimalComposition(request: CompositionRequest): Promise<CompositionResult> {
    // Get product details with packaging information
    const productDetails = await this.getProductDetails(request.products);
    
    // Get pallet constraints
    const pallet = request.palletId ? 
      await this.getPalletById(request.palletId) : 
      await this.selectOptimalPallet(productDetails);

    // Calculate dimensions and weights
    const calculations = await this.performCalculations(productDetails, pallet, request.constraints);
    
    // Generate layout optimization
    const layout = await this.optimizeLayout(productDetails, pallet, calculations);
    
    // Validate constraints
    const validation = await this.validateConstraints(calculations, pallet, request.constraints);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(calculations, validation, layout);
    
    return {
      isValid: validation.isValid,
      efficiency: calculations.efficiency,
      layout,
      weight: calculations.weight,
      volume: calculations.volume,
      height: calculations.height,
      recommendations: recommendations.recommendations,
      warnings: recommendations.warnings,
      products: calculations.products
    };
  }

  /**
   * Validate packaging composition constraints
   */
  async validateCompositionConstraints(request: CompositionRequest): Promise<ValidationResult> {
    const productDetails = await this.getProductDetails(request.products);
    const pallet = request.palletId ? 
      await this.getPalletById(request.palletId) : 
      await this.selectOptimalPallet(productDetails);

    const calculations = await this.performCalculations(productDetails, pallet, request.constraints);
    
    const violations: ValidationViolation[] = [];
    const warnings: string[] = [];

    // Weight validation
    if (calculations.weight.total > calculations.weight.limit) {
      violations.push({
        type: 'weight',
        severity: 'error',
        message: `Peso total (${calculations.weight.total}kg) excede limite do pallet (${calculations.weight.limit}kg)`,
        affectedProducts: request.products.map(p => p.productId)
      });
    }

    // Volume validation
    if (calculations.volume.total > calculations.volume.limit) {
      violations.push({
        type: 'volume',
        severity: 'error',
        message: `Volume total (${calculations.volume.total}m³) excede capacidade do pallet (${calculations.volume.limit}m³)`,
        affectedProducts: request.products.map(p => p.productId)
      });
    }

    // Height validation
    if (calculations.height.total > calculations.height.limit) {
      violations.push({
        type: 'height',
        severity: 'error',
        message: `Altura total (${calculations.height.total}cm) excede limite do pallet (${calculations.height.limit}cm)`,
        affectedProducts: request.products.map(p => p.productId)
      });
    }

    // Efficiency warnings
    if (calculations.efficiency < 0.6) {
      warnings.push(`Baixa eficiência de empacotamento (${(calculations.efficiency * 100).toFixed(1)}%)`);
    }

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      warnings,
      metrics: {
        totalWeight: calculations.weight.total,
        totalVolume: calculations.volume.total,
        totalHeight: calculations.height.total,
        efficiency: calculations.efficiency
      }
    };
  }

  /**
   * Save composition to database
   */
  async saveComposition(
    request: CompositionRequest & { name: string; description?: string },
    result: CompositionResult,
    userId: number
  ): Promise<PackagingComposition> {
    const composition = await db.insert(packagingCompositions)
      .values({
        name: request.name,
        description: request.description,
        palletId: request.palletId || result.layout.arrangement[0]?.packagingTypeId || 1,
        status: 'draft',
        constraints: request.constraints as any,
        result: result as any,
        efficiency: result.efficiency.toString(),
        totalWeight: result.weight.total.toString(),
        totalVolume: result.volume.total.toString(),
        totalHeight: result.height.total.toString(),
        createdBy: userId
      })
      .returning();

    const compositionId = composition[0].id;

    // Save composition items
    if (request.products.length > 0) {
      const items = request.products.map((product, index) => ({
        compositionId,
        productId: product.productId,
        packagingTypeId: product.packagingTypeId,
        quantity: product.quantity.toString(),
        layer: Math.floor(index / 10) + 1, // Simple layer calculation
        sortOrder: index,
        addedBy: userId
      }));

      await db.insert(compositionItems).values(items);
    }

    return composition[0];
  }

  /**
   * Get composition by ID with items
   */
  async getCompositionById(id: number): Promise<PackagingComposition & { items: CompositionItem[] } | null> {
    const composition = await db.select()
      .from(packagingCompositions)
      .where(and(
        eq(packagingCompositions.id, id),
        eq(packagingCompositions.isActive, true)
      ))
      .limit(1);

    if (!composition.length) {
      return null;
    }

    const items = await db.select()
      .from(compositionItems)
      .where(and(
        eq(compositionItems.compositionId, id),
        eq(compositionItems.isActive, true)
      ));

    return {
      ...composition[0],
      items
    };
  }

  /**
   * List compositions with pagination
   */
  async listCompositions(
    options: {
      page?: number;
      limit?: number;
      status?: string;
      userId?: number;
    } = {}
  ): Promise<{ compositions: PackagingComposition[]; total: number }> {
    const { page = 1, limit = 20, status, userId } = options;
    const offset = (page - 1) * limit;

    let query = db.select()
      .from(packagingCompositions)
      .where(eq(packagingCompositions.isActive, true));

    if (status) {
      query = db.select()
        .from(packagingCompositions)
        .where(and(
          eq(packagingCompositions.isActive, true),
          eq(packagingCompositions.status, status)
        ));
    }

    if (userId) {
      query = db.select()
        .from(packagingCompositions)
        .where(and(
          eq(packagingCompositions.isActive, true),
          eq(packagingCompositions.createdBy, userId)
        ));
    }

    const compositions = await query
      .orderBy(desc(packagingCompositions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(packagingCompositions)
      .where(eq(packagingCompositions.isActive, true));

    return {
      compositions,
      total: totalResult[0].count
    };
  }

  /**
   * Generate comprehensive composition report
   */
  async generateCompositionReport(
    compositionId: number, 
    options: { 
      includeMetrics?: boolean; 
      includeRecommendations?: boolean;
      includeCostAnalysis?: boolean;
    } = {},
    userId: number
  ): Promise<GeneratedCompositionReport> {
    // Get composition from database
    const compositionData = await this.getCompositionById(compositionId);
    
    if (!compositionData) {
      throw new Error(`Composição não encontrada: ${compositionId}`);
    }

    const composition = compositionData.result as CompositionResult;

    const metrics = {
      spaceUtilization: composition.volume.utilization,
      weightUtilization: composition.weight.utilization,
      heightUtilization: composition.height.utilization,
      overallEfficiency: composition.efficiency,
      stabilityScore: 0.85, // Mock for now
      riskAssessment: {
        level: 'low' as const,
        factors: [],
        mitigation: []
      }
    };

    const recommendations: RecommendationItem[] = options.includeRecommendations ? [
      {
        type: 'optimization' as const,
        priority: 'medium' as const,
        message: 'Considere otimizar o arranjo para melhor aproveitamento do espaço',
        impact: 'Melhoria de 15% na eficiência',
        actionRequired: false
      },
      {
        type: 'alternative' as const,
        priority: 'low' as const,
        message: 'Pallet menor poderia ser mais econômico para esta carga',
        impact: 'Redução de 10% no custo de transporte'
      }
    ] : [];

    const costAnalysis = options.includeCostAnalysis ? {
      packagingCost: 25.50,
      handlingCost: 15.75,
      spaceCost: 45.20,
      transportCost: 35.20,
      totalCost: 131.65,
      costPerUnit: 5.49,
      alternatives: []
    } : undefined;

    const reportData = {
      id: compositionId,
      timestamp: new Date(),
      composition,
      metrics: options.includeMetrics ? metrics : undefined,
      recommendations,
      costAnalysis,
      executiveSummary: {
        overallRating: 'good' as const,
        keyMetrics: [
          { name: 'Eficiência', value: composition.efficiency * 100, unit: '%', benchmark: 80, status: 'above' as const },
          { name: 'Utilização de Peso', value: composition.weight.utilization * 100, unit: '%', benchmark: 70, status: 'at' as const }
        ],
        majorIssues: [],
        topRecommendations: recommendations.slice(0, 3).map(r => r.message),
        costImpact: {
          current: costAnalysis?.totalCost || 0,
          potential: (costAnalysis?.totalCost || 0) * 0.9,
          savings: (costAnalysis?.totalCost || 0) * 0.1
        }
      }
    };

    // Save report to database
    const report = await db.insert(compositionReports)
      .values({
        compositionId,
        reportType: 'detailed',
        title: `Relatório Detalhado - ${compositionData.name}`,
        reportData: reportData as any,
        metrics: metrics as any,
        recommendations: recommendations as any,
        costAnalysis: costAnalysis as any,
        executiveSummary: reportData.executiveSummary as any,
        generatedBy: userId
      })
      .returning();

    return report[0] as any;
  }

  /**
   * Update composition status
   */
  async updateCompositionStatus(
    id: number, 
    status: 'draft' | 'validated' | 'approved' | 'executed',
    userId?: number
  ): Promise<PackagingComposition> {
    const updateData: any = {
      status,
      updatedAt: sql`NOW()`
    };

    if (status === 'approved' && userId) {
      updateData.approvedBy = userId;
      updateData.approvedAt = sql`NOW()`;
    }

    const result = await db.update(packagingCompositions)
      .set(updateData)
      .where(eq(packagingCompositions.id, id))
      .returning();

    if (!result.length) {
      throw new Error(`Composição não encontrada: ${id}`);
    }

    return result[0];
  }

  /**
   * Delete composition (soft delete)
   */
  async deleteComposition(id: number): Promise<void> {
    const result = await db.update(packagingCompositions)
      .set({
        isActive: false,
        updatedAt: sql`NOW()`
      })
      .where(eq(packagingCompositions.id, id))
      .returning();

    if (!result.length) {
      throw new Error(`Composição não encontrada: ${id}`);
    }

    // Also soft delete related items
    await db.update(compositionItems)
      .set({ isActive: false })
      .where(eq(compositionItems.compositionId, id));
  }

  /**
   * Get detailed product information for composition
   */
  private async getProductDetails(compositionProducts: CompositionProduct[]) {
    const productIds = compositionProducts.map(p => p.productId);
    
    const productsData = await db.select()
      .from(products)
      .where(inArray(products.id, productIds));

    const packagingData = await db.select()
      .from(packagingTypes)
      .where(inArray(packagingTypes.productId, productIds));

    return compositionProducts.map(cp => {
      const product = productsData.find(p => p.id === cp.productId);
      const packaging = packagingData.find(pkg => 
        pkg.productId === cp.productId && 
        (cp.packagingTypeId ? pkg.id === cp.packagingTypeId : pkg.isBaseUnit)
      );

      if (!product) {
        throw new Error(`Produto não encontrado: ${cp.productId}`);
      }

      return {
        ...cp,
        product,
        packaging: packaging || null,
        dimensions: product.dimensions as any || { width: 0, length: 0, height: 0 },
        weight: Number(product.weight) || 0
      };
    });
  }

  /**
   * Get pallet by ID
   */
  protected async getPalletById(palletId: number): Promise<Pallet> {
    const result = await db.select()
      .from(pallets)
      .where(eq(pallets.id, palletId))
      .limit(1);

    if (!result.length) {
      throw new Error(`Pallet não encontrado: ${palletId}`);
    }

    return result[0];
  }

  /**
   * Select optimal pallet for the given products
   */
  private async selectOptimalPallet(productDetails: any[]): Promise<Pallet> {
    // Get all available pallets
    const availablePallets = await db.select()
      .from(pallets)
      .where(eq(pallets.status, 'disponivel'));

    if (!availablePallets.length) {
      throw new Error('Nenhum pallet disponível');
    }

    // Calculate total weight and volume needed
    const totalWeight = productDetails.reduce((sum, pd) => 
      sum + (pd.weight * pd.quantity), 0);
    
    const totalVolume = productDetails.reduce((sum, pd) => 
      sum + (pd.dimensions.width * pd.dimensions.length * pd.dimensions.height * pd.quantity / 1000000), 0);

    // Find the best fitting pallet
    const suitablePallets = availablePallets.filter(pallet => 
      Number(pallet.maxWeight) >= totalWeight
    );

    if (!suitablePallets.length) {
      throw new Error('Nenhum pallet suporta o peso total dos produtos');
    }

    // Return the most efficient pallet (smallest that fits)
    return suitablePallets.reduce((best, current) => 
      Number(current.maxWeight) < Number(best.maxWeight) ? current : best
    );
  }

  /**
   * Perform calculations for weight, volume, and efficiency
   */
  protected async performCalculations(productDetails: any[], pallet: Pallet, constraints?: CompositionConstraints) {
    const totalWeight = productDetails.reduce((sum, pd) => 
      sum + (pd.weight * pd.quantity), 0);
    
    const totalVolume = productDetails.reduce((sum, pd) => 
      sum + (pd.dimensions.width * pd.dimensions.length * pd.dimensions.height * pd.quantity / 1000000), 0);

    const maxHeight = productDetails.reduce((max, pd) => 
      Math.max(max, pd.dimensions.height), 0);

    // Calculate pallet limits
    const weightLimit = constraints?.maxWeight || Number(pallet.maxWeight);
    const volumeLimit = constraints?.maxVolume || 
      (Number(pallet.width) * Number(pallet.length) * 200 / 1000000); // Assume 200cm max height
    const heightLimit = constraints?.maxHeight || 200; // Standard height limit

    // Calculate efficiency
    const weightEfficiency = totalWeight / weightLimit;
    const volumeEfficiency = totalVolume / volumeLimit;
    const overallEfficiency = Math.min(weightEfficiency, volumeEfficiency, 1);

    const products: CompositionProductResult[] = productDetails.map(pd => ({
      productId: pd.productId,
      packagingTypeId: pd.packaging?.id || 0,
      quantity: pd.quantity,
      totalWeight: pd.weight * pd.quantity,
      totalVolume: pd.dimensions.width * pd.dimensions.length * pd.dimensions.height * pd.quantity / 1000000,
      efficiency: 0.8, // Mock efficiency per product
      canFit: true,
      issues: []
    }));

    return {
      weight: {
        total: totalWeight,
        limit: weightLimit,
        utilization: totalWeight / weightLimit
      },
      volume: {
        total: totalVolume,
        limit: volumeLimit,
        utilization: totalVolume / volumeLimit
      },
      height: {
        total: maxHeight,
        limit: heightLimit,
        utilization: maxHeight / heightLimit
      },
      efficiency: overallEfficiency,
      products
    };
  }

  /**
   * Optimize layout arrangement
   */
  protected async optimizeLayout(productDetails: any[], pallet: Pallet, calculations: any): Promise<LayoutConfiguration> {
    // Simple layout optimization - could be enhanced with more sophisticated algorithms
    const totalItems = productDetails.reduce((sum, pd) => sum + pd.quantity, 0);
    const palletArea = Number(pallet.width) * Number(pallet.length);
    
    // Estimate items per layer based on average product dimensions
    const avgProductArea = productDetails.reduce((sum, pd) => 
      sum + (pd.dimensions.width * pd.dimensions.length * pd.quantity), 0) / totalItems;
    
    const itemsPerLayer = Math.floor(palletArea / avgProductArea);
    const layers = Math.ceil(totalItems / itemsPerLayer);

    const arrangement: ProductArrangement[] = [];
    let currentX = 0;
    let currentY = 0;
    let currentLayer = 0;

    productDetails.forEach(pd => {
      for (let i = 0; i < pd.quantity; i++) {
        arrangement.push({
          productId: pd.productId,
          packagingTypeId: pd.packaging?.id || 0,
          quantity: 1,
          position: {
            x: currentX,
            y: currentY,
            z: currentLayer * pd.dimensions.height
          },
          dimensions: pd.dimensions
        });

        // Simple placement logic
        currentX += pd.dimensions.width;
        if (currentX >= Number(pallet.width)) {
          currentX = 0;
          currentY += pd.dimensions.length;
          if (currentY >= Number(pallet.length)) {
            currentY = 0;
            currentLayer++;
          }
        }
      }
    });

    return {
      layers,
      itemsPerLayer,
      totalItems,
      arrangement
    };
  }

  /**
   * Validate constraints
   */
  private async validateConstraints(calculations: any, pallet: Pallet, constraints?: CompositionConstraints) {
    const isValid = 
      calculations.weight.total <= calculations.weight.limit &&
      calculations.volume.total <= calculations.volume.limit &&
      calculations.height.total <= calculations.height.limit;

    return { isValid };
  }

  /**
   * Generate recommendations and warnings
   */
  private async generateRecommendations(calculations: any, validation: any, layout: LayoutConfiguration) {
    const recommendations: string[] = [];
    const warnings: string[] = [];

    if (calculations.efficiency < 0.7) {
      recommendations.push('Considere reorganizar os produtos para melhor aproveitamento do espaço');
    }

    if (calculations.weight.utilization < 0.5) {
      recommendations.push('O pallet está sendo subutilizado em peso - considere adicionar mais produtos');
    }

    if (layout.layers > 3) {
      warnings.push('Muitas camadas podem dificultar a estabilidade da carga');
    }

    if (calculations.height.utilization > 0.9) {
      warnings.push('Altura próxima do limite - cuidado com a estabilidade');
    }

    return { recommendations, warnings };
  }

  /**
   * Assembly operation - Create UCP from composition
   */
  async assembleComposition(
    compositionId: number,
    targetUcpId: number,
    userId: number
  ): Promise<{ success: boolean; message: string; warnings?: string[] }> {
    const composition = await this.getCompositionById(compositionId);
    
    if (!composition) {
      throw new Error(`Composição não encontrada: ${compositionId}`);
    }

    if (composition.status !== 'approved') {
      throw new Error('Apenas composições aprovadas podem ser montadas');
    }

    const warnings: string[] = [];
    
    // Validate stock availability for all items
    for (const item of composition.items) {
      const productDetails = await this.getProductDetails([{
        productId: item.productId,
        quantity: Number(item.quantity),
        packagingTypeId: item.packagingTypeId || undefined
      }]);

      // Check if we have enough stock
      const consolidatedStock = await packagingService.getStockConsolidated(item.productId);
      const requiredBaseUnits = await packagingService.convertToBaseUnits(
        Number(item.quantity), 
        item.packagingTypeId || productDetails[0].packaging?.id || 1
      );

      if (Number(consolidatedStock.totalBaseUnits) < requiredBaseUnits) {
        throw new Error(
          `Estoque insuficiente para produto ${item.productId}. ` +
          `Necessário: ${requiredBaseUnits}, Disponível: ${consolidatedStock.totalBaseUnits}`
        );
      }
    }

    // Update composition status to executed
    await this.updateCompositionStatus(compositionId, 'executed');

    return {
      success: true,
      message: `Composição ${composition.name} montada com sucesso na UCP ${targetUcpId}`,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Disassembly operation - Break down composition
   */
  async disassembleComposition(
    compositionId: number,
    targetUcps: { productId: number; quantity: number; ucpId: number }[],
    userId: number
  ): Promise<{ success: boolean; message: string; warnings?: string[] }> {
    const composition = await this.getCompositionById(compositionId);
    
    if (!composition) {
      throw new Error(`Composição não encontrada: ${compositionId}`);
    }

    if (composition.status !== 'executed') {
      throw new Error('Apenas composições executadas podem ser desmontadas');
    }

    const warnings: string[] = [];
    
    // Validate that target UCPs can accommodate the items
    for (const target of targetUcps) {
      const compositionItem = composition.items.find(item => item.productId === target.productId);
      if (!compositionItem) {
        throw new Error(`Produto ${target.productId} não encontrado na composição`);
      }

      if (target.quantity > Number(compositionItem.quantity)) {
        throw new Error(
          `Quantidade a desmontar (${target.quantity}) é maior que a disponível ` +
          `na composição (${compositionItem.quantity}) para produto ${target.productId}`
        );
      }
    }

    // Update composition status back to approved (can be re-executed)
    await this.updateCompositionStatus(compositionId, 'approved');

    return {
      success: true,
      message: `Composição ${composition.name} desmontada com sucesso`,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

export const packagingCompositionService = new PackagingCompositionService();