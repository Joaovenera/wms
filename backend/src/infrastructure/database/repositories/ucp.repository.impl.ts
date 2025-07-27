import { eq, desc, like, and, or, gte, lte, count, inArray, sql, isNull, isNotNull } from 'drizzle-orm';
import { ucps, ucpHistory } from '../schemas/ucps.schema.js';
import { ucpItems } from '../schemas/ucps.schema.js';
import { pallets } from '../schemas/pallets.schema.js';
import { positions } from '../schemas/positions.schema.js';
import { products } from '../schemas/products.schema.js';
import { db } from '../database.js';
import { UcpRepository, UcpQueryFilters } from '../../../core/domain/interfaces/ucp.repository.js';
import { 
  UcpEntity, 
  CreateUcpData, 
  UpdateUcpData, 
  UcpWithItems, 
  Ucp 
} from '../../../core/domain/entities/ucp.entity.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../utils/exceptions/index.js';
import { STATUS, BUSINESS_RULES } from '../../../core/shared/constants/index.js';
import { logInfo, logError } from '../../../utils/logger.js';

export class UcpRepositoryImpl implements UcpRepository {
  async findById(id: number): Promise<UcpEntity | null> {
    try {
      const [ucp] = await db
        .select()
        .from(ucps)
        .where(eq(ucps.id, id))
        .limit(1);

      return ucp || null;
    } catch (error) {
      logError('Error finding UCP by ID', { error, id });
      throw error;
    }
  }

  async findByCode(code: string): Promise<UcpEntity | null> {
    try {
      const [ucp] = await db
        .select()
        .from(ucps)
        .where(eq(ucps.code, code.toUpperCase()))
        .limit(1);

      return ucp || null;
    } catch (error) {
      logError('Error finding UCP by code', { error, code });
      throw error;
    }
  }

