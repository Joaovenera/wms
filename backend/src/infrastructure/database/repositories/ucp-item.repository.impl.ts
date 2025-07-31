import { eq, desc, like, and, or, gte, lte, count, inArray, sql, isNull, isNotNull, ne } from 'drizzle-orm';
import { ucpItems, itemTransfers, ucps, products, positions } from '../../../db/schema.js';
import { db } from '../database.js';
import { UcpItemRepository, UcpItemQueryFilters } from '../../../core/domain/interfaces/ucp.repository.js';
import { 
  UcpItemEntity, 
  CreateUcpItemData, 
  TransferRequest,
  UcpItem
} from '../../../core/domain/entities/ucp.entity.js';
import { TransferResult } from '../../../core/shared/types/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../utils/exceptions/index.js';
import { logInfo, logError } from '../../../utils/logger.js';

export class UcpItemRepositoryImpl implements UcpItemRepository {
  
  private transformToUcpItemEntity(dbItem: any): UcpItemEntity {
    return {
      id: dbItem.id,
      ucpId: dbItem.ucpId,
      productId: dbItem.productId,
      quantity: Number(dbItem.quantity),
      lot: dbItem.lot ?? undefined,
      expiryDate: dbItem.expiryDate ? new Date(dbItem.expiryDate) : undefined,
      internalCode: dbItem.internalCode ?? undefined,
      packagingTypeId: dbItem.packagingTypeId ?? undefined,
      packagingQuantity: dbItem.packagingQuantity ? Number(dbItem.packagingQuantity) : undefined,
      addedBy: dbItem.addedBy,
      addedAt: new Date(dbItem.addedAt),
      removedBy: dbItem.removedBy ?? undefined,
      removedAt: dbItem.removedAt ? new Date(dbItem.removedAt) : undefined,
      removalReason: dbItem.removalReason ?? undefined,
      isActive: dbItem.isActive,
      createdAt: new Date(dbItem.addedAt),
      updatedAt: new Date(dbItem.addedAt), 
    };
  }

  private transformToDbData(entityData: Partial<Omit<UcpItemEntity, 'id' | 'createdAt' | 'updatedAt'>>): any {
    const dbData: { [key: string]: any } = { ...entityData };
    for (const key in dbData) {
      if (dbData[key] === undefined) {
        dbData[key] = null;
      }
    }
    if (dbData.expiryDate) {
        dbData.expiryDate = (dbData.expiryDate as Date).toISOString().split('T')[0];
    }
    return dbData;
  }

  async findById(id: number): Promise<UcpItemEntity | null> {
    const [item] = await db.select().from(ucpItems).where(eq(ucpItems.id, id));
    return item ? this.transformToUcpItemEntity(item) : null;
  }

