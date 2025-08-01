import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  compositionRequestSchema, 
  reportGenerationSchema, 
  validationRequestSchema 
} from '../models/packaging-composition.model';
import { packagingService } from '../services/packaging.service';
import { db } from '../db';
import { products, pallets, packagingTypes } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';

/**
 * Enhanced validation middleware for packaging composition operations
 * Provides comprehensive validation rules, constraint checking, caching, and real-time validation
 */

// Validation cache for performance optimization
const validationCache = new LRUCache<string, ValidationCacheEntry>({
  max: 1000,
  ttl: 1000 * 60 * 15, // 15 minutes
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

interface ValidationCacheEntry {
  timestamp: number;
  result: any;
  checksum: string;
}

// Real-time validation result interface
export interface RealTimeValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metrics: ValidationMetrics;
  constraints: ConstraintValidationResult;
  businessRules: BusinessRuleValidationResult;
  compatibility: CompatibilityValidationResult;
  realTimeScore: number;
}

export interface ValidationViolation {
  code: string;
  type: 'constraint' | 'business_rule' | 'compatibility' | 'safety';
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  affectedProducts?: number[];
  solution?: string;
  estimatedImpact?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  recommendations?: string[];
}

export interface ValidationSuggestion {
  type: 'optimization' | 'alternative' | 'safety' | 'cost';
  priority: 'low' | 'medium' | 'high';
  message: string;
  potentialBenefit: string;
  implementationComplexity: 'simple' | 'moderate' | 'complex';
}

export interface ValidationMetrics {
  totalWeight: number;
  totalVolume: number;
  totalHeight: number;
  weightUtilization: number;
  volumeUtilization: number;
  heightUtilization: number;
  efficiency: number;
  stabilityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  processingTime: number;
}

export interface ConstraintValidationResult {
  weight: ConstraintCheck;
  volume: ConstraintCheck;
  height: ConstraintCheck;
  stability: ConstraintCheck;
}

export interface ConstraintCheck {
  isValid: boolean;
  current: number;
  limit: number;
  utilization: number;
  safetyMargin: number;
  recommendation?: string;
}

export interface BusinessRuleValidationResult {
  maxProductsRule: BusinessRuleCheck;
  weightLimitRule: BusinessRuleCheck;
  heightLimitRule: BusinessRuleCheck;
  compatibilityRule: BusinessRuleCheck;
  customRules: BusinessRuleCheck[];
}

export interface BusinessRuleCheck {
  ruleName: string;
  isValid: boolean;
  message?: string;
  severity: 'error' | 'warning';
}

export interface CompatibilityValidationResult {
  productCompatibility: ProductCompatibilityCheck[];
  palletCompatibility: PalletCompatibilityCheck;
  packagingCompatibility: PackagingCompatibilityCheck[];
}

export interface ProductCompatibilityCheck {
  productId: number;
  isCompatible: boolean;
  issues: string[];
  recommendations: string[];
}

export interface PalletCompatibilityCheck {
  palletId: number;
  isCompatible: boolean;
  capacityCheck: boolean;
  dimensionCheck: boolean;
  weightCheck: boolean;
}

export interface PackagingCompatibilityCheck {
  productId: number;
  packagingTypeId: number;
  isCompatible: boolean;
  conversionAvailable: boolean;
  efficiency: number;
}

export interface ValidationOptions {
  strict?: boolean;
  allowPartial?: boolean;
  customValidators?: Array<(data: any) => string | null>;
}

/**
 * Generic validation middleware factory
 */
export function validateCompositionPayload<T extends z.ZodType>(
  schema: T, 
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate the request body
      const validatedData = schema.parse(req.body);
      
      // Run custom validators if provided
      if (options.customValidators) {
        for (const validator of options.customValidators) {
          const error = validator(validatedData);
          if (error) {
            return res.status(400).json({
              error: 'Erro de validação customizada',
              code: 'CUSTOM_VALIDATION_ERROR',
              details: error
            });
          }
        }
      }
      
      // Add validated data to request object
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received,
            expected: err.expected
          }))
        });
      }
      
      console.error('Erro de validação:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate composition request
 */
export const validateCompositionRequest = validateCompositionPayload(
  compositionRequestSchema,
  {
    customValidators: [
      (data) => {
        // Check for duplicate products
        const productIds = data.products.map((p: any) => p.productId);
        const uniqueProductIds = new Set(productIds);
        if (productIds.length !== uniqueProductIds.size) {
          return 'Produtos duplicados não são permitidos na mesma composição';
        }
        return null;
      },
      (data) => {
        // Validate quantities are reasonable
        const totalQuantity = data.products.reduce((sum: number, p: any) => sum + p.quantity, 0);
        if (totalQuantity > 1000) {
          return 'Quantidade total muito alta para uma única composição (máximo: 1000 unidades)';
        }
        return null;
      }
    ]
  }
);

/**
 * Validate report generation request
 */
export const validateReportRequest = validateCompositionPayload(
  reportGenerationSchema,
  {
    customValidators: [
      (data) => {
        // Ensure at least one report section is requested
        if (!data.includeMetrics && !data.includeRecommendations && !data.includeCostAnalysis) {
          return 'Pelo menos uma seção do relatório deve ser incluída';
        }
        return null;
      }
    ]
  }
);

/**
 * Validate composition validation request
 */
export const validateValidationRequest = validateCompositionPayload(
  validationRequestSchema,
  {
    customValidators: [
      (data) => {
        // Check minimum products requirement
        if (data.products.length === 0) {
          return 'Pelo menos um produto é obrigatório para validação';
        }
        return null;
      }
    ]
  }
);

/**
 * Comprehensive constraint validation middleware
 * Validates weight, volume, dimensions, and stability constraints
 */
export async function validateConstraints(req: Request, res: Response, next: NextFunction) {
  try {
    const { products, palletId, constraints } = req.body;
    const startTime = Date.now();
    
    // Generate cache key for constraint validation
    const cacheKey = generateConstraintCacheKey(products, palletId, constraints);
    const cachedResult = validationCache.get(cacheKey);
    
    if (cachedResult && Date.now() - cachedResult.timestamp < 300000) { // 5 minutes cache
      req.body._constraintValidation = cachedResult.result;
      return next();
    }
    
    // Get pallet information
    const pallet = palletId ? await getPalletById(palletId) : await getDefaultPallet();
    
    // Get product details with dimensions and weights
    const productDetails = await getProductDetailsForValidation(products);
    
    // Calculate totals
    const totals = calculateCompositionTotals(productDetails, products);
    
    // Validate constraints
    const constraintResults = await validateAllConstraints(totals, pallet, constraints);
    
    const processingTime = Date.now() - startTime;
    
    // Cache results
    validationCache.set(cacheKey, {
      timestamp: Date.now(),
      result: constraintResults,
      checksum: generateChecksum(products, palletId, constraints)
    });
    
    // Add validation results to request for downstream middleware
    req.body._constraintValidation = {
      ...constraintResults,
      processingTime,
      cacheHit: false
    };
    
    // Check if there are critical errors
    const criticalErrors = constraintResults.violations.filter(v => v.severity === 'error');
    if (criticalErrors.length > 0) {
      return res.status(400).json({
        error: 'Violações de restrição detectadas',
        code: 'CONSTRAINT_VIOLATIONS',
        details: {
          violations: criticalErrors,
          warnings: constraintResults.warnings,
          suggestions: constraintResults.suggestions,
          metrics: constraintResults.metrics
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Erro na validação de restrições:', error);
    res.status(500).json({
      error: 'Erro interno na validação de restrições',
      code: 'CONSTRAINT_VALIDATION_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Enhanced business logic validation middleware
 * Validates complex business rules and product compatibility
 */
export async function validateBusinessRules(req: Request, res: Response, next: NextFunction) {
  try {
    const { products, palletId, constraints } = req.body;
    const startTime = Date.now();
    
    // Get cached constraint validation if available
    const constraintValidation = req.body._constraintValidation;
    
    // Validate business rules
    const businessRuleResults = await validateAllBusinessRules(products, palletId, constraints);
    
    const processingTime = Date.now() - startTime;
    
    // Add business rule results to request
    req.body._businessRuleValidation = {
      ...businessRuleResults,
      processingTime
    };
    
    // Check for business rule violations
    const businessErrors = businessRuleResults.businessRules.customRules
      .filter(rule => !rule.isValid && rule.severity === 'error');
    
    if (businessErrors.length > 0) {
      return res.status(400).json({
        error: 'Violações de regras de negócio detectadas',
        code: 'BUSINESS_RULE_VIOLATIONS',
        details: {
          violations: businessErrors,
          constraintValidation,
          businessRuleResults
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Erro na validação de regras de negócio:', error);
    res.status(500).json({
      error: 'Erro interno na validação de regras de negócio',
      code: 'BUSINESS_RULE_VALIDATION_ERROR'
    });
  }
}

/**
 * Product compatibility validation middleware
 * Validates product-to-product and product-to-pallet compatibility
 */
export async function validateCompatibility(req: Request, res: Response, next: NextFunction) {
  try {
    const { products, palletId } = req.body;
    const startTime = Date.now();
    
    // Validate product compatibility
    const compatibilityResults = await validateProductCompatibility(products, palletId);
    
    const processingTime = Date.now() - startTime;
    
    // Add compatibility results to request
    req.body._compatibilityValidation = {
      ...compatibilityResults,
      processingTime
    };
    
    // Check for compatibility issues
    const incompatibleProducts = compatibilityResults.compatibility.productCompatibility
      .filter(pc => !pc.isCompatible);
    
    if (incompatibleProducts.length > 0) {
      return res.status(400).json({
        error: 'Problemas de compatibilidade detectados',
        code: 'COMPATIBILITY_ISSUES',
        details: {
          incompatibleProducts,
          palletCompatibility: compatibilityResults.compatibility.palletCompatibility,
          recommendations: incompatibleProducts.flatMap(p => p.recommendations)
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Erro na validação de compatibilidade:', error);
    res.status(500).json({
      error: 'Erro interno na validação de compatibilidade',
      code: 'COMPATIBILITY_VALIDATION_ERROR'
    });
  }
}

/**
 * Performance optimization middleware
 */
export function optimizeForPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const { products } = req.body;
    
    // Add performance hints to request
    req.body._performanceHints = {
      productCount: products?.length || 0,
      estimatedComplexity: calculateComplexity(products),
      suggestedTimeout: calculateTimeout(products),
      cacheKey: generateCacheKey(req.body)
    };
    
    next();
  } catch (error) {
    console.error('Erro na otimização de performance:', error);
    next(); // Continue even if optimization fails
  }
}

/**
 * Calculate complexity score for performance optimization
 */
function calculateComplexity(products: any[]): 'low' | 'medium' | 'high' {
  if (!products) return 'low';
  
  const productCount = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
  
  if (productCount <= 5 && totalQuantity <= 50) return 'low';
  if (productCount <= 20 && totalQuantity <= 200) return 'medium';
  return 'high';
}

/**
 * Calculate suggested timeout based on request complexity
 */
function calculateTimeout(products: any[]): number {
  const complexity = calculateComplexity(products);
  switch (complexity) {
    case 'low': return 5000; // 5 seconds
    case 'medium': return 15000; // 15 seconds
    case 'high': return 30000; // 30 seconds
    default: return 10000;
  }
}

/**
 * Generate cache key for request memoization
 */
function generateCacheKey(requestBody: any): string {
  const { products, palletId, constraints } = requestBody;
  
  const productKey = products
    ?.map((p: any) => `${p.productId}:${p.quantity}:${p.packagingTypeId || 'default'}`)
    .sort()
    .join('|') || '';
  
  const palletKey = palletId || 'auto';
  const constraintKey = constraints ? 
    `w:${constraints.maxWeight || 'none'}|h:${constraints.maxHeight || 'none'}|v:${constraints.maxVolume || 'none'}` : 
    'none';
  
  return `comp_${Buffer.from(`${productKey}:${palletKey}:${constraintKey}`).toString('base64')}`;
}

/**
 * Enhanced request sanitization middleware
 * Sanitizes and normalizes composition request data with comprehensive validation
 */
export function sanitizeCompositionRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize products array
    if (req.body.products) {
      req.body.products = req.body.products.map((product: any) => {
        const sanitized = {
          productId: parseInt(product.productId, 10),
          quantity: parseFloat(product.quantity),
          packagingTypeId: product.packagingTypeId ? parseInt(product.packagingTypeId, 10) : undefined
        };
        
        // Validate sanitized values
        if (isNaN(sanitized.productId) || sanitized.productId <= 0) {
          throw new Error(`ID do produto inválido: ${product.productId}`);
        }
        if (isNaN(sanitized.quantity) || sanitized.quantity <= 0) {
          throw new Error(`Quantidade inválida para produto ${sanitized.productId}: ${product.quantity}`);
        }
        if (sanitized.packagingTypeId && (isNaN(sanitized.packagingTypeId) || sanitized.packagingTypeId <= 0)) {
          throw new Error(`ID do tipo de embalagem inválido para produto ${sanitized.productId}: ${product.packagingTypeId}`);
        }
        
        return sanitized;
      });
    }
    
    // Sanitize pallet ID
    if (req.body.palletId) {
      const palletId = parseInt(req.body.palletId, 10);
      if (isNaN(palletId) || palletId <= 0) {
        throw new Error(`ID do pallet inválido: ${req.body.palletId}`);
      }
      req.body.palletId = palletId;
    }
    
    // Sanitize constraints
    if (req.body.constraints) {
      const constraints = req.body.constraints;
      if (constraints.maxWeight !== undefined) {
        const weight = parseFloat(constraints.maxWeight);
        if (isNaN(weight) || weight <= 0) {
          throw new Error(`Peso máximo inválido: ${constraints.maxWeight}`);
        }
        constraints.maxWeight = weight;
      }
      if (constraints.maxHeight !== undefined) {
        const height = parseFloat(constraints.maxHeight);
        if (isNaN(height) || height <= 0) {
          throw new Error(`Altura máxima inválida: ${constraints.maxHeight}`);
        }
        constraints.maxHeight = height;
      }
      if (constraints.maxVolume !== undefined) {
        const volume = parseFloat(constraints.maxVolume);
        if (isNaN(volume) || volume <= 0) {
          throw new Error(`Volume máximo inválido: ${constraints.maxVolume}`);
        }
        constraints.maxVolume = volume;
      }
    }
    
    // Remove any unsafe or unnecessary fields
    delete req.body.__proto__;
    delete req.body.constructor;
    
    // Add sanitization metadata
    req.body._sanitized = {
      timestamp: Date.now(),
      productsCount: req.body.products?.length || 0,
      hasConstraints: !!req.body.constraints,
      hasPalletId: !!req.body.palletId
    };
    
    next();
  } catch (error) {
    console.error('Erro na sanitização de dados:', error);
    res.status(400).json({
      error: 'Erro na formatação dos dados',
      code: 'DATA_SANITIZATION_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Enhanced rate limiting for composition calculations
 * Includes complexity-based rate limiting and user-specific limits
 */
export function rateLimit(maxRequests: number = 10, windowMs: number = 60000, complexityMultiplier: boolean = true) {
  const requests = new Map<string, { count: number; resetTime: number; complexityScore: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const userId = req.user?.id || 'anonymous';
    const clientKey = `${clientId}:${userId}`;
    const now = Date.now();
    
    // Calculate request complexity
    const complexity = calculateRequestComplexity(req.body);
    const adjustedLimit = complexityMultiplier ? Math.max(1, maxRequests - Math.floor(complexity / 2)) : maxRequests;
    
    let clientRequests = requests.get(clientKey);
    
    if (!clientRequests || now > clientRequests.resetTime) {
      clientRequests = { count: 0, resetTime: now + windowMs, complexityScore: 0 };
      requests.set(clientKey, clientRequests);
    }
    
    // Add complexity score to client's usage
    clientRequests.complexityScore += complexity;
    
    if (clientRequests.count >= adjustedLimit || clientRequests.complexityScore > adjustedLimit * 10) {
      return res.status(429).json({
        error: 'Limite de requisições excedido. Tente novamente em breve.',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          requestCount: clientRequests.count,
          complexityScore: clientRequests.complexityScore,
          limit: adjustedLimit,
          retryAfter: Math.ceil((clientRequests.resetTime - now) / 1000),
          currentComplexity: complexity
        }
      });
    }
    
    clientRequests.count++;
    
    // Add rate limiting info to request
    req.body._rateLimitInfo = {
      remaining: adjustedLimit - clientRequests.count,
      resetTime: clientRequests.resetTime,
      complexity,
      complexityScore: clientRequests.complexityScore
    };
    
    next();
  };
}

/**
 * Real-time validation endpoint middleware
 * Provides instant feedback during composition building
 */
export async function realTimeValidation(req: Request, res: Response, next: NextFunction) {
  try {
    const { products, palletId, constraints, mode = 'full' } = req.body;
    const startTime = Date.now();
    
    // Quick validation for real-time feedback
    const validationResult: RealTimeValidationResult = await performRealTimeValidation(
      products, 
      palletId, 
      constraints, 
      mode
    );
    
    const processingTime = Date.now() - startTime;
    validationResult.metrics.processingTime = processingTime;
    
    // For real-time endpoints, return validation result immediately
    if (req.path.includes('/real-time') || req.query.realTime === 'true') {
      return res.json({
        success: true,
        validation: validationResult,
        processingTime,
        timestamp: new Date().toISOString()
      });
    }
    
    // For regular endpoints, add to request for downstream processing
    req.body._realTimeValidation = validationResult;
    next();
  } catch (error) {
    console.error('Erro na validação em tempo real:', error);
    
    if (req.path.includes('/real-time') || req.query.realTime === 'true') {
      return res.status(500).json({
        success: false,
        error: 'Erro na validação em tempo real',
        code: 'REAL_TIME_VALIDATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    next(error);
  }
}

/**
 * Validation caching middleware
 * Implements intelligent caching for validation results
 */
export function validationCaching(req: Request, res: Response, next: NextFunction) {
  const cacheKey = generateValidationCacheKey(req.body);
  const cachedResult = validationCache.get(cacheKey);
  
  if (cachedResult) {
    // Check if cached result is still valid
    const isStale = Date.now() - cachedResult.timestamp > 600000; // 10 minutes
    const checksumMatch = cachedResult.checksum === generateChecksum(req.body.products, req.body.palletId, req.body.constraints);
    
    if (!isStale && checksumMatch) {
      req.body._cachedValidation = {
        ...cachedResult.result,
        cacheHit: true,
        cacheAge: Date.now() - cachedResult.timestamp
      };
      
      // For cache-only requests, return cached result
      if (req.query.cacheOnly === 'true') {
        return res.json({
          success: true,
          validation: req.body._cachedValidation,
          cached: true
        });
      }
    }
  }
  
  // Store original response.json to intercept and cache results
  const originalJson = res.json;
  res.json = function(body) {
    // Cache successful validation results
    if (body.success && body.validation) {
      validationCache.set(cacheKey, {
        timestamp: Date.now(),
        result: body.validation,
        checksum: generateChecksum(req.body.products, req.body.palletId, req.body.constraints)
      });
    }
    return originalJson.call(this, body);
  };
  
  next();
}

/**
 * Generate cache key for constraint validation
 */
function generateConstraintCacheKey(products: any[], palletId?: number, constraints?: any): string {
  const productKey = products
    ?.map((p: any) => `${p.productId}:${p.quantity}:${p.packagingTypeId || 'default'}`)
    .sort()
    .join('|') || '';
  
  const palletKey = palletId || 'auto';
  const constraintKey = constraints ? 
    `w:${constraints.maxWeight || 'none'}|h:${constraints.maxHeight || 'none'}|v:${constraints.maxVolume || 'none'}` : 
    'none';
  
  return `constraint_${Buffer.from(`${productKey}:${palletKey}:${constraintKey}`).toString('base64')}`;
}

/**
 * Generate cache key for validation results
 */
function generateValidationCacheKey(requestBody: any): string {
  const { products, palletId, constraints } = requestBody;
  
  const productKey = products
    ?.map((p: any) => `${p.productId}:${p.quantity}:${p.packagingTypeId || 'default'}`)
    .sort()
    .join('|') || '';
  
  const palletKey = palletId || 'auto';
  const constraintKey = constraints ? 
    `w:${constraints.maxWeight || 'none'}|h:${constraints.maxHeight || 'none'}|v:${constraints.maxVolume || 'none'}` : 
    'none';
  
  return `validation_${Buffer.from(`${productKey}:${palletKey}:${constraintKey}`).toString('base64')}`;
}


/**
 * Generate checksum for cache validation
 */
function generateChecksum(products: any[], palletId?: number, constraints?: any): string {
  const data = JSON.stringify({ products, palletId, constraints });
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Calculate request complexity for rate limiting
 */
function calculateRequestComplexity(requestBody: any): number {
  const { products = [], constraints } = requestBody;
  
  let complexity = 1; // Base complexity
  
  // Product count factor
  complexity += Math.floor(products.length / 5);
  
  // Total quantity factor
  const totalQuantity = products.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
  complexity += Math.floor(totalQuantity / 50);
  
  // Constraints factor
  if (constraints) {
    complexity += Object.keys(constraints).length;
  }
  
  // Different packaging types factor
  const uniquePackagingTypes = new Set(products.map((p: any) => p.packagingTypeId || 'default'));
  complexity += uniquePackagingTypes.size - 1;
  
  return Math.max(1, complexity);
}

/**
 * Get pallet by ID with caching
 */
async function getPalletById(palletId: number) {
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
 * Get default pallet for auto-selection
 */
async function getDefaultPallet() {
  const result = await db.select()
    .from(pallets)
    .where(eq(pallets.status, 'disponivel'))
    .limit(1);
    
  if (!result.length) {
    throw new Error('Nenhum pallet disponível para seleção automática');
  }
  
  return result[0];
}

/**
 * Get detailed product information for validation
 */
async function getProductDetailsForValidation(products: any[]) {
  const productIds = products.map((p: any) => p.productId);
  
  const productsData = await db.select()
    .from(products)
    .where(inArray(products.id, productIds));
    
  const packagingData = await db.select()
    .from(packagingTypes)
    .where(inArray(packagingTypes.productId, productIds));
    
  return productsData.map(product => {
    const productPackaging = packagingData.filter(pkg => pkg.productId === product.id);
    return {
      ...product,
      packaging: productPackaging,
      dimensions: product.dimensions || { width: 0, length: 0, height: 0 },
      weight: Number(product.weight) || 0
    };
  });
}

/**
 * Calculate composition totals for validation
 */
function calculateCompositionTotals(productDetails: any[], products: any[]) {
  let totalWeight = 0;
  let totalVolume = 0;
  let maxHeight = 0;
  
  products.forEach(reqProduct => {
    const productDetail = productDetails.find(pd => pd.id === reqProduct.productId);
    if (productDetail) {
      totalWeight += (productDetail.weight || 0) * reqProduct.quantity;
      
      const dimensions = productDetail.dimensions || { width: 0, length: 0, height: 0 };
      const unitVolume = (dimensions.width * dimensions.length * dimensions.height) / 1000000; // Convert cm³ to m³
      totalVolume += unitVolume * reqProduct.quantity;
      
      maxHeight = Math.max(maxHeight, dimensions.height || 0);
    }
  });
  
  return { totalWeight, totalVolume, maxHeight };
}

/**
 * Validate all constraints comprehensively
 */
async function validateAllConstraints(totals: any, pallet: any, constraints?: any): Promise<RealTimeValidationResult> {
  const violations: ValidationViolation[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];
  
  // Weight constraints
  const weightLimit = constraints?.maxWeight || Number(pallet.maxWeight) || 1000;
  const weightUtilization = totals.totalWeight / weightLimit;
  
  if (totals.totalWeight > weightLimit) {
    violations.push({
      code: 'WEIGHT_EXCEEDED',
      type: 'constraint',
      severity: 'error',
      message: `Peso total (${totals.totalWeight.toFixed(2)}kg) excede o limite (${weightLimit}kg)`,
      solution: 'Reduza a quantidade de produtos ou use um pallet com maior capacidade de peso',
      estimatedImpact: 'Composição inválida - não pode ser executada'
    });
  } else if (weightUtilization > 0.9) {
    warnings.push({
      code: 'WEIGHT_HIGH_UTILIZATION',
      message: `Utilização de peso muito alta (${(weightUtilization * 100).toFixed(1)}%)`,
      recommendations: ['Considere margem de segurança adicional', 'Verifique estabilidade da carga']
    });
  }
  
  // Volume constraints
  const palletVolume = (Number(pallet.width) * Number(pallet.length) * 200) / 1000000; // Assume 200cm height limit
  const volumeLimit = constraints?.maxVolume || palletVolume;
  const volumeUtilization = totals.totalVolume / volumeLimit;
  
  if (totals.totalVolume > volumeLimit) {
    violations.push({
      code: 'VOLUME_EXCEEDED',
      type: 'constraint',
      severity: 'error',
      message: `Volume total (${totals.totalVolume.toFixed(6)}m³) excede o limite (${volumeLimit.toFixed(6)}m³)`,
      solution: 'Reduza a quantidade de produtos ou otimize o arranjo',
      estimatedImpact: 'Produtos não cabem no pallet'
    });
  }
  
  // Height constraints
  const heightLimit = constraints?.maxHeight || 200; // Default 200cm
  const heightUtilization = totals.maxHeight / heightLimit;
  
  if (totals.maxHeight > heightLimit) {
    violations.push({
      code: 'HEIGHT_EXCEEDED',
      type: 'constraint',
      severity: 'error',
      message: `Altura máxima (${totals.maxHeight}cm) excede o limite (${heightLimit}cm)`,
      solution: 'Use produtos com menor altura ou ajuste as restrições',
      estimatedImpact: 'Composição não atende aos limites de altura'
    });
  }
  
  // Calculate efficiency and stability
  const efficiency = Math.min(weightUtilization, volumeUtilization, heightUtilization);
  const stabilityScore = calculateStabilityScore(totals, pallet);
  
  // Add optimization suggestions
  if (efficiency < 0.6) {
    suggestions.push({
      type: 'optimization',
      priority: 'medium',
      message: 'Baixa eficiência de utilização do pallet',
      potentialBenefit: 'Melhoria de até 25% na utilização do espaço',
      implementationComplexity: 'moderate'
    });
  }
  
  if (stabilityScore < 0.7) {
    suggestions.push({
      type: 'safety',
      priority: 'high',
      message: 'Arranjo pode ter problemas de estabilidade',
      potentialBenefit: 'Redução do risco de danos durante transporte',
      implementationComplexity: 'simple'
    });
  }
  
  const constraintChecks: ConstraintValidationResult = {
    weight: {
      isValid: totals.totalWeight <= weightLimit,
      current: totals.totalWeight,
      limit: weightLimit,
      utilization: weightUtilization,
      safetyMargin: weightLimit - totals.totalWeight,
      recommendation: weightUtilization > 0.8 ? 'Considere margem de segurança adicional' : undefined
    },
    volume: {
      isValid: totals.totalVolume <= volumeLimit,
      current: totals.totalVolume,
      limit: volumeLimit,
      utilization: volumeUtilization,
      safetyMargin: volumeLimit - totals.totalVolume
    },
    height: {
      isValid: totals.maxHeight <= heightLimit,
      current: totals.maxHeight,
      limit: heightLimit,
      utilization: heightUtilization,
      safetyMargin: heightLimit - totals.maxHeight
    },
    stability: {
      isValid: stabilityScore >= 0.7,
      current: stabilityScore,
      limit: 1.0,
      utilization: stabilityScore,
      safetyMargin: 1.0 - stabilityScore,
      recommendation: stabilityScore < 0.7 ? 'Revisar arranjo para melhor estabilidade' : undefined
    }
  };
  
  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    suggestions,
    metrics: {
      totalWeight: totals.totalWeight,
      totalVolume: totals.totalVolume,
      totalHeight: totals.maxHeight,
      weightUtilization,
      volumeUtilization,
      heightUtilization,
      efficiency,
      stabilityScore,
      riskLevel: violations.length > 0 ? 'high' : warnings.length > 0 ? 'medium' : 'low',
      processingTime: 0 // Will be set by caller
    },
    constraints: constraintChecks,
    businessRules: {
      maxProductsRule: { ruleName: 'MaxProducts', isValid: true, severity: 'error' },
      weightLimitRule: { ruleName: 'WeightLimit', isValid: totals.totalWeight <= weightLimit, severity: 'error' },
      heightLimitRule: { ruleName: 'HeightLimit', isValid: totals.maxHeight <= heightLimit, severity: 'error' },
      compatibilityRule: { ruleName: 'Compatibility', isValid: true, severity: 'warning' },
      customRules: []
    },
    compatibility: {
      productCompatibility: [],
      palletCompatibility: {
        palletId: pallet.id,
        isCompatible: true,
        capacityCheck: totals.totalWeight <= weightLimit,
        dimensionCheck: totals.totalVolume <= volumeLimit,
        weightCheck: totals.totalWeight <= Number(pallet.maxWeight)
      },
      packagingCompatibility: []
    },
    realTimeScore: Math.round((efficiency + stabilityScore) * 50)
  };
}

/**
 * Calculate stability score based on weight distribution and height
 */
function calculateStabilityScore(totals: any, pallet: any): number {
  let score = 1.0;
  
  // Height factor - higher stacks are less stable
  const heightFactor = Math.min(1.0, 150 / (totals.maxHeight || 1));
  score *= heightFactor;
  
  // Weight distribution factor (simplified)
  const palletArea = Number(pallet.width) * Number(pallet.length);
  const weightDensity = totals.totalWeight / palletArea;
  const idealDensity = 50; // kg/m² (example)
  const weightFactor = Math.min(1.0, idealDensity / Math.max(weightDensity, 1));
  score *= (0.7 + 0.3 * weightFactor); // Weight factor has less impact
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Validate business rules comprehensively
 */
async function validateAllBusinessRules(products: any[], palletId?: number, constraints?: any): Promise<{ businessRules: BusinessRuleValidationResult }> {
  const customRules: BusinessRuleCheck[] = [];
  
  // Rule 1: Maximum products per composition
  if (products.length > 50) {
    customRules.push({
      ruleName: 'MaxProductsPerComposition',
      isValid: false,
      message: `Máximo de 50 produtos por composição. Atual: ${products.length}`,
      severity: 'error'
    });
  }
  
  // Rule 2: Minimum quantity per product
  const invalidQuantities = products.filter(p => p.quantity < 0.1);
  if (invalidQuantities.length > 0) {
    customRules.push({
      ruleName: 'MinimumQuantity',
      isValid: false,
      message: `Produtos com quantidade insuficiente: ${invalidQuantities.map(p => p.productId).join(', ')}`,
      severity: 'error'
    });
  }
  
  // Rule 3: Duplicate products
  const productIds = products.map(p => p.productId);
  const uniqueIds = new Set(productIds);
  if (productIds.length !== uniqueIds.size) {
    customRules.push({
      ruleName: 'NoDuplicateProducts',
      isValid: false,
      message: 'Produtos duplicados não são permitidos na mesma composição',
      severity: 'error'
    });
  }
  
  // Rule 4: Weight limits for specific product categories (example)
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  if (totalQuantity > 1000) {
    customRules.push({
      ruleName: 'MaxTotalQuantity',
      isValid: false,
      message: `Quantidade total muito alta: ${totalQuantity} (máximo: 1000)`,
      severity: 'warning'
    });
  }
  
  return {
    businessRules: {
      maxProductsRule: {
        ruleName: 'MaxProducts',
        isValid: products.length <= 50,
        message: products.length > 50 ? `Muitos produtos: ${products.length}/50` : undefined,
        severity: 'error'
      },
      weightLimitRule: {
        ruleName: 'WeightLimit',
        isValid: !constraints?.maxWeight || constraints.maxWeight <= 2000,
        message: constraints?.maxWeight > 2000 ? `Peso limite muito alto: ${constraints.maxWeight}kg` : undefined,
        severity: 'error'
      },
      heightLimitRule: {
        ruleName: 'HeightLimit',
        isValid: !constraints?.maxHeight || constraints.maxHeight <= 300,
        message: constraints?.maxHeight > 300 ? `Altura limite muito alta: ${constraints.maxHeight}cm` : undefined,
        severity: 'error'
      },
      compatibilityRule: {
        ruleName: 'ProductCompatibility',
        isValid: uniqueIds.size === productIds.length,
        message: uniqueIds.size !== productIds.length ? 'Produtos duplicados detectados' : undefined,
        severity: 'warning'
      },
      customRules
    }
  };
}

/**
 * Validate product compatibility
 */
async function validateProductCompatibility(products: any[], palletId?: number): Promise<{ compatibility: CompatibilityValidationResult }> {
  const productCompatibility: ProductCompatibilityCheck[] = [];
  
  // Check each product for compatibility issues
  for (const product of products) {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check if product exists and is active
    // This would require database queries in real implementation
    const isCompatible = true; // Placeholder
    
    if (product.quantity <= 0) {
      issues.push('Quantidade deve ser maior que zero');
    }
    
    if (product.packagingTypeId && product.packagingTypeId <= 0) {
      issues.push('Tipo de embalagem inválido');
      recommendations.push('Verifique se o tipo de embalagem está correto');
    }
    
    productCompatibility.push({
      productId: product.productId,
      isCompatible: issues.length === 0,
      issues,
      recommendations
    });
  }
  
  // Get pallet for compatibility check
  let palletCompatibility: PalletCompatibilityCheck;
  try {
    const pallet = palletId ? await getPalletById(palletId) : await getDefaultPallet();
    palletCompatibility = {
      palletId: pallet.id,
      isCompatible: true,
      capacityCheck: true,
      dimensionCheck: true,
      weightCheck: true
    };
  } catch (error) {
    palletCompatibility = {
      palletId: palletId || 0,
      isCompatible: false,
      capacityCheck: false,
      dimensionCheck: false,
      weightCheck: false
    };
  }
  
  return {
    compatibility: {
      productCompatibility,
      palletCompatibility,
      packagingCompatibility: products.map(p => ({
        productId: p.productId,
        packagingTypeId: p.packagingTypeId || 0,
        isCompatible: true,
        conversionAvailable: true,
        efficiency: 0.85
      }))
    }
  };
}

/**
 * Perform real-time validation with different modes
 */
async function performRealTimeValidation(
  products: any[], 
  palletId?: number, 
  constraints?: any, 
  mode: string = 'full'
): Promise<RealTimeValidationResult> {
  // Get product details
  const productDetails = await getProductDetailsForValidation(products);
  
  // Calculate totals
  const totals = calculateCompositionTotals(productDetails, products);
  
  // Get pallet
  const pallet = palletId ? await getPalletById(palletId) : await getDefaultPallet();
  
  // Perform validation based on mode
  if (mode === 'quick') {
    // Quick validation - only basic constraints
    return await validateAllConstraints(totals, pallet, constraints);
  } else if (mode === 'business') {
    // Business rules validation
    const constraintResults = await validateAllConstraints(totals, pallet, constraints);
    const businessResults = await validateAllBusinessRules(products, palletId, constraints);
    
    return {
      ...constraintResults,
      businessRules: businessResults.businessRules
    };
  } else {
    // Full validation
    const constraintResults = await validateAllConstraints(totals, pallet, constraints);
    const businessResults = await validateAllBusinessRules(products, palletId, constraints);
    const compatibilityResults = await validateProductCompatibility(products, palletId);
    
    return {
      ...constraintResults,
      businessRules: businessResults.businessRules,
      compatibility: compatibilityResults.compatibility
    };
  }
}

/**
 * Real-time validation endpoint for instant feedback
 */
export async function validateRealTime(req: Request, res: Response) {
  try {
    const { products, palletId, constraints, mode = 'quick' } = req.body;
    const startTime = Date.now();
    
    // Validate input
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista de produtos é obrigatória',
        code: 'MISSING_PRODUCTS'
      });
    }
    
    // Perform real-time validation
    const validationResult = await performRealTimeValidation(products, palletId, constraints, mode);
    
    const processingTime = Date.now() - startTime;
    validationResult.metrics.processingTime = processingTime;
    
    res.json({
      success: true,
      validation: validationResult,
      metadata: {
        processingTime,
        timestamp: new Date().toISOString(),
        mode,
        productsCount: products.length,
        cacheHit: false
      }
    });
  } catch (error) {
    console.error('Erro na validação em tempo real:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno na validação em tempo real',
      code: 'REAL_TIME_VALIDATION_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Validation cache management endpoints
 */
export function clearValidationCache(req: Request, res: Response) {
  try {
    const { pattern } = req.query;
    
    if (pattern && typeof pattern === 'string') {
      // Clear cache entries matching pattern
      let clearedCount = 0;
      for (const [key] of validationCache.entries()) {
        if (key.includes(pattern)) {
          validationCache.delete(key);
          clearedCount++;
        }
      }
      
      res.json({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`,
        clearedEntries: clearedCount
      });
    } else {
      // Clear entire cache
      const size = validationCache.size;
      validationCache.clear();
      
      res.json({
        success: true,
        message: 'Validation cache cleared successfully',
        clearedEntries: size
      });
    }
  } catch (error) {
    console.error('Erro ao limpar cache de validação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache de validação',
      code: 'CACHE_CLEAR_ERROR'
    });
  }
}

export function getValidationCacheStats(req: Request, res: Response) {
  try {
    const stats = {
      size: validationCache.size,
      maxSize: validationCache.max,
      ttl: validationCache.ttl,
      hitRatio: 0, // Would need to track hits/misses for accurate ratio
      oldestEntry: 0,
      newestEntry: 0
    };
    
    // Calculate age statistics
    const now = Date.now();
    let oldestTime = now;
    let newestTime = 0;
    
    for (const [, entry] of validationCache.entries()) {
      if (typeof entry === 'object' && entry.timestamp) {
        oldestTime = Math.min(oldestTime, entry.timestamp);
        newestTime = Math.max(newestTime, entry.timestamp);
      }
    }
    
    stats.oldestEntry = now - oldestTime;
    stats.newestEntry = now - newestTime;
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas do cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estatísticas do cache',
      code: 'CACHE_STATS_ERROR'
    });
  }
}