  async findAll(filters?: UcpQueryFilters): Promise<UcpEntity[]> {
    try {
      let query = db.select().from(ucps);

      if (filters) {
        const conditions = [];

        if (filters.code) {
          conditions.push(like(ucps.code, `%${filters.code.toUpperCase()}%`));
        }

        if (filters.palletId) {
          conditions.push(eq(ucps.palletId, filters.palletId));
        }

        if (filters.positionId) {
          conditions.push(eq(ucps.positionId, filters.positionId));
        }

        if (filters.status) {
          conditions.push(eq(ucps.status, filters.status));
        }

        if (filters.createdFrom) {
          conditions.push(gte(ucps.createdAt, filters.createdFrom));
        }

        if (filters.createdTo) {
          conditions.push(lte(ucps.createdAt, filters.createdTo));
        }

        if (!filters.includeArchived) {
          conditions.push(ne(ucps.status, STATUS.UCP.ARCHIVED));
        }

        if (filters.hasItems !== undefined) {
          if (filters.hasItems) {
            // Has active items
            conditions.push(sql`EXISTS (
              SELECT 1 FROM ucp_items ui 
              WHERE ui.ucp_id = ${ucps.id} AND ui.is_active = true
            )`);
          } else {
            // No active items
            conditions.push(sql`NOT EXISTS (
              SELECT 1 FROM ucp_items ui 
              WHERE ui.ucp_id = ${ucps.id} AND ui.is_active = true
            )`);
          }
        }

        if (filters.isEmpty !== undefined) {
          if (filters.isEmpty) {
            conditions.push(sql`NOT EXISTS (
              SELECT 1 FROM ucp_items ui 
              WHERE ui.ucp_id = ${ucps.id} AND ui.is_active = true
            )`);
          } else {
            conditions.push(sql`EXISTS (
              SELECT 1 FROM ucp_items ui 
              WHERE ui.ucp_id = ${ucps.id} AND ui.is_active = true
            )`);
          }
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const result = await query.orderBy(desc(ucps.createdAt));
      
      logInfo('UCPs retrieved successfully', { 
        count: result.length,
        filters: filters ? Object.keys(filters) : [],
      });

      return result;
    } catch (error) {
      logError('Error finding all UCPs', { error, filters });
      throw error;
    }
  }

  async create(data: CreateUcpData & { createdBy: number }): Promise<UcpEntity> {
    try {
      // Check if code already exists
      const existingUcp = await this.findByCode(data.code);
      if (existingUcp) {
        throw new ConflictError(`UCP with code '${data.code}' already exists`);
      }

      // Validate pallet availability
      if (data.palletId) {
        const [palletInUse] = await db
          .select({ count: count() })
          .from(ucps)
          .where(and(
            eq(ucps.palletId, data.palletId),
            eq(ucps.status, STATUS.UCP.ACTIVE)
          ));

        if (palletInUse.count > 0) {
          throw new ConflictError('Pallet is already in use by another active UCP');
        }
      }

      const ucpData = Ucp.create(data);
      const [newUcp] = await db
        .insert(ucps)
        .values(ucpData)
        .returning();

      logInfo('UCP created successfully', {
        ucpId: newUcp.id,
        code: newUcp.code,
        palletId: newUcp.palletId,
        positionId: newUcp.positionId,
      });

      return newUcp;
    } catch (error) {
      logError('Error creating UCP', { error, code: data.code });
      throw error;
    }
  }

  async update(id: number, data: Partial<UcpEntity>): Promise<UcpEntity | null> {
    try {
      const currentUcp = await this.findById(id);
      if (!currentUcp) {
        throw new NotFoundError('UCP', id);
      }

      // Validate pallet change if provided
      if (data.palletId && data.palletId !== currentUcp.palletId) {
        const [palletInUse] = await db
          .select({ count: count() })
          .from(ucps)
          .where(and(
            eq(ucps.palletId, data.palletId),
            eq(ucps.status, STATUS.UCP.ACTIVE),
            ne(ucps.id, id)
          ));

        if (palletInUse.count > 0) {
          throw new ConflictError('Pallet is already in use by another active UCP');
        }
      }

      const updateData = Ucp.update(currentUcp, data);
      
      if (Object.keys(updateData).length === 0) {
        return currentUcp; // No changes needed
      }

      const [updatedUcp] = await db
        .update(ucps)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(ucps.id, id))
        .returning();

      logInfo('UCP updated successfully', {
        ucpId: updatedUcp.id,
        code: updatedUcp.code,
        updatedFields: Object.keys(updateData),
      });

      return updatedUcp;
    } catch (error) {
      logError('Error updating UCP', { error, id });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      // Check if UCP has active items
      const [activeItems] = await db
        .select({ count: count() })
        .from(ucpItems)
        .where(and(eq(ucpItems.ucpId, id), eq(ucpItems.isActive, true)));

      if (activeItems.count > 0) {
        throw new ConflictError('Cannot delete UCP that contains active items');
      }

      // Archive instead of delete to maintain history
      const [archivedUcp] = await db
        .update(ucps)
        .set({ 
          status: STATUS.UCP.ARCHIVED, 
          updatedAt: new Date() 
        })
        .where(eq(ucps.id, id))
        .returning();

      const archived = !!archivedUcp;
      
      if (archived) {
        logInfo('UCP archived successfully', { ucpId: id });
      }

      return archived;
    } catch (error) {
      logError('Error deleting UCP', { error, id });
      throw error;
    }
  }

  async findByPallet(palletId: number): Promise<UcpEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucps)
        .where(eq(ucps.palletId, palletId))
        .orderBy(desc(ucps.createdAt));

