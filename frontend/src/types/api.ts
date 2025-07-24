// Tipos da API - substituindo @shared/schema
import { z } from 'zod';

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