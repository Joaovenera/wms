import { z } from "zod";

// Zod schemas for packaging composition validation
export const compositionProductSchema = z.object({
  productId: z.number().int().positive("ID do produto deve ser um número positivo"),
  quantity: z.number().positive("Quantidade deve ser positiva"),
  packagingTypeId: z.number().int().positive().optional()
});

export const compositionConstraintsSchema = z.object({
  maxWeight: z.number().positive().optional(),
  maxHeight: z.number().positive().optional(),
  maxVolume: z.number().positive().optional()
});

export const compositionRequestSchema = z.object({
  products: z.array(compositionProductSchema).min(1, "Pelo menos um produto é obrigatório"),
  palletId: z.number().int().positive().optional(),
  constraints: compositionConstraintsSchema.optional()
});

export const reportGenerationSchema = z.object({
  compositionId: z.number().int().positive("ID da composição deve ser um número positivo"),
  includeMetrics: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
  includeCostAnalysis: z.boolean().default(false)
});

export const validationRequestSchema = z.object({
  products: z.array(compositionProductSchema),
  palletId: z.number().int().positive("ID do pallet é obrigatório")
});

// Type definitions for composition entities
export interface PackagingComposition {
  id: number;
  name: string;
  description?: string;
  products: CompositionProduct[];
  palletId: number;
  constraints?: CompositionConstraints;
  result: CompositionResult;
  status: 'draft' | 'validated' | 'approved' | 'executed';
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface CompositionResult {
  isValid: boolean;
  efficiency: number;
  layout: LayoutConfiguration;
  weight: WeightCalculation;
  volume: VolumeCalculation;
  height: HeightCalculation;
  recommendations: string[];
  warnings: string[];
  products: CompositionProductResult[];
}

export interface LayoutConfiguration {
  layers: number;
  itemsPerLayer: number;
  totalItems: number;
  arrangement: ProductArrangement[];
  stability: {
    score: number;
    factors: StabilityFactor[];
  };
}

export interface ProductArrangement {
  productId: number;
  packagingTypeId: number;
  quantity: number;
  position: Position3D;
  dimensions: Dimensions3D;
  supportedBy?: ProductArrangement[];
  supports?: ProductArrangement[];
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Dimensions3D {
  width: number;
  length: number;
  height: number;
}

export interface StabilityFactor {
  type: 'weight_distribution' | 'stacking_height' | 'base_support' | 'center_gravity';
  score: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface WeightCalculation {
  total: number;
  limit: number;
  utilization: number;
  distribution: WeightDistribution;
}

export interface VolumeCalculation {
  total: number;
  limit: number;
  utilization: number;
  efficiency: number;
}

export interface HeightCalculation {
  total: number;
  limit: number;
  utilization: number;
  layers: LayerInfo[];
}

export interface WeightDistribution {
  centerOfGravity: Position3D;
  heaviestQuadrant: number;
  lightestQuadrant: number;
  balanceScore: number;
}

export interface LayerInfo {
  level: number;
  height: number;
  weight: number;
  items: number;
  stability: number;
}

export interface CompositionProductResult {
  productId: number;
  packagingTypeId: number;
  quantity: number;
  totalWeight: number;
  totalVolume: number;
  efficiency: number;
  canFit: boolean;
  issues: ProductIssue[];
  recommendations: ProductRecommendation[];
}

export interface ProductIssue {
  type: 'weight' | 'size' | 'compatibility' | 'stability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  solution?: string;
}

export interface ProductRecommendation {
  type: 'packaging' | 'positioning' | 'quantity' | 'alternative';
  priority: 'low' | 'medium' | 'high';
  message: string;
  impact: string;
  implementationCost?: number;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warnings: string[];
  metrics: ValidationMetrics;
  suggestions: ValidationSuggestion[];
}

export interface ValidationViolation {
  type: 'weight' | 'volume' | 'height' | 'compatibility' | 'stability';
  severity: 'error' | 'warning';
  message: string;
  affectedProducts: number[];
  solution?: string;
  estimatedImpact?: string;
}

export interface ValidationMetrics {
  totalWeight: number;
  totalVolume: number;
  totalHeight: number;
  efficiency: number;
  stabilityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ValidationSuggestion {
  type: 'optimization' | 'alternative' | 'safety';
  priority: 'low' | 'medium' | 'high';
  message: string;
  potentialBenefit: string;
  implementationComplexity: 'simple' | 'moderate' | 'complex';
}

// Report types
export interface CompositionReport {
  id: number;
  compositionId: number;
  timestamp: Date;
  composition: CompositionResult;
  metrics: ReportMetrics;
  recommendations: RecommendationItem[];
  costAnalysis?: CostAnalysis;
  executiveSummary: ExecutiveSummary;
}

export interface ReportMetrics {
  spaceUtilization: number;
  weightUtilization: number;
  heightUtilization: number;
  overallEfficiency: number;
  stabilityScore: number;
  riskAssessment: RiskAssessment;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  mitigation: string[];
}

export interface RiskFactor {
  type: 'structural' | 'operational' | 'safety' | 'cost';
  severity: number; // 1-10 scale
  description: string;
  probability: number; // 0-1 scale
}

export interface RecommendationItem {
  type: 'optimization' | 'alternative' | 'warning' | 'improvement';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  impact?: string;
  actionRequired?: boolean;
  estimatedSavings?: number;
  implementationTime?: string;
}

export interface CostAnalysis {
  packagingCost: number;
  handlingCost: number;
  spaceCost: number;
  transportCost: number;
  totalCost: number;
  costPerUnit: number;
  alternatives: CostAlternative[];
}

export interface CostAlternative {
  name: string;
  totalCost: number;
  savings: number;
  tradeoffs: string[];
  feasibility: 'high' | 'medium' | 'low';
}

export interface ExecutiveSummary {
  overallRating: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'poor';
  keyMetrics: KeyMetric[];
  majorIssues: string[];
  topRecommendations: string[];
  costImpact: {
    current: number;
    potential: number;
    savings: number;
  };
}

export interface KeyMetric {
  name: string;
  value: number;
  unit: string;
  benchmark: number;
  status: 'above' | 'at' | 'below';
}

// Export type inference helpers
export type CompositionRequestInput = z.infer<typeof compositionRequestSchema>;
export type ReportGenerationInput = z.infer<typeof reportGenerationSchema>;
export type ValidationRequestInput = z.infer<typeof validationRequestSchema>;
export type CompositionProductInput = z.infer<typeof compositionProductSchema>;
export type CompositionConstraintsInput = z.infer<typeof compositionConstraintsSchema>;