      return result;
    } catch (error) {
      logError('Error finding UCPs by pallet', { error, palletId });
      throw error;
    }
  }

  async findByPosition(positionId: number): Promise<UcpEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucps)
        .where(eq(ucps.positionId, positionId))
        .orderBy(desc(ucps.createdAt));

      return result;
    } catch (error) {
      logError('Error finding UCPs by position', { error, positionId });
      throw error;
    }
  }

  async findByStatus(status: string): Promise<UcpEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucps)
        .where(eq(ucps.status, status))
        .orderBy(desc(ucps.createdAt));

      return result;
    } catch (error) {
      logError('Error finding UCPs by status', { error, status });
      throw error;
    }
  }

  async findWithItems(id: number): Promise<UcpWithItems | null> {
    try {
      const ucp = await this.findById(id);
      if (!ucp) {
        return null;
      }

      const items = await db
        .select({
          id: ucpItems.id,
          productId: ucpItems.productId,
          productName: products.name,
          productSku: products.sku,
          quantity: ucpItems.quantity,
          lot: ucpItems.lot,
          expiryDate: ucpItems.expiryDate,
          internalCode: ucpItems.internalCode,
          isActive: ucpItems.isActive,
          addedBy: ucpItems.addedBy,
          addedAt: ucpItems.addedAt,
          removedBy: ucpItems.removedBy,
          removedAt: ucpItems.removedAt,
          removalReason: ucpItems.removalReason,
        })
        .from(ucpItems)
        .innerJoin(products, eq(ucpItems.productId, products.id))
        .where(eq(ucpItems.ucpId, id))
        .orderBy(desc(ucpItems.addedAt));

      return {
        ...ucp,
        items: items,
        totalItems: items.filter(item => item.isActive).length,
        totalQuantity: items
          .filter(item => item.isActive)
          .reduce((sum, item) => sum + Number(item.quantity), 0),
      };
    } catch (error) {
      logError('Error finding UCP with items', { error, id });
      throw error;
    }
  }

  async findAllWithItems(filters?: UcpQueryFilters): Promise<UcpWithItems[]> {
    try {
      const ucpList = await this.findAll(filters);
      const ucpsWithItems: UcpWithItems[] = [];

      for (const ucp of ucpList) {
        const ucpWithItems = await this.findWithItems(ucp.id);
        if (ucpWithItems) {
          ucpsWithItems.push(ucpWithItems);
        }
      }

      return ucpsWithItems;
    } catch (error) {
      logError('Error finding all UCPs with items', { error, filters });
      throw error;
    }
  }

  async findActive(): Promise<UcpEntity[]> {
    return this.findByStatus(STATUS.UCP.ACTIVE);
  }

  async findEmpty(): Promise<UcpEntity[]> {
    try {
      const result = await db
        .select()
        .from(ucps)
        .where(and(
          eq(ucps.status, STATUS.UCP.ACTIVE),
          sql`NOT EXISTS (
            SELECT 1 FROM ucp_items ui 
            WHERE ui.ucp_id = ${ucps.id} AND ui.is_active = true
          )`
        ))
        .orderBy(desc(ucps.createdAt));

      return result;
    } catch (error) {
      logError('Error finding empty UCPs', { error });
      throw error;
    }
  }

  async findArchived(): Promise<UcpEntity[]> {
    return this.findByStatus(STATUS.UCP.ARCHIVED);
  }

  async createWithHistory(data: CreateUcpData & { createdBy: number }): Promise<UcpEntity> {
    try {
      const newUcp = await this.create(data);

      // Create history entry
      await db.insert(ucpHistory).values({
        ucpId: newUcp.id,
        action: 'CREATED',
        details: `UCP created with code ${newUcp.code}`,
        userId: data.createdBy,
        timestamp: new Date(),
      });

      logInfo('UCP created with history', { ucpId: newUcp.id });
      return newUcp;
    } catch (error) {
      logError('Error creating UCP with history', { error, code: data.code });
      throw error;
    }
  }

  async moveToPosition(ucpId: number, positionId: number, userId: number, reason?: string): Promise<boolean> {
    try {
      const currentUcp = await this.findById(ucpId);
      if (!currentUcp) {
        throw new NotFoundError('UCP', ucpId);
      }

      const oldPositionId = currentUcp.positionId;
      
      const updated = await this.update(ucpId, { positionId });
      
      if (updated) {
        // Create history entry
        await db.insert(ucpHistory).values({
          ucpId,
          action: 'MOVED',
          details: `UCP moved from position ${oldPositionId || 'none'} to position ${positionId}${reason ? `. Reason: ${reason}` : ''}`,
          userId,
          timestamp: new Date(),
        });

        logInfo('UCP moved to new position', { ucpId, oldPositionId, newPositionId: positionId });
        return true;
      }

      return false;
    } catch (error) {
      logError('Error moving UCP to position', { error, ucpId, positionId });
      throw error;
    }
  }

  async dismantle(ucpId: number, userId: number, reason?: string): Promise<boolean> {
    try {
      const currentUcp = await this.findById(ucpId);
      if (!currentUcp) {
        throw new NotFoundError('UCP', ucpId);
      }

      // Check if UCP has active items
      const [activeItems] = await db
        .select({ count: count() })
        .from(ucpItems)
        .where(and(eq(ucpItems.ucpId, ucpId), eq(ucpItems.isActive, true)));

      if (activeItems.count > 0) {
        throw new ConflictError('Cannot dismantle UCP that contains active items');
      }

      const updated = await this.update(ucpId, { 
        status: STATUS.UCP.DISMANTLED,
        positionId: null,
        palletId: null,
      });

      if (updated) {
        // Create history entry
        await db.insert(ucpHistory).values({
          ucpId,
          action: 'DISMANTLED',
          details: `UCP dismantled${reason ? `. Reason: ${reason}` : ''}`,
          userId,
          timestamp: new Date(),
        });

        logInfo('UCP dismantled', { ucpId, reason });
        return true;
      }

      return false;
    } catch (error) {
      logError('Error dismantling UCP', { error, ucpId });
      throw error;
    }
  }

  async reactivate(ucpId: number, userId: number): Promise<UcpEntity | null> {
    try {
      const updated = await this.update(ucpId, { 
        status: STATUS.UCP.ACTIVE,
      });

      if (updated) {
        // Create history entry
        await db.insert(ucpHistory).values({
          ucpId,
          action: 'REACTIVATED',
          details: 'UCP reactivated',
          userId,
          timestamp: new Date(),
        });

        logInfo('UCP reactivated', { ucpId });
      }

      return updated;
    } catch (error) {
      logError('Error reactivating UCP', { error, ucpId });
      throw error;
    }
  }

  async getNextCode(): Promise<string> {
    try {
      // Create sequence if it doesn't exist (idempotent)
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'ucp_code_seq') THEN
            DECLARE
              max_num INTEGER := 0;
            BEGIN
              SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)), 0)
              INTO max_num
              FROM ucps 
              WHERE code ~ '^UCP[0-9]{6}$';
              
              EXECUTE format('CREATE SEQUENCE ucp_code_seq START WITH %s INCREMENT BY 1', max_num + 1);
            END;
          END IF;
        END
        $$
      `);

      // Get next value from sequence
      const result = await db.execute(sql`SELECT nextval('ucp_code_seq') as next_num`);
      const nextNumber = Number(result.rows[0].next_num);

      // Format the code with zero padding
      return `${BUSINESS_RULES.UCP_CODE_PREFIX}${nextNumber.toString().padStart(6, '0')}`;
    } catch (error) {
      logError('Error generating next UCP code', { error });
      throw error;
    }
  }

  async codeExists(code: string): Promise<boolean> {
    try {
      const [result] = await db
        .select({ count: count() })
        .from(ucps)
        .where(eq(ucps.code, code.toUpperCase()));

      return result.count > 0;
    } catch (error) {
      logError('Error checking if UCP code exists', { error, code });
      throw error;
    }
  }

  async findAvailableForProduct(productId?: number): Promise<(UcpEntity & { availableSpace?: number })[]> {
    try {
      const query = sql`
        SELECT 
          u.*,
          CASE 
            WHEN p.max_weight IS NOT NULL THEN 
              GREATEST(0, CAST(p.max_weight AS NUMERIC) - COALESCE(current_weight.total_weight, 0))
            ELSE NULL
          END as available_space
        FROM ucps u
        LEFT JOIN pallets p ON u.pallet_id = p.id
        LEFT JOIN (
          SELECT 
            ui.ucp_id,
            SUM(CAST(pr.weight AS NUMERIC) * CAST(ui.quantity AS NUMERIC)) as total_weight
          FROM ucp_items ui
          JOIN products pr ON ui.product_id = pr.id
          WHERE ui.is_active = true
          GROUP BY ui.ucp_id
        ) current_weight ON u.id = current_weight.ucp_id
        WHERE u.status = '${STATUS.UCP.ACTIVE}'
        AND u.position_id IS NOT NULL
        ORDER BY u.created_at DESC
      `;

      const result = await db.execute(query);
      return result.rows.map((row: any) => ({
        ...row,
        availableSpace: row.available_space ? Number(row.available_space) : undefined,
      }));
    } catch (error) {
      logError('Error finding available UCPs for product', { error, productId });
      throw error;
    }
  }

  async findAvailablePalletsForUcp(): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(pallets)
        .leftJoin(ucps, and(
          eq(ucps.palletId, pallets.id),
          eq(ucps.status, STATUS.UCP.ACTIVE)
        ))
        .where(and(
          eq(pallets.status, STATUS.PALLET.DISPONIVEL),
          isNull(ucps.id) // Pallet not in use by any active UCP
        ))
        .orderBy(desc(pallets.createdAt));

      return result.map(row => row.pallets);
    } catch (error) {
      logError('Error finding available pallets for UCP', { error });
      throw error;
    }
  }

  async countByStatus(): Promise<{ status: string; count: number }[]> {
    try {
      const result = await db
        .select({
          status: ucps.status,
          count: count(),
        })
        .from(ucps)
        .groupBy(ucps.status);

      return result.map(row => ({
        status: row.status,
        count: Number(row.count),
      }));
    } catch (error) {
      logError('Error counting UCPs by status', { error });
      throw error;
    }
  }

  async getDashboardStats(): Promise<{
    totalUcps: number;
    activeUcps: number;
    emptyUcps: number;
    archivedUcps: number;
    totalItems: number;
    averageItemsPerUcp: number;
  }> {
    try {
      const [statsResult] = await db.execute(sql`
        SELECT 
          COUNT(*) as total_ucps,
          COUNT(CASE WHEN status = '${STATUS.UCP.ACTIVE}' THEN 1 END) as active_ucps,
          COUNT(CASE WHEN status = '${STATUS.UCP.ARCHIVED}' THEN 1 END) as archived_ucps,
          COUNT(CASE 
            WHEN status = '${STATUS.UCP.ACTIVE}' 
            AND NOT EXISTS (
              SELECT 1 FROM ucp_items ui 
              WHERE ui.ucp_id = ucps.id AND ui.is_active = true
            ) 
            THEN 1 
          END) as empty_ucps
        FROM ucps
      `);

      const [itemsResult] = await db.execute(sql`
        SELECT 
          COUNT(*) as total_items,
          AVG(items_per_ucp) as avg_items_per_ucp
        FROM (
          SELECT 
            u.id,
            COUNT(ui.id) as items_per_ucp
          FROM ucps u
          LEFT JOIN ucp_items ui ON u.id = ui.ucp_id AND ui.is_active = true
          WHERE u.status = '${STATUS.UCP.ACTIVE}'
          GROUP BY u.id
        ) item_counts
      `);

      return {
        totalUcps: Number(statsResult.rows[0].total_ucps),
        activeUcps: Number(statsResult.rows[0].active_ucps),
        emptyUcps: Number(statsResult.rows[0].empty_ucps),
        archivedUcps: Number(statsResult.rows[0].archived_ucps),
        totalItems: Number(itemsResult.rows[0].total_items),
        averageItemsPerUcp: Number(itemsResult.rows[0].avg_items_per_ucp) || 0,
      };
    } catch (error) {
      logError('Error getting UCP dashboard stats', { error });
      throw error;
    }
  }

  async count(filters?: UcpQueryFilters): Promise<number> {
    try {
      let query = db.select({ count: count() }).from(ucps);

      if (filters) {
        const conditions = [];

        if (filters.status) {
          conditions.push(eq(ucps.status, filters.status));
        }

        if (filters.palletId) {
          conditions.push(eq(ucps.palletId, filters.palletId));
        }

        if (!filters.includeArchived) {
          conditions.push(ne(ucps.status, STATUS.UCP.ARCHIVED));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const [result] = await query;
      return result.count;
    } catch (error) {
      logError('Error counting UCPs', { error, filters });
      throw error;
    }
  }

  async existsByCode(code: string): Promise<boolean> {
    return this.codeExists(code);
  }
}