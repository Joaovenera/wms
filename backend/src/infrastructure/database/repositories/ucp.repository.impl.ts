import { eq, desc, like, and, or, gte, lte, count, inArray, sql, isNull, isNotNull, ne } from 'drizzle-orm';
import { ucps, ucpHistory, ucpItems, pallets, positions, products } from '../../../db/schema.js';
import { db } from '../database.js';
import { UcpRepository, UcpQueryFilters } from '../../../core/domain/interfaces/ucp.repository.js';
import { 
  UcpEntity, 
  CreateUcpData, 
  UcpWithItems, 
  Ucp, 
  UcpItemEntity,
  UcpItem
} from '../../../core/domain/entities/ucp.entity.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../utils/exceptions/index.js';
import { STATUS, BUSINESS_RULES } from '../../../core/shared/constants/index.js';
import { logInfo, logError } from '../../../utils/logger.js';

export class UcpRepositoryImpl implements UcpRepository {
  
  private transformToUcpEntity(dbUcp: any): UcpEntity {
    return {
      id: dbUcp.id,
      code: dbUcp.code,
      palletId: dbUcp.palletId ?? undefined,
      positionId: dbUcp.positionId ?? undefined,
      status: dbUcp.status,
      observations: dbUcp.observations ?? undefined,
      createdBy: dbUcp.createdBy,
      createdAt: new Date(dbUcp.createdAt),
      updatedAt: new Date(dbUcp.updatedAt),
    };
  }

  private transformToUcpEntities(dbUcps: any[]): UcpEntity[] {
    return dbUcps.map(dbUcp => this.transformToUcpEntity(dbUcp));
  }

  private transformToDbData(entityData: Partial<Omit<UcpEntity, 'id' | 'createdAt' | 'updatedAt'>>): any {
    const dbData: { [key: string]: any } = { ...entityData };
    for (const key in dbData) {
      if (dbData[key] === undefined) {
        dbData[key] = null;
      }
    }
    return dbData;
  }

  async findById(id: number): Promise<UcpEntity | null> {
    try {
      const [ucp] = await db.select().from(ucps).where(eq(ucps.id, id)).limit(1);
      return ucp ? this.transformToUcpEntity(ucp) : null;
    } catch (error) {
      logError('Error finding UCP by ID', { error, id });
      throw error;
    }
  }

  async findAll(filters?: UcpQueryFilters): Promise<UcpEntity[]> {
    try {
      let query = db.select().from(ucps).$dynamic();
      const conditions = [];
      if (!filters?.includeArchived) {
        conditions.push(ne(ucps.status, STATUS.UCP.ARCHIVED));
      }
      if (filters) {
        if (filters.code) conditions.push(like(ucps.code, `%${filters.code.toUpperCase()}%`));
        if (filters.palletId) conditions.push(eq(ucps.palletId, filters.palletId));
        if (filters.positionId) conditions.push(eq(ucps.positionId, filters.positionId));
        if (filters.status) conditions.push(eq(ucps.status, filters.status));
        if (filters.createdFrom) conditions.push(gte(ucps.createdAt, filters.createdFrom));
        if (filters.createdTo) conditions.push(lte(ucps.createdAt, filters.createdTo));
      }
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      const result = await query.orderBy(desc(ucps.createdAt));
      return this.transformToUcpEntities(result);
    } catch (error) {
      logError('Error finding all UCPs', { error, filters });
      throw error;
    }
  }

  async create(data: CreateUcpData & { createdBy: number }): Promise<UcpEntity> {
    try {
      const ucpData = Ucp.create(data);
      const [newUcp] = await db.insert(ucps).values(this.transformToDbData(ucpData)).returning();
      return this.transformToUcpEntity(newUcp);
    } catch (error) {
      logError('Error creating UCP', { error, code: data.code });
      throw error;
    }
  }

