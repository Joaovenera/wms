import { Repository, QueryFilters, StockInfo } from '../../shared/types/index.js';
import { ProductEntity, CreateProductData, UpdateProductData, ProductWithStock } from '../entities/product.entity.js';

export interface ProductRepository {
  // Basic CRUD
  findById(id: number): Promise<ProductEntity | null>;
  findAll(filters?: ProductQueryFilters): Promise<ProductEntity[]>;
  create(data: CreateProductData & { createdBy: number }): Promise<ProductEntity>;
  update(id: number, data: UpdateProductData): Promise<ProductEntity | null>;
  delete(id: number): Promise<boolean>;
  
  // Specific finders
  findBySku(sku: string): Promise<ProductEntity | null>;
  findByBarcode(barcode: string): Promise<ProductEntity | null>;
  findByCategory(category: string): Promise<ProductEntity[]>;
  findByBrand(brand: string): Promise<ProductEntity[]>;
  
  // Stock methods
  findWithStock(id?: number): Promise<ProductWithStock[]>;
  getStockInfo(productId: number): Promise<StockInfo[]>;
  getTotalStock(productId: number): Promise<number>;
  
  // Status methods
  findActive(): Promise<ProductEntity[]>;
  findInactive(): Promise<ProductEntity[]>;
  activate(id: number): Promise<ProductEntity | null>;
  deactivate(id: number): Promise<ProductEntity | null>;
  
  // Lot and expiry methods
  findRequiringLot(): Promise<ProductEntity[]>;
  findRequiringExpiry(): Promise<ProductEntity[]>;
  findWithSpecialHandling(): Promise<ProductEntity[]>;
  
  // Stock level methods
  findLowStock(): Promise<{ product: ProductEntity; currentStock: number; minStock: number }[]>;
  findOverStock(): Promise<{ product: ProductEntity; currentStock: number; maxStock: number }[]>;
  findOutOfStock(): Promise<ProductEntity[]>;
  
  // Search methods
  search(query: string): Promise<ProductEntity[]>;
  findByName(name: string): Promise<ProductEntity[]>;
  findByDescription(description: string): Promise<ProductEntity[]>;
  
  // Validation methods
  skuExists(sku: string, excludeId?: number): Promise<boolean>;
  barcodeExists(barcode: string, excludeId?: number): Promise<boolean>;
  
  // Statistics
  countByCategory(): Promise<{ category: string; count: number }[]>;
  countByBrand(): Promise<{ brand: string; count: number }[]>;
  countByUnit(): Promise<{ unit: string; count: number }[]>;
  
  // Bulk operations
  createMany(products: (CreateProductData & { createdBy: number })[]): Promise<ProductEntity[]>;
  updateMany(updates: { id: number; data: UpdateProductData }[]): Promise<ProductEntity[]>;
  activateMany(ids: number[]): Promise<number>;
  deactivateMany(ids: number[]): Promise<number>;
  
  // Utility methods
  count(filters?: ProductQueryFilters): Promise<number>;
  getWeightStats(): Promise<{ avgWeight: number; totalWeight: number; minWeight: number; maxWeight: number }>;
  getDimensionStats(): Promise<{ avgVolume: number; totalVolume: number; minVolume: number; maxVolume: number }>;
  
  // Photo methods
  updatePhotoUrl(id: number, photoUrl: string): Promise<ProductEntity | null>;
  removePhotoUrl(id: number): Promise<ProductEntity | null>;
}

export interface ProductQueryFilters extends QueryFilters {
  sku?: string;
  name?: string;
  category?: string;
  brand?: string;
  unit?: string;
  barcode?: string;
  isActive?: boolean;
  requiresLot?: boolean;
  requiresExpiry?: boolean;
  minWeight?: number;
  maxWeight?: number;
  minVolume?: number;
  maxVolume?: number;
  lowStock?: boolean;
  outOfStock?: boolean;
  overStock?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
}