  async findAll(filters?: UcpItemQueryFilters): Promise<UcpItemEntity[]> {
    let query = db.select().from(ucpItems).$dynamic();
    const conditions = [];
    if (filters) {
        if (filters.ucpId) conditions.push(eq(ucpItems.ucpId, filters.ucpId));
        if (filters.productId) conditions.push(eq(ucpItems.productId, filters.productId));
        if (filters.lot) conditions.push(like(ucpItems.lot, `%${filters.lot}%`));
        if (filters.isActive !== undefined) conditions.push(eq(ucpItems.isActive, filters.isActive));
    }
    if (conditions.length > 0) {
        query = query.where(and(...conditions));
    }
    const result = await query.orderBy(desc(ucpItems.addedAt));
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async create(data: CreateUcpItemData & { addedBy: number }): Promise<UcpItemEntity> {
    const itemData = UcpItem.create(data);
    const [newItem] = await db.insert(ucpItems).values(this.transformToDbData(itemData)).returning();
    return this.transformToUcpItemEntity(newItem);
  }

  async update(id: number, data: Partial<UcpItemEntity>): Promise<UcpItemEntity | null> {
    const [updatedItem] = await db.update(ucpItems).set(this.transformToDbData(data)).where(eq(ucpItems.id, id)).returning();
    return updatedItem ? this.transformToUcpItemEntity(updatedItem) : null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(ucpItems).where(eq(ucpItems.id, id));
    return (result.rowCount || 0) > 0;
  }

  async findByUcp(ucpId: number, includeRemoved = false): Promise<UcpItemEntity[]> {
    const conditions = [eq(ucpItems.ucpId, ucpId)];
    if (!includeRemoved) {
      conditions.push(eq(ucpItems.isActive, true));
    }
    const result = await db.select().from(ucpItems).where(and(...conditions)).orderBy(desc(ucpItems.addedAt));
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async findActiveByUcp(ucpId: number): Promise<UcpItemEntity[]> {
    return this.findByUcp(ucpId, false);
  }

  async findRemovedByUcp(ucpId: number): Promise<UcpItemEntity[]> {
    const result = await db.select().from(ucpItems).where(and(eq(ucpItems.ucpId, ucpId), eq(ucpItems.isActive, false))).orderBy(desc(ucpItems.removedAt));
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async findByProduct(productId: number): Promise<UcpItemEntity[]> {
    const result = await db.select().from(ucpItems).where(and(eq(ucpItems.productId, productId), eq(ucpItems.isActive, true))).orderBy(desc(ucpItems.addedAt));
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async findByProductAndLot(productId: number, lot: string): Promise<UcpItemEntity[]> {
    const result = await db.select().from(ucpItems).where(and(eq(ucpItems.productId, productId), eq(ucpItems.lot, lot), eq(ucpItems.isActive, true))).orderBy(desc(ucpItems.addedAt));
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async addItem(data: CreateUcpItemData & { addedBy: number }): Promise<UcpItemEntity> {
    return this.create(data);
  }

  async removeItem(itemId: number, userId: number, reason: string): Promise<boolean> {
    const [updatedItem] = await db.update(ucpItems).set({ isActive: false, removedBy: userId, removedAt: new Date(), removalReason: reason }).where(eq(ucpItems.id, itemId)).returning();
    return !!updatedItem;
  }

  async updateQuantity(itemId: number, quantity: number): Promise<UcpItemEntity | null> {
    const [updatedItem] = await db.update(ucpItems).set({ quantity: quantity.toString() }).where(eq(ucpItems.id, itemId)).returning();
    return updatedItem ? this.transformToUcpItemEntity(updatedItem) : null;
  }

  async transferItem(request: TransferRequest & { userId: number }): Promise<TransferResult> {
    // This is a complex operation, placeholder implementation
    return { success: false, sourceUpdated: false, targetCreated: false, sourceUcpId: 0, targetUcpId: 0, timestamp: new Date(), error: 'Not implemented' };
  }

  async findExpired(): Promise<UcpItemEntity[]> {
    const result = await db.select().from(ucpItems).where(and(isNotNull(ucpItems.expiryDate), lte(ucpItems.expiryDate, new Date().toISOString()), eq(ucpItems.isActive, true))).orderBy(ucpItems.expiryDate);
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async findNearExpiry(daysThreshold?: number): Promise<UcpItemEntity[]> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + (daysThreshold || 30));
    const result = await db.select().from(ucpItems).where(and(isNotNull(ucpItems.expiryDate), lte(ucpItems.expiryDate, threshold.toISOString()), gte(ucpItems.expiryDate, new Date().toISOString()), eq(ucpItems.isActive, true))).orderBy(ucpItems.expiryDate);
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async findByLot(lot: string): Promise<UcpItemEntity[]> {
    const result = await db.select().from(ucpItems).where(and(eq(ucpItems.lot, lot), eq(ucpItems.isActive, true))).orderBy(desc(ucpItems.addedAt));
    return result.map(item => this.transformToUcpItemEntity(item));
  }

  async getLotInfo(lot: string): Promise<{ items: UcpItemEntity[]; totalQuantity: number; locations: string[]; }> {
    const items = await this.findByLot(lot);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const locationData = await db.select({ ucpCode: ucps.code, positionCode: positions.code }).from(ucpItems).innerJoin(ucps, eq(ucpItems.ucpId, ucps.id)).leftJoin(positions, eq(ucps.positionId, positions.id)).where(and(eq(ucpItems.lot, lot), eq(ucpItems.isActive, true)));
    const locations = locationData.map(l => l.positionCode ? `${l.ucpCode} (${l.positionCode})` : l.ucpCode);
    return { items, totalQuantity, locations: [...new Set(locations)] };
  }

  async countByUcp(ucpId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(ucpItems).where(and(eq(ucpItems.ucpId, ucpId), eq(ucpItems.isActive, true)));
    return result.count;
  }

  async getTotalQuantityByProduct(productId: number): Promise<number> {
    const [result] = await db.select({ total: sql<number>`sum(quantity)` }).from(ucpItems).where(and(eq(ucpItems.productId, productId), eq(ucpItems.isActive, true)));
    return Number(result.total) || 0;
  }

  async getStockByLocation(): Promise<{ ucpCode: string; positionCode?: string | undefined; items: UcpItemEntity[]; }[]> {
    // This is a complex query, returning a placeholder
    return [];
  }

  async count(filters?: UcpItemQueryFilters): Promise<number> {
    let query = db.select({ count: count() }).from(ucpItems).$dynamic();
    const conditions = [];
    if (filters) {
        if (filters.ucpId) conditions.push(eq(ucpItems.ucpId, filters.ucpId));
        if (filters.productId) conditions.push(eq(ucpItems.productId, filters.productId));
        if (filters.isActive !== undefined) conditions.push(eq(ucpItems.isActive, filters.isActive));
    }
    if (conditions.length > 0) {
        query = query.where(and(...conditions));
    }
    const [result] = await query;
    return result.count;
  }

  async getActiveItemsCount(ucpId: number): Promise<number> {
    return this.countByUcp(ucpId);
  }

  async getItemHistory(itemId: number): Promise<any[]> {
    return db.select().from(itemTransfers).where(eq(itemTransfers.sourceItemId, itemId)).orderBy(desc(itemTransfers.createdAt));
  }

  async getTransferHistory(itemId: number): Promise<any[]> {
    return this.getItemHistory(itemId);
  }
}