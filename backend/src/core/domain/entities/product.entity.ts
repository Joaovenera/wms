import { BaseEntity, Dimensions, StockInfo } from '../../shared/types/index.js';

export interface ProductEntity extends BaseEntity {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  ncm?: string;
  unit: string;
  weight?: number;
  dimensions?: Dimensions;
  barcode?: string;
  requiresLot: boolean;
  requiresExpiry: boolean;
  minStock: number;
  maxStock?: number;
  isActive: boolean;
}

export interface CreateProductData {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  ncm?: string;
  unit: string;
  weight?: number;
  dimensions?: Dimensions;
  barcode?: string;
  requiresLot?: boolean;
  requiresExpiry?: boolean;
  minStock?: number;
  maxStock?: number;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  category?: string;
  brand?: string;
  ncm?: string;
  unit?: string;
  weight?: number;
  dimensions?: Dimensions;
  barcode?: string;
  requiresLot?: boolean;
  requiresExpiry?: boolean;
  minStock?: number;
  maxStock?: number;
  isActive?: boolean;
}

export interface ProductWithStock extends ProductEntity {
  totalStock: number;
  stockLocations: StockInfo[];
}

export class Product implements ProductEntity {
  public readonly id: number;
  public readonly sku: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly category?: string;
  public readonly brand?: string;
  public readonly ncm?: string;
  public readonly unit: string;
  public readonly weight?: number;
  public readonly dimensions?: Dimensions;
  public readonly barcode?: string;
  public readonly requiresLot: boolean;
  public readonly requiresExpiry: boolean;
  public readonly minStock: number;
  public readonly maxStock?: number;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly createdBy?: number;

  constructor(data: ProductEntity) {
    this.id = data.id;
    this.sku = data.sku;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;
    this.brand = data.brand;
    this.ncm = data.ncm;
    this.unit = data.unit;
    this.weight = data.weight;
    this.dimensions = data.dimensions;
    this.barcode = data.barcode;
    this.requiresLot = data.requiresLot;
    this.requiresExpiry = data.requiresExpiry;
    this.minStock = data.minStock;
    this.maxStock = data.maxStock;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.createdBy = data.createdBy;
  }

  // Domain methods
  get displayName(): string {
    if (this.brand) {
      return `${this.brand} - ${this.name}`;
    }
    return this.name;
  }

  get volume(): number | undefined {
    if (!this.dimensions) return undefined;
    return this.dimensions.width * this.dimensions.length * this.dimensions.height;
  }

  hasLotControl(): boolean {
    return this.requiresLot;
  }

  hasExpiryControl(): boolean {
    return this.requiresExpiry;
  }

  needsSpecialHandling(): boolean {
    return this.requiresLot || this.requiresExpiry;
  }

  isLowStock(currentStock: number): boolean {
    return currentStock <= this.minStock;
  }

  isOverStock(currentStock: number): boolean {
    return this.maxStock ? currentStock >= this.maxStock : false;
  }

  getStockStatus(currentStock: number): 'low' | 'normal' | 'high' | 'over' {
    if (currentStock <= 0) return 'low';
    if (this.isLowStock(currentStock)) return 'low';
    if (this.isOverStock(currentStock)) return 'over';
    if (this.maxStock && currentStock > this.maxStock * 0.8) return 'high';
    return 'normal';
  }

  canBeStocked(): boolean {
    return this.isActive;
  }

  getStorageRequirements(): {
    requiresLot: boolean;
    requiresExpiry: boolean;
    specialHandling: boolean;
    weight?: number;
    volume?: number;
  } {
    return {
      requiresLot: this.requiresLot,
      requiresExpiry: this.requiresExpiry,
      specialHandling: this.needsSpecialHandling(),
      weight: this.weight,
      volume: this.volume,
    };
  }

  // Factory methods
  static create(data: CreateProductData & { createdBy: number }): Omit<ProductEntity, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      sku: data.sku.toUpperCase().trim(),
      name: data.name.trim(),
      description: data.description?.trim(),
      category: data.category?.trim(),
      brand: data.brand?.trim(),
      unit: data.unit.toLowerCase().trim(),
      weight: data.weight,
      dimensions: data.dimensions,
      barcode: data.barcode?.trim(),
      requiresLot: data.requiresLot || false,
      requiresExpiry: data.requiresExpiry || false,
      minStock: data.minStock || 0,
      maxStock: data.maxStock,
      isActive: true,
      createdBy: data.createdBy,
    };
  }

  static update(current: ProductEntity, updates: UpdateProductData): Partial<ProductEntity> {
    const updated: Partial<ProductEntity> = {};

    if (updates.name && updates.name !== current.name) {
      updated.name = updates.name.trim();
    }

    if (updates.description !== undefined && updates.description !== current.description) {
      updated.description = updates.description?.trim();
    }

    if (updates.category !== undefined && updates.category !== current.category) {
      updated.category = updates.category?.trim();
    }

    if (updates.brand !== undefined && updates.brand !== current.brand) {
      updated.brand = updates.brand?.trim();
    }

    if (updates.unit && updates.unit !== current.unit) {
      updated.unit = updates.unit.toLowerCase().trim();
    }

    if (updates.weight !== undefined && updates.weight !== current.weight) {
      updated.weight = updates.weight;
    }

    if (updates.dimensions !== undefined && JSON.stringify(updates.dimensions) !== JSON.stringify(current.dimensions)) {
      updated.dimensions = updates.dimensions;
    }

    if (updates.barcode !== undefined && updates.barcode !== current.barcode) {
      updated.barcode = updates.barcode?.trim();
    }

    if (updates.requiresLot !== undefined && updates.requiresLot !== current.requiresLot) {
      updated.requiresLot = updates.requiresLot;
    }

    if (updates.requiresExpiry !== undefined && updates.requiresExpiry !== current.requiresExpiry) {
      updated.requiresExpiry = updates.requiresExpiry;
    }

    if (updates.minStock !== undefined && updates.minStock !== current.minStock) {
      updated.minStock = updates.minStock;
    }

    if (updates.maxStock !== undefined && updates.maxStock !== current.maxStock) {
      updated.maxStock = updates.maxStock;
    }

    if (updates.isActive !== undefined && updates.isActive !== current.isActive) {
      updated.isActive = updates.isActive;
    }

    return updated;
  }

  // Status change methods
  static activate(current: ProductEntity): Partial<ProductEntity> {
    return { isActive: true };
  }

  static deactivate(current: ProductEntity): Partial<ProductEntity> {
    return { isActive: false };
  }
}