import { Request, Response } from "express";
import { z } from "zod";
import { packagingService } from "../services/packaging.service";
import { packagingCompositionService } from "../services/packaging-composition.service";
import { packagingCompositionEnhancedService } from "../services/packaging-composition-enhanced.service";
import { insertPackagingTypeSchema } from "../db/schema";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { compositionCacheService } from "../infrastructure/cache/composition-cache.service";
import { intelligentCache } from "../infrastructure/cache/intelligent-cache.service";
import { QueryCache, CacheInvalidation } from "../infrastructure/cache/query-cache.decorator";

/**
 * Enhanced Controller for packaging operations
 * Handles CRUD operations, conversions, optimizations, and compositions
 * Features intelligent caching, performance monitoring, and advanced algorithms
 */
@CacheInvalidation('packaging')
export class PackagingController {
  
  /**
   * Get packaging types for a product with stock information
   */
  async getPackagingsByProduct(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ 
          error: 'ID do produto inválido',
          code: 'INVALID_PRODUCT_ID'
        });
      }

      const [packagings, stockByPackaging, consolidatedStock] = await Promise.all([
        packagingService.getPackagingsByProduct(productId),
        packagingService.getStockByPackaging(productId),
        packagingService.getStockConsolidated(productId)
      ]);

      res.json({
        success: true,
        data: {
          packagings,
          stock: stockByPackaging,
          consolidated: consolidatedStock
        }
      });
    } catch (error) {
      console.error('Erro ao buscar embalagens do produto:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get packaging hierarchy for a product
   */
  async getPackagingHierarchy(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.productId);
      
      if (isNaN(productId)) {
        return res.status(400).json({ 
          error: 'ID do produto inválido',
          code: 'INVALID_PRODUCT_ID'
        });
      }

      const hierarchy = await packagingService.getPackagingHierarchy(productId);
      
      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      console.error('Erro ao buscar hierarquia de embalagens:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Scan packaging by barcode
   */
  async scanBarcode(req: Request, res: Response) {
    const scanBarcodeSchema = z.object({
      barcode: z.string().min(1, 'Código de barras é obrigatório')
    });

    try {
      const { barcode } = scanBarcodeSchema.parse(req.body);
      
      const packaging = await packagingService.getPackagingByBarcode(barcode);
      
      res.json({
        success: true,
        data: packaging
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      if (error instanceof Error && error.message.includes('não encontrada')) {
        return res.status(404).json({ 
          error: error.message,
          code: 'PACKAGING_NOT_FOUND'
        });
      }
      
      console.error('Erro ao buscar embalagem por código de barras:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Optimize picking using packaging combinations
   */
  async optimizePicking(req: Request, res: Response) {
    const optimizePickingSchema = z.object({
      productId: z.number().int().positive('ID do produto deve ser um número positivo'),
      requestedBaseUnits: z.number().positive('Quantidade solicitada deve ser positiva')
    });

    try {
      const { productId, requestedBaseUnits } = optimizePickingSchema.parse(req.body);
      
      const pickingPlan = await packagingService.optimizePickingByPackaging(productId, requestedBaseUnits);
      
      res.json({
        success: true,
        data: pickingPlan
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      console.error('Erro ao otimizar separação:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Convert quantity between packaging types
   */
  async convertQuantity(req: Request, res: Response) {
    const convertQuantitySchema = z.object({
      quantity: z.number().positive('Quantidade deve ser positiva'),
      fromPackagingId: z.number().int().positive('ID da embalagem de origem obrigatório'),
      toPackagingId: z.number().int().positive('ID da embalagem de destino obrigatório')
    });

    try {
      const { quantity, fromPackagingId, toPackagingId } = convertQuantitySchema.parse(req.body);
      
      // Convert to base units first
      const baseUnits = await packagingService.convertToBaseUnits(quantity, fromPackagingId);
      
      // Then convert to target packaging
      const convertedQuantity = await packagingService.convertFromBaseUnits(baseUnits, toPackagingId);
      
      res.json({
        success: true,
        data: {
          originalQuantity: quantity,
          originalPackagingId: fromPackagingId,
          convertedQuantity,
          targetPackagingId: toPackagingId,
          baseUnits
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      if (error instanceof Error && error.message.includes('não encontrado')) {
        return res.status(404).json({ 
          error: error.message,
          code: 'PACKAGING_NOT_FOUND'
        });
      }
      
      console.error('Erro ao converter quantidade:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Create new packaging type
   */
  async createPackaging(req: AuthenticatedRequest, res: Response) {
    try {
      const validatedData = insertPackagingTypeSchema.parse(req.body);
      
      const packaging = await packagingService.createPackaging({
        ...validatedData,
        createdBy: req.user.id
      });
      
      res.status(201).json({
        success: true,
        data: packaging
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      if (error instanceof Error && (
        error.message.includes('já existe') || 
        error.message.includes('já existe')
      )) {
        return res.status(409).json({ 
          error: error.message,
          code: 'PACKAGING_ALREADY_EXISTS'
        });
      }
      
      console.error('Erro ao criar embalagem:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Update existing packaging type
   */
  async updatePackaging(req: Request, res: Response) {
    const updatePackagingSchema = insertPackagingTypeSchema.partial();

    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          error: 'ID da embalagem inválido',
          code: 'INVALID_PACKAGING_ID'
        });
      }

      const validatedData = updatePackagingSchema.parse(req.body);
      const packaging = await packagingService.updatePackaging(id, validatedData);
      
      res.json({
        success: true,
        data: packaging
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('não encontrada')) {
          return res.status(404).json({ 
            error: error.message,
            code: 'PACKAGING_NOT_FOUND'
          });
        }
        if (error.message.includes('já existe')) {
          return res.status(409).json({ 
            error: error.message,
            code: 'PACKAGING_ALREADY_EXISTS'
          });
        }
      }
      
      console.error('Erro ao atualizar embalagem:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Delete packaging type (soft delete)
   */
  async deletePackaging(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          error: 'ID da embalagem inválido',
          code: 'INVALID_PACKAGING_ID'
        });
      }

      await packagingService.deletePackaging(id);
      
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('não encontrada')) {
          return res.status(404).json({ 
            error: error.message,
            code: 'PACKAGING_NOT_FOUND'
          });
        }
        if (error.message.includes('possui itens associados')) {
          return res.status(409).json({ 
            error: error.message,
            code: 'PACKAGING_HAS_ITEMS'
          });
        }
      }
      
      console.error('Erro ao remover embalagem:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get packaging by ID
   */
  async getPackagingById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          error: 'ID da embalagem inválido',
          code: 'INVALID_PACKAGING_ID'
        });
      }

      // This method should be improved to get specific packaging by ID
      const packagings = await packagingService.getPackagingsByProduct(id);
      
      if (!packagings.length) {
        return res.status(404).json({ 
          error: 'Embalagem não encontrada',
          code: 'PACKAGING_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: packagings[0]
      });
    } catch (error) {
      console.error('Erro ao buscar embalagem:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // COMPOSITION METHODS

  /**
   * Calculate optimal pallet composition for products with enhanced algorithms
   */
  @QueryCache({
    key: 'packaging.calculate_composition.{0}',
    volatility: 'medium',
    dependencies: ['products', 'pallets', 'packaging_types'],
    useL1Cache: true,
    condition: (result: any) => result.success && result.data?.isValid
  })
  async calculateOptimalComposition(req: Request, res: Response) {
    const compositionSchema = z.object({
      products: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
        packagingTypeId: z.number().int().positive().optional()
      })).min(1, 'Pelo menos um produto é obrigatório'),
      palletId: z.number().int().positive().optional(),
      constraints: z.object({
        maxWeight: z.number().positive().optional(),
        maxHeight: z.number().positive().optional(),
        maxVolume: z.number().positive().optional()
      }).optional(),
      useEnhancedAlgorithm: z.boolean().default(true)
    });

    try {
      const validatedData = compositionSchema.parse(req.body);
      const startTime = Date.now();
      
      // Use enhanced service for better results
      const composition = validatedData.useEnhancedAlgorithm 
        ? await packagingCompositionEnhancedService.calculateOptimalComposition(validatedData)
        : await packagingCompositionService.calculateOptimalComposition(validatedData);
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: composition,
        metadata: {
          responseTime: `${responseTime}ms`,
          algorithm: validatedData.useEnhancedAlgorithm ? 'enhanced' : 'standard',
          cached: false, // Will be true if result comes from cache
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      console.error('Erro ao calcular composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Generate composition report
   */
  async generateCompositionReport(req: Request, res: Response) {
    const reportSchema = z.object({
      compositionId: z.number().int().positive(),
      includeMetrics: z.boolean().default(true),
      includeRecommendations: z.boolean().default(true)
    });

    try {
      const { compositionId, includeMetrics, includeRecommendations } = reportSchema.parse(req.body);
      
      const report = await packagingCompositionService.generateCompositionReport(
        compositionId, 
        { includeMetrics, includeRecommendations }
      );
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      console.error('Erro ao gerar relatório de composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Validate packaging composition constraints
   */
  async validateComposition(req: Request, res: Response) {
    const validationSchema = z.object({
      products: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
        packagingTypeId: z.number().int().positive()
      })),
      palletId: z.number().int().positive()
    });

    try {
      const validatedData = validationSchema.parse(req.body);
      
      const validation = await packagingCompositionService.validateCompositionConstraints(validatedData);
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      console.error('Erro ao validar composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // COMPOSITION PERSISTENCE METHODS

  /**
   * Save composition to database
   */
  async saveComposition(req: AuthenticatedRequest, res: Response) {
    const saveCompositionSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório'),
      description: z.string().optional(),
      products: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
        packagingTypeId: z.number().int().positive().optional()
      })).min(1, 'Pelo menos um produto é obrigatório'),
      palletId: z.number().int().positive().optional(),
      constraints: z.object({
        maxWeight: z.number().positive().optional(),
        maxHeight: z.number().positive().optional(),
        maxVolume: z.number().positive().optional()
      }).optional()
    });

    try {
      const validatedData = saveCompositionSchema.parse(req.body);
      
      // First calculate the composition
      const composition = await packagingCompositionService.calculateOptimalComposition(validatedData);
      
      // Then save it to database
      const savedComposition = await packagingCompositionService.saveComposition(
        validatedData,
        composition,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        data: {
          composition: savedComposition,
          result: composition
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      console.error('Erro ao salvar composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get composition by ID
   */
  async getComposition(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          error: 'ID da composição inválido',
          code: 'INVALID_COMPOSITION_ID'
        });
      }

      const composition = await packagingCompositionService.getCompositionById(id);
      
      if (!composition) {
        return res.status(404).json({ 
          error: 'Composição não encontrada',
          code: 'COMPOSITION_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: composition
      });
    } catch (error) {
      console.error('Erro ao buscar composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * List compositions with pagination
   */
  async listCompositions(req: Request, res: Response) {
    const listCompositionsSchema = z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().min(1).max(100).default(20),
      status: z.enum(['draft', 'validated', 'approved', 'executed']).optional(),
      userId: z.number().int().positive().optional()
    });

    try {
      const options = listCompositionsSchema.parse({
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        status: req.query.status,
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined
      });
      
      const result = await packagingCompositionService.listCompositions(options);
      
      res.json({
        success: true,
        data: result.compositions,
        pagination: {
          page: options.page,
          limit: options.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / options.limit)
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Parâmetros inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      console.error('Erro ao listar composições:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Update composition status
   */
  async updateCompositionStatus(req: AuthenticatedRequest, res: Response) {
    const updateStatusSchema = z.object({
      status: z.enum(['draft', 'validated', 'approved', 'executed'])
    });

    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          error: 'ID da composição inválido',
          code: 'INVALID_COMPOSITION_ID'
        });
      }

      const { status } = updateStatusSchema.parse(req.body);
      
      const composition = await packagingCompositionService.updateCompositionStatus(
        id, 
        status, 
        req.user.id
      );
      
      res.json({
        success: true,
        data: composition
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      if (error instanceof Error && error.message.includes('não encontrada')) {
        return res.status(404).json({ 
          error: error.message,
          code: 'COMPOSITION_NOT_FOUND'
        });
      }

      console.error('Erro ao atualizar status da composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Assemble composition (create UCP from composition)
   */
  async assembleComposition(req: AuthenticatedRequest, res: Response) {
    const assembleSchema = z.object({
      compositionId: z.number().int().positive(),
      targetUcpId: z.number().int().positive()
    });

    try {
      const { compositionId, targetUcpId } = assembleSchema.parse(req.body);
      
      const result = await packagingCompositionService.assembleComposition(
        compositionId,
        targetUcpId,
        req.user.id
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('não encontrada') || error.message.includes('não encontrado')) {
          return res.status(404).json({ 
            error: error.message,
            code: 'COMPOSITION_NOT_FOUND'
          });
        }
        
        if (error.message.includes('aprovadas') || error.message.includes('insuficiente')) {
          return res.status(400).json({ 
            error: error.message,
            code: 'BUSINESS_RULE_VIOLATION'
          });
        }
      }

      console.error('Erro ao montar composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Disassemble composition
   */
  async disassembleComposition(req: AuthenticatedRequest, res: Response) {
    const disassembleSchema = z.object({
      compositionId: z.number().int().positive(),
      targetUcps: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
        ucpId: z.number().int().positive()
      }))
    });

    try {
      const { compositionId, targetUcps } = disassembleSchema.parse(req.body);
      
      const result = await packagingCompositionService.disassembleComposition(
        compositionId,
        targetUcps,
        req.user.id
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('não encontrada') || error.message.includes('não encontrado')) {
          return res.status(404).json({ 
            error: error.message,
            code: 'COMPOSITION_NOT_FOUND'
          });
        }
        
        if (error.message.includes('executadas') || error.message.includes('maior que')) {
          return res.status(400).json({ 
            error: error.message,
            code: 'BUSINESS_RULE_VIOLATION'
          });
        }
      }

      console.error('Erro ao desmontar composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Delete composition (soft delete)
   */
  async deleteComposition(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          error: 'ID da composição inválido',
          code: 'INVALID_COMPOSITION_ID'
        });
      }

      await packagingCompositionService.deleteComposition(id);
      
      // Invalidate related caches
      await Promise.all([
        compositionCacheService.invalidateProductCache(id),
        intelligentCache.invalidateByDependency('composition'),
        this.invalidateCache()
      ]);
      
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrada')) {
        return res.status(404).json({ 
          error: error.message,
          code: 'COMPOSITION_NOT_FOUND'
        });
      }
      
      console.error('Erro ao remover composição:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // CACHE MANAGEMENT ENDPOINTS

  /**
   * Get cache statistics and performance metrics
   */
  async getCacheStats(req: Request, res: Response) {
    try {
      const [compositionStats, intelligentStats] = await Promise.all([
        compositionCacheService.getCacheStats(),
        intelligentCache.getAnalytics()
      ]);

      res.json({
        success: true,
        data: {
          composition: compositionStats,
          intelligent: intelligentStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Erro ao obter estatísticas de cache:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Warm up cache with common composition requests
   */
  async warmupCache(req: Request, res: Response) {
    try {
      const { force = false } = req.query;

      const commonRequests = [
        {
          products: [{ productId: 1, quantity: 10 }],
          palletId: 1
        },
        {
          products: [
            { productId: 1, quantity: 5 },
            { productId: 2, quantity: 3 }
          ]
        }
      ];

      if (force) {
        await compositionCacheService.clearAllCompositionCache();
      }

      await compositionCacheService.preWarmCache(commonRequests);

      res.json({
        success: true,
        message: 'Cache aquecido com sucesso',
        warmedRequests: commonRequests.length,
        forced: !!force
      });
    } catch (error) {
      console.error('Erro ao aquecer cache:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Clear composition cache
   */
  async clearCache(req: Request, res: Response) {
    try {
      const { type = 'all' } = req.query;

      let clearedCount = 0;

      switch (type) {
        case 'composition':
          await compositionCacheService.clearAllCompositionCache();
          break;
        case 'intelligent':
          await intelligentCache.clear();
          break;
        case 'all':
        default:
          await Promise.all([
            compositionCacheService.clearAllCompositionCache(),
            packagingCompositionEnhancedService.invalidateCompositionCaches()
          ]);
          break;
      }

      res.json({
        success: true,
        message: `Cache ${type} limpo com sucesso`,
        clearedCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Invalidate cache by dependency
   */
  async invalidateCacheByDependency(req: Request, res: Response) {
    try {
      const { dependency } = req.params;
      const { cascade = false } = req.query;

      let invalidatedCount = 0;

      if (cascade) {
        // Cascade invalidation for related dependencies
        const relatedDependencies = this.getRelatedDependencies(dependency);
        for (const dep of [dependency, ...relatedDependencies]) {
          invalidatedCount += await intelligentCache.invalidateByDependency(dep);
        }
      } else {
        invalidatedCount = await intelligentCache.invalidateByDependency(dependency);
      }

      res.json({
        success: true,
        dependency,
        invalidatedCount,
        cascade: !!cascade,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao invalidar cache por dependência:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Performance benchmark endpoint
   */
  async performanceBenchmark(req: Request, res: Response) {
    try {
      const testRequest = {
        products: [
          { productId: 1, quantity: 10 },
          { productId: 2, quantity: 5 },
          { productId: 3, quantity: 8 }
        ],
        palletId: 1
      };

      // Benchmark standard vs enhanced algorithm
      const startStandard = Date.now();
      const standardResult = await packagingCompositionService.calculateOptimalComposition(testRequest);
      const standardTime = Date.now() - startStandard;

      const startEnhanced = Date.now();
      const enhancedResult = await packagingCompositionEnhancedService.calculateOptimalComposition(testRequest);
      const enhancedTime = Date.now() - startEnhanced;

      res.json({
        success: true,
        data: {
          standard: {
            responseTime: `${standardTime}ms`,
            efficiency: standardResult.efficiency,
            isValid: standardResult.isValid
          },
          enhanced: {
            responseTime: `${enhancedTime}ms`,
            efficiency: enhancedResult.efficiency,
            isValid: enhancedResult.isValid
          },
          comparison: {
            performanceGain: `${((standardTime - enhancedTime) / standardTime * 100).toFixed(1)}%`,
            efficiencyGain: `${((enhancedResult.efficiency - standardResult.efficiency) * 100).toFixed(1)}%`
          }
        }
      });
    } catch (error) {
      console.error('Erro no benchmark de performance:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // HELPER METHODS

  private getRelatedDependencies(dependency: string): string[] {
    const dependencyMap: Record<string, string[]> = {
      products: ['packaging_types', 'inventory', 'composition'],
      pallets: ['composition', 'warehouse_positions'],
      packaging_types: ['products', 'composition'],
      composition: ['products', 'pallets', 'packaging_types']
    };

    return dependencyMap[dependency] || [];
  }
}

export const packagingController = new PackagingController();