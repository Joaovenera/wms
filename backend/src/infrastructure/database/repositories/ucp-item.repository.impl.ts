import { eq, desc, like, and, or, gte, lte, count, inArray, sql, isNull, isNotNull, ne } from 'drizzle-orm';
import { ucpItems, ucpItemTransfers } from '../schemas/ucps.schema.js';
import { ucps } from '../schemas/ucps.schema.js';
import { products } from '../schemas/products.schema.js';
import { positions } from '../schemas/positions.schema.js';
import { db } from '../database.js';
import { UcpItemRepository, UcpItemQueryFilters } from '../../../core/domain/interfaces/ucp.repository.js';
import { 
  UcpItemEntity, 
  CreateUcpItemData, 
  UpdateUcpItemData,
  TransferRequest,
  UcpItem
} from '../../../core/domain/entities/ucp.entity.js';
import { TransferResult } from '../../../core/shared/types/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../utils/exceptions/index.js';
import { logInfo, logError } from '../../../utils/logger.js';

export class UcpItemRepositoryImpl implements UcpItemRepository {
  async findById(id: number): Promise<UcpItemEntity | null> {
    try {
      const [item] = await db
        .select()
        .from(ucpItems)
        .where(eq(ucpItems.id, id))
        .limit(1);

      return item || null;
    } catch (error) {
      logError('Error finding UCP item by ID', { error, id });
      throw error;
    }
  }

  async findAll(filters?: UcpItemQueryFilters): Promise<UcpItemEntity[]> {
    try {
      let query = db.select().from(ucpItems);

      if (filters) {
        const conditions = [];

        if (filters.ucpId) {
          conditions.push(eq(ucpItems.ucpId, filters.ucpId));
        }

        if (filters.productId) {
          conditions.push(eq(ucpItems.productId, filters.productId));
        }

        if (filters.lot) {
          conditions.push(like(ucpItems.lot, `%${filters.lot}%`));
        }

        if (filters.isActive !== undefined) {
          conditions.push(eq(ucpItems.isActive, filters.isActive));
        }

        if (!filters.includeRemoved) {
          conditions.push(eq(ucpItems.isActive, true));
        }

        if (filters.addedFrom) {
          conditions.push(gte(ucpItems.addedAt, filters.addedFrom));
        }

        if (filters.addedTo) {
          conditions.push(lte(ucpItems.addedAt, filters.addedTo));
        }

        if (filters.expiryFrom) {
          conditions.push(gte(ucpItems.expiryDate, filters.expiryFrom));
        }

        if (filters.expiryTo) {
          conditions.push(lte(ucpItems.expiryDate, filters.expiryTo));
        }

        if (filters.isExpired) {
          conditions.push(lte(ucpItems.expiryDate, new Date()));
        }

        if (filters.isNearExpiry) {
          const daysThreshold = filters.nearExpiryDays || 30;
          const thresholdDate = new Date();
          thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
          conditions.push(and(
            lte(ucpItems.expiryDate, thresholdDate),
            gte(ucpItems.expiryDate, new Date())
          ));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const result = await query.orderBy(desc(ucpItems.addedAt));
      
      logInfo('UCP items retrieved successfully', { 
        count: result.length,
        filters: filters ? Object.keys(filters) : [],
      });

      return result;
    } catch (error) {
      logError('Error finding all UCP items', { error, filters });
      throw error;
    }
  }

  async create(data: CreateUcpItemData & { addedBy: number }): Promise<UcpItemEntity> {
    try {
      // Validate UCP exists and is active
      const [ucp] = await db
        .select()
        .from(ucps)
        .where(eq(ucps.id, data.ucpId))
        .limit(1);

      if (!ucp) {
        throw new NotFoundError('UCP', data.ucpId);
      }

      if (ucp.status !== 'ACTIVE') {
        throw new ValidationError('Cannot add items to inactive UCP');
      }

      const itemData = UcpItem.create(data);
      const [newItem] = await db
        .insert(ucpItems)
        .values(itemData)
        .returning();

      logInfo('UCP item created successfully', {
        itemId: newItem.id,
        ucpId: newItem.ucpId,
        productId: newItem.productId,
        quantity: newItem.quantity,
      });

      return newItem;
    } catch (error) {
      logError('Error creating UCP item', { error, data });
      throw error;
    }
  }

  async update(id: number, data: Partial<UcpItemEntity>): Promise<UcpItemEntity | null> {
    try {
      const currentItem = await this.findById(id);
      if (!currentItem) {
        throw new NotFoundError('UCP Item', id);
      }

      const updateData = UcpItem.update(currentItem, data);
      
      if (Object.keys(updateData).length === 0) {
        return currentItem; // No changes needed
      }

      const [updatedItem] = await db
        .update(ucpItems)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(ucpItems.id, id))
        .returning();

      logInfo('UCP item updated successfully', {
        itemId: updatedItem.id,
        updatedFields: Object.keys(updateData),
      });

      return updatedItem;
    } catch (error) {
      logError('Error updating UCP item', { error, id });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(ucpItems)
        .where(eq(ucpItems.id, id));

      const deleted = (result.rowCount || 0) > 0;
      
      if (deleted) {
        logInfo('UCP item deleted successfully', { itemId: id });
      }

      return deleted;
    } catch (error) {
      logError('Error deleting UCP item', { error, id });
      throw error;
    }
  }

  async findByUcp(ucpId: number, includeRemoved = false): Promise<UcpItemEntity[]> {
    try {
      let query = db
        .select()
        .from(ucpItems)
        .where(eq(ucpItems.ucpId, ucpId));

      if (!includeRemoved) {
        query = query.where(and(
          eq(ucpItems.ucpId, ucpId),
          eq(ucpItems.isActive, true)
        ));
      }

      const result = await query.orderBy(desc(ucpItems.addedAt));
      return result;
    } catch (error) {
      logError('Error finding UCP items by UCP', { error, ucpId, includeRemoved });
      throw error;
    }
  }

  async findActiveByUcp(ucpId: number): Promise<UcpItemEntity[]> {
    return this.findByUcp(ucpId, false);
  }

  async findRemovedByUcp(ucpId: number): Promise<UcpItemEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucpItems)
        .where(and(
          eq(ucpItems.ucpId, ucpId),
          eq(ucpItems.isActive, false)
        ))
        .orderBy(desc(ucpItems.removedAt));

