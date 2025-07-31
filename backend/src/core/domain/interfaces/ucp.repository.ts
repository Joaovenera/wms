import { Repository, QueryFilters, TransferResult } from '../../shared/types/index.js';
import { 
  UcpEntity, 
  UcpItemEntity, 
  CreateUcpData, 
  CreateUcpItemData, 
  UcpWithItems,
  TransferRequest
} from '../entities/ucp.entity.js';

export interface UcpRepository {
  // Basic CRUD
  findById(id: number): Promise<UcpEntity | null>;
  findAll(filters?: UcpQueryFilters): Promise<UcpEntity[]>;
  create(data: CreateUcpData & { createdBy: number }): Promise<UcpEntity>;
  update(id: number, data: Partial<UcpEntity>): Promise<UcpEntity | null>;
  delete(id: number): Promise<boolean>;
  
  // Specific finders
  findByCode(code: string): Promise<UcpEntity | null>;
  findByPallet(palletId: number): Promise<UcpEntity[]>;
  findByPosition(positionId: number): Promise<UcpEntity[]>;
  findByStatus(status: string): Promise<UcpEntity[]>;
  
  // With items
  findWithItems(id: number): Promise<UcpWithItems | null>;
  findAllWithItems(filters?: UcpQueryFilters): Promise<UcpWithItems[]>;
  
  // Status methods
  findActive(): Promise<UcpEntity[]>;
  findEmpty(): Promise<UcpEntity[]>;
  findArchived(): Promise<UcpEntity[]>;
  
  // Lifecycle methods
  createWithHistory(data: CreateUcpData & { createdBy: number }): Promise<UcpEntity>;
  moveToPosition(ucpId: number, positionId: number, userId: number, reason?: string): Promise<boolean>;
  dismantle(ucpId: number, userId: number, reason?: string): Promise<boolean>;
  reactivate(ucpId: number, userId: number): Promise<UcpEntity | null>;
  
  // Code generation
  getNextCode(): Promise<string>;
  codeExists(code: string): Promise<boolean>;
  
  // Availability methods
  findAvailableForProduct(productId?: number): Promise<(UcpEntity & { availableSpace?: number })[]>;
  findAvailablePalletsForUcp(): Promise<any[]>; // Pallets that can be used for new UCPs
  
  // Statistics
  countByStatus(): Promise<{ status: string; count: number }[]>;
  getDashboardStats(): Promise<{
    totalUcps: number;
    activeUcps: number;
    emptyUcps: number;
    archivedUcps: number;
    totalItems: number;
    averageItemsPerUcp: number;
  }>;
  
  // Utility methods
  count(filters?: UcpQueryFilters): Promise<number>;
  existsByCode(code: string): Promise<boolean>;
}

export interface UcpItemRepository extends Repository<UcpItemEntity> {
  // Basic CRUD
  findById(id: number): Promise<UcpItemEntity | null>;
  findAll(filters?: UcpItemQueryFilters): Promise<UcpItemEntity[]>;
  create(data: CreateUcpItemData & { addedBy: number }): Promise<UcpItemEntity>;
  update(id: number, data: Partial<UcpItemEntity>): Promise<UcpItemEntity | null>;
  delete(id: number): Promise<boolean>;
  
  // UCP-specific methods
  findByUcp(ucpId: number, includeRemoved?: boolean): Promise<UcpItemEntity[]>;
  findActiveByUcp(ucpId: number): Promise<UcpItemEntity[]>;
  findRemovedByUcp(ucpId: number): Promise<UcpItemEntity[]>;
  
  // Product-specific methods
  findByProduct(productId: number): Promise<UcpItemEntity[]>;
  findByProductAndLot(productId: number, lot: string): Promise<UcpItemEntity[]>;
  
  // Item management
  addItem(data: CreateUcpItemData & { addedBy: number }): Promise<UcpItemEntity>;
  removeItem(itemId: number, userId: number, reason: string): Promise<boolean>;
  updateQuantity(itemId: number, quantity: number): Promise<UcpItemEntity | null>;
  
  // Transfer methods
  transferItem(request: TransferRequest & { userId: number }): Promise<TransferResult>;
  
  // Expiry methods
  findExpired(): Promise<UcpItemEntity[]>;
  findNearExpiry(daysThreshold?: number): Promise<UcpItemEntity[]>;
  
  // Lot methods
  findByLot(lot: string): Promise<UcpItemEntity[]>;
  getLotInfo(lot: string): Promise<{ items: UcpItemEntity[]; totalQuantity: number; locations: string[] }>;
  
  // Statistics
  countByUcp(ucpId: number): Promise<number>;
  getTotalQuantityByProduct(productId: number): Promise<number>;
  getStockByLocation(): Promise<{ ucpCode: string; positionCode?: string; items: UcpItemEntity[] }[]>;
  
  // Utility methods
  count(filters?: UcpItemQueryFilters): Promise<number>;
  getActiveItemsCount(ucpId: number): Promise<number>;
  
  // History methods
  getItemHistory(itemId: number): Promise<any[]>;
  getTransferHistory(itemId: number): Promise<any[]>;
}

export interface UcpQueryFilters extends QueryFilters {
  code?: string;
  palletId?: number;
  positionId?: number;
  status?: string;
  hasItems?: boolean;
  isEmpty?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  includeArchived?: boolean;
}

export interface UcpItemQueryFilters extends QueryFilters {
  ucpId?: number;
  productId?: number;
  lot?: string;
  isActive?: boolean;
  isExpired?: boolean;
  isNearExpiry?: boolean;
  nearExpiryDays?: number;
  addedFrom?: Date;
  addedTo?: Date;
  expiryFrom?: Date;
  expiryTo?: Date;
  includeRemoved?: boolean;
}