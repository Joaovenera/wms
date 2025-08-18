// Tipos da API - substituindo @shared/schema

// User types
export interface User {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Pallet types
export interface Pallet {
  id: number;
  code: string;
  type: string;
  material: string;
  width: number;
  length: number;
  height: number;
  maxWeight: string;
  status: string;
  photoUrl?: string | null;
  observations?: string | null;
  lastInspectionDate?: Date | string | null;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Position types
export interface Position {
  id: number;
  code: string;
  structureId?: number | null;
  street: string;
  side: string;
  corridor?: string | null;
  position: number;
  level: number;
  rackType?: string | null;
  maxPallets: number;
  restrictions?: string | null;
  status: string;
  currentPalletId?: number | null;
  observations?: string | null;
  createdBy?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  hasDivision?: boolean | null;
  layoutConfig?: any;
  capacity?: number;
}

// Pallet Structure types
export interface PalletStructure {
  id: number;
  name: string;
  street: string;
  side: string;
  maxPositions: number;
  maxLevels: number;
  rackType?: string | null;
  status: string;
  observations?: string | null;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Product types
export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  unit: string;
  weight?: string | null;
  dimensions?: any;
  barcode?: string | null;
  requiresLot?: boolean | null;
  requiresExpiry?: boolean | null;
  minStock?: number | null;
  maxStock?: number | null;
  isActive?: boolean | null;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  // Stock information (populated by getProductsWithStock API)
  totalStock?: number | string;
  ucpStock?: any[];
}

// UCP types
export interface Ucp {
  id: number;
  code: string;
  palletId?: number | null;
  positionId?: number | null;
  status: string;
  observations?: string | null;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  // Relations (populated by API)
  pallet?: Pallet;
  position?: Position;
  items?: UcpItem[];
}

// Packaging types
export interface PackagingType {
  id: number;
  productId: number;
  name: string;
  barcode?: string | null;
  baseUnitQuantity: string;
  isBaseUnit?: boolean | null;
  parentPackagingId?: number | null;
  level: number;
  dimensions?: any;
  isActive?: boolean | null;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  // Relations
  product?: Product;
  parentPackaging?: PackagingType;
  childPackagings?: PackagingType[];
}

export interface PackagingConversionRule {
  id: number;
  fromPackagingId: number;
  toPackagingId: number;
  conversionFactor: string;
  isActive?: boolean | null;
  createdAt?: Date | string;
  // Relations
  fromPackaging?: PackagingType;
  toPackaging?: PackagingType;
}

export interface ProductStockByPackaging {
  packagingId: number;
  packagingName: string;
  barcode?: string | null;
  baseUnitQuantity: string;
  level: number;
  availablePackages: number;
  remainingBaseUnits: number;
  totalBaseUnits: number;
}

export interface ProductStockConsolidated {
  productId: number;
  totalBaseUnits: number;
  locationsCount: number;
  itemsCount: number;
}

export interface PickingPlanItem {
  packaging: PackagingType;
  quantity: number;
  baseUnits: number;
}

export interface OptimizedPickingPlan {
  pickingPlan: PickingPlanItem[];
  remaining: number;
  totalPlanned: number;
  canFulfill: boolean;
}

// Loading Item type - unified interface for all loading execution components
export interface LoadingItem {
  id: number;
  transferRequestItemId: number;
  productId: number;
  productName: string;
  productSku: string;
  requestedQuantity: string;
  loadedQuantity: string;
  notLoadedQuantity: string;
  divergenceReason?: string | null;
  divergenceComments?: string | null;
  scannedAt?: Date | string | null;
  confirmedAt?: Date | string | null;
  confirmedBy?: number | null;
}

// UCP Item types
export interface UcpItem {
  id: number;
  ucpId: number;
  productId: number;
  quantity: string;
  lot?: string | null;
  expiryDate?: Date | string | null;
  internalCode?: string | null;
  packagingTypeId?: number | null;
  packagingQuantity?: string | null;
  addedBy: number;
  addedAt?: Date | string;
  removedBy?: number | null;
  removedAt?: Date | string | null;
  removalReason?: string | null;
  isActive?: boolean | null;
  // Relations
  product?: Product;
  packagingType?: PackagingType;
}

// UCP History types
export interface UcpHistory {
  id: number;
  ucpId: number;
  action: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  itemId?: number | null;
  fromPositionId?: number | null;
  toPositionId?: number | null;
  performedBy: number;
  timestamp?: Date | string;
}

// Movement types
export interface Movement {
  id: number;
  type: string;
  ucpId?: number | null;
  productId?: number | null;
  fromPositionId?: number | null;
  toPositionId?: number | null;
  quantity?: string | null;
  lot?: string | null;
  reason?: string | null;
  performedBy: string;
  createdAt?: Date | string;
  timestamp?: Date | string;
}

// Vehicle interface
export interface Vehicle {
  id: number;
  code: string;
  name: string;
  brand: string;
  model: string;
  licensePlate: string;
  type: string;
  weightCapacity: string;
  cargoAreaLength: number;
  cargoAreaWidth: number;
  cargoAreaHeight: number;
  status: string;
  observations?: string | null;
  isActive?: boolean | null;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Insert/Create types
export type InsertUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertPallet = Omit<Pallet, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertPosition = Omit<Position, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertPalletStructure = Omit<PalletStructure, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertProduct = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertPackagingType = Omit<PackagingType, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertPackagingConversionRule = Omit<PackagingConversionRule, 'id' | 'createdAt'>;
export type InsertUcp = Omit<Ucp, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertUcpItem = Omit<UcpItem, 'id' | 'addedAt' | 'removedAt' | 'isActive'>;
export type InsertUcpHistory = Omit<UcpHistory, 'id' | 'timestamp'>;
export type InsertMovement = Omit<Movement, 'id' | 'createdAt'>;
export type InsertVehicle = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;

// Composition types
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

export interface CompositionReport {
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
  createdAt: Date | string;
  updatedAt: Date | string;
  // Relations
  pallet?: Pallet;
}

// Auth types
export type LoginData = {
  email: string;
  password: string;
};

export type RegisterData = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}; 