      return result;
    } catch (error) {
      logError('Error finding removed UCP items by UCP', { error, ucpId });
      throw error;
    }
  }

  async findByProduct(productId: number): Promise<UcpItemEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucpItems)
        .where(and(
          eq(ucpItems.productId, productId),
          eq(ucpItems.isActive, true)
        ))
        .orderBy(desc(ucpItems.addedAt));

      return result;
    } catch (error) {
      logError('Error finding UCP items by product', { error, productId });
      throw error;
    }
  }

  async findByProductAndLot(productId: number, lot: string): Promise<UcpItemEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucpItems)
        .where(and(
          eq(ucpItems.productId, productId),
          eq(ucpItems.lot, lot),
          eq(ucpItems.isActive, true)
        ))
        .orderBy(desc(ucpItems.addedAt));

      return result;
    } catch (error) {
      logError('Error finding UCP items by product and lot', { error, productId, lot });
      throw error;
    }
  }

  async addItem(data: CreateUcpItemData & { addedBy: number }): Promise<UcpItemEntity> {
    return this.create(data);
  }

  async removeItem(itemId: number, userId: number, reason: string): Promise<boolean> {
    try {
      const [updatedItem] = await db
        .update(ucpItems)
        .set({
          isActive: false,
          removedBy: userId,
          removedAt: new Date(),
          removalReason: reason,
        })
        .where(eq(ucpItems.id, itemId))
        .returning();

      const removed = !!updatedItem;
      
      if (removed) {
        logInfo('UCP item removed successfully', { itemId, userId, reason });
      }

      return removed;
    } catch (error) {
      logError('Error removing UCP item', { error, itemId, userId, reason });
      throw error;
    }
  }

  async updateQuantity(itemId: number, quantity: number): Promise<UcpItemEntity | null> {
    try {
      if (quantity <= 0) {
        throw new ValidationError('Quantity must be greater than zero');
      }

      const [updatedItem] = await db
        .update(ucpItems)
        .set({ quantity: quantity.toString() })
        .where(eq(ucpItems.id, itemId))
        .returning();

      if (updatedItem) {
        logInfo('UCP item quantity updated', { itemId, newQuantity: quantity });
      }

      return updatedItem || null;
    } catch (error) {
      logError('Error updating UCP item quantity', { error, itemId, quantity });
      throw error;
    }
  }

  async transferItem(request: TransferRequest & { userId: number }): Promise<TransferResult> {
    try {
      const sourceItem = await this.findById(request.itemId);
      if (!sourceItem) {
        throw new NotFoundError('UCP Item', request.itemId);
      }

      const sourceQuantity = Number(sourceItem.quantity);
      if (request.quantity > sourceQuantity) {
        throw new ValidationError('Transfer quantity exceeds available quantity');
      }

      // Start transaction-like behavior
      const transferId = crypto.randomUUID();
      
      // If transferring full quantity, update the source item's UCP
      if (request.quantity === sourceQuantity) {
        await db
          .update(ucpItems)
          .set({ ucpId: request.targetUcpId })
          .where(eq(ucpItems.id, request.itemId));
      } else {
        // Partial transfer: reduce source quantity and create new item in target UCP
        await db
          .update(ucpItems)
          .set({ quantity: (sourceQuantity - request.quantity).toString() })
          .where(eq(ucpItems.id, request.itemId));

        await db.insert(ucpItems).values({
          ucpId: request.targetUcpId,
          productId: sourceItem.productId,
          quantity: request.quantity.toString(),
          lot: sourceItem.lot,
          expiryDate: sourceItem.expiryDate,
          internalCode: sourceItem.internalCode,
          addedBy: request.userId,
          addedAt: new Date(),
          isActive: true,
        });
      }

      // Record transfer history
      await db.insert(ucpItemTransfers).values({
        id: transferId,
        itemId: request.itemId,
        sourceUcpId: sourceItem.ucpId,
        targetUcpId: request.targetUcpId,
        quantity: request.quantity.toString(),
        reason: request.reason,
        transferredBy: request.userId,
        transferredAt: new Date(),
      });

      logInfo('UCP item transfer completed', {
        transferId,
        itemId: request.itemId,
        sourceUcpId: sourceItem.ucpId,
        targetUcpId: request.targetUcpId,
        quantity: request.quantity,
      });

      return {
        success: true,
        transferId,
        message: 'Item transferred successfully',
      };
    } catch (error) {
      logError('Error transferring UCP item', { error, request });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed',
      };
    }
  }

  async findExpired(): Promise<UcpItemEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucpItems)
        .where(and(
          lte(ucpItems.expiryDate, new Date()),
          eq(ucpItems.isActive, true),
          isNotNull(ucpItems.expiryDate)
        ))
        .orderBy(ucpItems.expiryDate);

      return result;
    } catch (error) {
      logError('Error finding expired UCP items', { error });
      throw error;
    }
  }

  async findNearExpiry(daysThreshold = 30): Promise<UcpItemEntity[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const result = await db
        .select()
        .from(ucpItems)
        .where(and(
          lte(ucpItems.expiryDate, thresholdDate),
          gte(ucpItems.expiryDate, new Date()),
          eq(ucpItems.isActive, true),
          isNotNull(ucpItems.expiryDate)
        ))
        .orderBy(ucpItems.expiryDate);

      return result;
    } catch (error) {
      logError('Error finding near expiry UCP items', { error, daysThreshold });
      throw error;
    }
  }

  async findByLot(lot: string): Promise<UcpItemEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucpItems)
        .where(and(
          eq(ucpItems.lot, lot),
          eq(ucpItems.isActive, true)
        ))
        .orderBy(desc(ucpItems.addedAt));

      return result;
    } catch (error) {
      logError('Error finding UCP items by lot', { error, lot });
      throw error;
    }
  }

  async getLotInfo(lot: string): Promise<{ items: UcpItemEntity[]; totalQuantity: number; locations: string[] }> {
    try {
      const items = await this.findByLot(lot);
      
      const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);
      
      const locationQuery = await db
        .select({
          ucpCode: ucps.code,
          positionCode: positions.code,
        })
        .from(ucpItems)
        .innerJoin(ucps, eq(ucpItems.ucpId, ucps.id))
        .leftJoin(positions, eq(ucps.positionId, positions.id))
        .where(and(
          eq(ucpItems.lot, lot),
          eq(ucpItems.isActive, true)
        ));

      const locations = locationQuery.map(row => 
        `${row.ucpCode}${row.positionCode ? ` (${row.positionCode})` : ''}`
      );

      return {
        items,
        totalQuantity,
        locations: [...new Set(locations)], // Remove duplicates
      };
    } catch (error) {
      logError('Error getting lot info', { error, lot });
      throw error;
    }
  }

  async countByUcp(ucpId: number): Promise<number> {
    try {
      const [result] = await db
        .select({ count: count() })
        .from(ucpItems)
        .where(and(
          eq(ucpItems.ucpId, ucpId),
          eq(ucpItems.isActive, true)
        ));

      return result.count;
    } catch (error) {
      logError('Error counting UCP items by UCP', { error, ucpId });
      throw error;
    }
  }

  async getTotalQuantityByProduct(productId: number): Promise<number> {
    try {
      const [result] = await db
        .select({
          total: sql<number>`SUM(CAST(quantity AS NUMERIC))`,
        })
        .from(ucpItems)
        .where(and(
          eq(ucpItems.productId, productId),
          eq(ucpItems.isActive, true)
        ));

      return Number(result.total) || 0;
    } catch (error) {
      logError('Error getting total quantity by product', { error, productId });
      throw error;
    }
  }

  async getStockByLocation(): Promise<{ ucpCode: string; positionCode?: string; items: UcpItemEntity[] }[]> {
    try {
      const query = sql`
        SELECT 
          u.code as ucp_code,
          p.code as position_code,
          json_agg(
            json_build_object(
              'id', ui.id,
              'product_id', ui.product_id,
              'quantity', ui.quantity,
              'lot', ui.lot,
              'expiry_date', ui.expiry_date,
              'internal_code', ui.internal_code,
              'added_at', ui.added_at
            )
          ) as items
        FROM ucp_items ui
        INNER JOIN ucps u ON ui.ucp_id = u.id
        LEFT JOIN positions p ON u.position_id = p.id
        WHERE ui.is_active = true
        GROUP BY u.code, p.code
        ORDER BY u.code, p.code
      `;

      const result = await db.execute(query);
      
      return result.rows.map((row: any) => ({
        ucpCode: row.ucp_code,
        positionCode: row.position_code,
        items: row.items,
      }));
    } catch (error) {
      logError('Error getting stock by location', { error });
      throw error;
    }
  }

  async count(filters?: UcpItemQueryFilters): Promise<number> {
    try {
      let query = db.select({ count: count() }).from(ucpItems);

      if (filters) {
        const conditions = [];

        if (filters.ucpId) {
          conditions.push(eq(ucpItems.ucpId, filters.ucpId));
        }

        if (filters.productId) {
          conditions.push(eq(ucpItems.productId, filters.productId));
        }

        if (filters.isActive !== undefined) {
          conditions.push(eq(ucpItems.isActive, filters.isActive));
        }

        if (!filters.includeRemoved) {
          conditions.push(eq(ucpItems.isActive, true));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const [result] = await query;
      return result.count;
    } catch (error) {
      logError('Error counting UCP items', { error, filters });
      throw error;
    }
  }

  async getActiveItemsCount(ucpId: number): Promise<number> {
    return this.countByUcp(ucpId);
  }

  async getItemHistory(itemId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(ucpItemTransfers)
        .where(eq(ucpItemTransfers.itemId, itemId))
        .orderBy(desc(ucpItemTransfers.transferredAt));

      return result;
    } catch (error) {
      logError('Error getting item history', { error, itemId });
      throw error;
    }
  }

  async getTransferHistory(itemId: number): Promise<any[]> {
    return this.getItemHistory(itemId);
  }
}