  async update(id: number, data: Partial<UcpEntity>): Promise<UcpEntity | null> {
    try {
      const [updatedUcp] = await db.update(ucps).set(this.transformToDbData(data)).where(eq(ucps.id, id)).returning();
      return updatedUcp ? this.transformToUcpEntity(updatedUcp) : null;
    } catch (error) {
      logError('Error updating UCP', { error, id });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const result = await db.delete(ucps).where(eq(ucps.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logError('Error deleting UCP', { error, id });
      throw error;
    }
  }

  async findByCode(code: string): Promise<UcpEntity | null> {
    const [ucp] = await db.select().from(ucps).where(eq(ucps.code, code.toUpperCase())).limit(1);
    return ucp ? this.transformToUcpEntity(ucp) : null;
  }

  async findByPallet(palletId: number): Promise<UcpEntity[]> {
    const result = await db.select().from(ucps).where(eq(ucps.palletId, palletId)).orderBy(desc(ucps.createdAt));
    return this.transformToUcpEntities(result);
  }

  async findByPosition(positionId: number): Promise<UcpEntity[]> {
    const result = await db.select().from(ucps).where(eq(ucps.positionId, positionId)).orderBy(desc(ucps.createdAt));
    return this.transformToUcpEntities(result);
  }

  async findByStatus(status: string): Promise<UcpEntity[]> {
    const result = await db.select().from(ucps).where(eq(ucps.status, status)).orderBy(desc(ucps.createdAt));
    return this.transformToUcpEntities(result);
  }

  async findWithItems(id: number): Promise<UcpWithItems | null> {
    const ucp = await this.findById(id);
    if (!ucp) return null;
    const itemsResult = await db.select().from(ucpItems).where(eq(ucpItems.ucpId, id));
    const items = itemsResult.map(item => new UcpItem(this.transformToUcpItemEntity(item)));
    return { ...ucp, items, totalItems: items.length, totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0) };
  }

  async findAllWithItems(filters?: UcpQueryFilters): Promise<UcpWithItems[]> {
      const ucpList = await this.findAll(filters);
      const ucpsWithItems: UcpWithItems[] = [];
      for (const ucp of ucpList) {
        const ucpWithItems = await this.findWithItems(ucp.id);
        if (ucpWithItems) {
          ucpsWithItems.push(ucpWithItems);
        }
      }
      return ucpsWithItems;
  }

  async findActive(): Promise<UcpEntity[]> {
    return this.findByStatus(STATUS.UCP.ACTIVE);
  }

  async findEmpty(): Promise<UcpEntity[]> {
      const result = await db.select().from(ucps).where(and(eq(ucps.status, STATUS.UCP.ACTIVE), sql`not exists (select 1 from ${ucpItems} where ${eq(ucpItems.ucpId, ucps.id)} and ${eq(ucpItems.isActive, true)})`));
      return this.transformToUcpEntities(result);
  }

  async findArchived(): Promise<UcpEntity[]> {
    return this.findByStatus(STATUS.UCP.ARCHIVED);
  }

  async createWithHistory(data: CreateUcpData & { createdBy: number }): Promise<UcpEntity> {
    const newUcp = await this.create(data);
    await db.insert(ucpHistory).values({ ucpId: newUcp.id, action: 'CREATED', description: `UCP created with code ${newUcp.code}`, performedBy: data.createdBy });
    return newUcp;
  }

  async moveToPosition(ucpId: number, positionId: number, userId: number, reason?: string): Promise<boolean> {
    const currentUcp = await this.findById(ucpId);
    if (!currentUcp) throw new NotFoundError('UCP', ucpId);
    const updated = await this.update(ucpId, { positionId });
    if (updated) {
      await db.insert(ucpHistory).values({ ucpId, action: 'MOVED', description: `Moved from ${currentUcp.positionId} to ${positionId}`, performedBy: userId, oldValue: JSON.stringify({positionId: currentUcp.positionId}), newValue: JSON.stringify({positionId}) });
      return true;
    }
    return false;
  }

  async dismantle(ucpId: number, userId: number, reason?: string): Promise<boolean> {
    const updated = await this.update(ucpId, { status: STATUS.UCP.ARCHIVED, positionId: undefined, palletId: undefined });
    if (updated) {
      await db.insert(ucpHistory).values({ ucpId, action: 'DISMANTLED', description: reason || 'UCP Dismantled', performedBy: userId });
      return true;
    }
    return false;
  }

  async reactivate(ucpId: number, userId: number): Promise<UcpEntity | null> {
    const updated = await this.update(ucpId, { status: STATUS.UCP.ACTIVE });
    if (updated) {
      await db.insert(ucpHistory).values({ ucpId, action: 'REACTIVATED', description: 'UCP Reactivated', performedBy: userId });
    }
    return updated;
  }

  async getNextCode(): Promise<string> {
    const result = await db.execute(sql`SELECT nextval('ucp_code_seq')`);
    const nextNumber = (result.rows[0] as any).nextval;
    return `${BUSINESS_RULES.UCP_CODE_PREFIX}${nextNumber.toString().padStart(6, '0')}`;
  }

  async codeExists(code: string): Promise<boolean> {
    const [result] = await db.select({ count: count() }).from(ucps).where(eq(ucps.code, code));
    return result.count > 0;
  }

  async findAvailableForProduct(productId?: number): Promise<(UcpEntity & { availableSpace?: number; })[]> {
    // This is a complex query, returning a placeholder
    return [];
  }

  async findAvailablePalletsForUcp(): Promise<any[]> {
    const result = await db.select().from(pallets).where(and(eq(pallets.status, 'disponivel'), sql`not exists (select 1 from ${ucps} where ${eq(ucps.palletId, pallets.id)} and ${eq(ucps.status, 'active')})`));
    return result;
  }

  async countByStatus(): Promise<{ status: string; count: number; }[]> {
    const result = await db.select({ status: ucps.status, count: count() }).from(ucps).groupBy(ucps.status);
    return result.map(r => ({ ...r, count: Number(r.count) }));
  }

  async getDashboardStats(): Promise<{ totalUcps: number; activeUcps: number; emptyUcps: number; archivedUcps: number; totalItems: number; averageItemsPerUcp: number; }> {
    const total = await this.count();
    const active = await this.count({ status: 'active' });
    const empty = await this.count({ status: 'active', isEmpty: true });
    const archived = await this.count({ status: 'archived' });
    const totalItemsResult = await db.select({ count: count() }).from(ucpItems).where(eq(ucpItems.isActive, true));
    const totalItems = totalItemsResult[0].count;
    return { totalUcps: total, activeUcps: active, emptyUcps: empty, archivedUcps: archived, totalItems, averageItemsPerUcp: total > 0 ? totalItems / total : 0 };
  }

  async count(filters?: UcpQueryFilters): Promise<number> {
    let query = db.select({ count: count() }).from(ucps).$dynamic();
    const conditions = [];
    if (filters) {
        if (filters.status) conditions.push(eq(ucps.status, filters.status));
        if (filters.palletId) conditions.push(eq(ucps.palletId, filters.palletId));
        if (filters.includeArchived === false) conditions.push(ne(ucps.status, STATUS.UCP.ARCHIVED));
    }
    if (conditions.length > 0) {
        query = query.where(and(...conditions));
    }
    const [result] = await query;
    return result.count;
  }

  async existsByCode(code: string): Promise<boolean> {
      return this.codeExists(code);
  }

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
}