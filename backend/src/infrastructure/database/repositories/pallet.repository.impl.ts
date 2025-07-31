import { eq, desc, like, and, or, gte, lte, count, inArray, sql, isNull } from 'drizzle-orm';
import { pallets, ucps } from '../../../db/schema.js';
import { db } from '../database.js';
import { PalletRepository, PalletQueryFilters } from '../../../core/domain/interfaces/pallet.repository.js';
import { PalletEntity, CreatePalletData, UpdatePalletData, Pallet } from '../../../core/domain/entities/pallet.entity.js';
import { NotFoundError, ConflictError } from '../../../utils/exceptions/index.js';
import { STATUS, BUSINESS_RULES } from '../../../core/shared/constants/index.js';
import { logInfo, logError } from '../../../utils/logger.js';

export class PalletRepositoryImpl implements PalletRepository {
  
  private transformToPalletEntity(dbPallet: any): PalletEntity {
    return {
      ...dbPallet,
      maxWeight: parseFloat(dbPallet.maxWeight), // Convert string to number
      canBeUsed(): boolean {
        return this.status === STATUS.PALLET.DISPONIVEL;
      },
      isAvailable(): boolean {
        return this.status === STATUS.PALLET.DISPONIVEL;
      },
      isDefective(): boolean {
        return this.status === STATUS.PALLET.DEFEITUOSO;
      }
    };
  }

  private transformToDbData(entityData: any): any {
    return {
      ...entityData,
      maxWeight: entityData.maxWeight?.toString(), // Convert number to string
      canBeUsed: undefined, // Remove entity methods
      isAvailable: undefined,
      isDefective: undefined
    };
  }
  async findById(id: number): Promise<PalletEntity | null> {
    try {
      const [pallet] = await db
        .select()
        .from(pallets)
        .where(eq(pallets.id, id))
        .limit(1);

      return pallet ? this.transformToPalletEntity(pallet) : null;
    } catch (error) {
      logError('Error finding pallet by ID', { error, id });
      throw error;
    }
  }

  async findByCode(code: string): Promise<PalletEntity | null> {
    try {
      const [pallet] = await db
        .select()
        .from(pallets)
        .where(eq(pallets.code, code.toUpperCase()))
        .limit(1);

      return pallet ? this.transformToPalletEntity(pallet) : null;
    } catch (error) {
      logError('Error finding pallet by code', { error, code });
      throw error;
    }
  }

  async findAll(filters?: PalletQueryFilters): Promise<PalletEntity[]> {
    try {
      const query = db.select().from(pallets);
      const conditions = [];

      if (filters) {

        if (filters.code) {
          conditions.push(like(pallets.code, `%${filters.code.toUpperCase()}%`));
        }

        if (filters.type) {
          conditions.push(eq(pallets.type, filters.type));
        }

        if (filters.material) {
          conditions.push(eq(pallets.material, filters.material));
        }

        if (filters.status) {
          conditions.push(eq(pallets.status, filters.status));
        }

        if (filters.minWeight) {
          conditions.push(gte(pallets.maxWeight, filters.minWeight.toString()));
        }

        if (filters.maxWeight) {
          conditions.push(lte(pallets.maxWeight, filters.maxWeight.toString()));
        }

        if (filters.createdFrom) {
          conditions.push(gte(pallets.createdAt, filters.createdFrom));
        }

        if (filters.createdTo) {
          conditions.push(lte(pallets.createdAt, filters.createdTo));
        }

        if (filters.needsInspection) {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          conditions.push(
            or(
              isNull(pallets.lastInspectionDate),
              lte(pallets.lastInspectionDate, sixMonthsAgo.toISOString())
            )
          );
        }

      }

      const baseQuery = conditions.length > 0 
        ? query.where(and(...conditions))
        : query;
      
      const result = await baseQuery.orderBy(desc(pallets.createdAt));
      
      logInfo('Pallets retrieved successfully', { 
        count: result.length,
        filters: filters ? Object.keys(filters) : [],
      });

      return result.map(pallet => this.transformToPalletEntity(pallet));
    } catch (error) {
      logError('Error finding all pallets', { error, filters });
      throw error;
    }
  }

  async create(data: CreatePalletData & { createdBy: number }): Promise<PalletEntity> {
    try {
      // Check if code already exists
      const existingPallet = await this.findByCode(data.code);
      if (existingPallet) {
        throw new ConflictError(`Pallet with code '${data.code}' already exists`);
      }

      const palletData = Pallet.create(data);
      const dbData = this.transformToDbData(palletData);
      const [newPallet] = await db
        .insert(pallets)
        .values(dbData)
        .returning();

      logInfo('Pallet created successfully', {
        palletId: newPallet.id,
        code: newPallet.code,
        type: newPallet.type,
      });

      return this.transformToPalletEntity(newPallet);
    } catch (error) {
      logError('Error creating pallet', { error, code: data.code });
      throw error;
    }
  }

  async update(id: number, data: UpdatePalletData): Promise<PalletEntity | null> {
    try {
      const currentPallet = await this.findById(id);
      if (!currentPallet) {
        throw new NotFoundError('Pallet', id);
      }

      const updateData = Pallet.update(currentPallet, data);
      
      if (Object.keys(updateData).length === 0) {
        return currentPallet; // No changes needed
      }

      const dbUpdateData = this.transformToDbData({ ...updateData, updatedAt: new Date() });
      const [updatedPallet] = await db
        .update(pallets)
        .set(dbUpdateData)
        .where(eq(pallets.id, id))
        .returning();

      logInfo('Pallet updated successfully', {
        palletId: updatedPallet.id,
        code: updatedPallet.code,
        updatedFields: Object.keys(updateData),
      });

      return this.transformToPalletEntity(updatedPallet);
    } catch (error) {
      logError('Error updating pallet', { error, id });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      // Check if pallet is in use
      const [ucpUsage] = await db
        .select({ count: count() })
        .from(ucps)
        .where(and(eq(ucps.palletId, id), eq(ucps.status, STATUS.UCP.ACTIVE)));

      if (ucpUsage.count > 0) {
        throw new ConflictError('Cannot delete pallet that is currently in use by active UCP');
      }

      const result = await db
        .delete(pallets)
        .where(eq(pallets.id, id));

      const deleted = (result.rowCount || 0) > 0;
      
      if (deleted) {
        logInfo('Pallet deleted successfully', { palletId: id });
      }

      return deleted;
    } catch (error) {
      logError('Error deleting pallet', { error, id });
      throw error;
    }
  }

  async findByStatus(status: string): Promise<PalletEntity[]> {
    try {
      const result = await db
        .select()
        .from(pallets)
        .where(eq(pallets.status, status))
        .orderBy(desc(pallets.createdAt));

      return result.map(pallet => this.transformToPalletEntity(pallet));
    } catch (error) {
      logError('Error finding pallets by status', { error, status });
      throw error;
    }
  }

  async findByType(type: string): Promise<PalletEntity[]> {
    try {
      const result = await db
        .select()
        .from(pallets)
        .where(eq(pallets.type, type))
        .orderBy(desc(pallets.createdAt));

      return result.map(pallet => this.transformToPalletEntity(pallet));
    } catch (error) {
      logError('Error finding pallets by type', { error, type });
      throw error;
    }
  }

  async findByMaterial(material: string): Promise<PalletEntity[]> {
    try {
      const result = await db
        .select()
        .from(pallets)
        .where(eq(pallets.material, material))
        .orderBy(desc(pallets.createdAt));

      return result.map(pallet => this.transformToPalletEntity(pallet));
    } catch (error) {
      logError('Error finding pallets by material', { error, material });
      throw error;
    }
  }

  async findAvailable(): Promise<PalletEntity[]> {
    return this.findByStatus(STATUS.PALLET.DISPONIVEL);
  }

  async findAvailableForUcp(): Promise<PalletEntity[]> {
    try {
      // Find pallets that are available AND not being used in any active UCP
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

      return result.map((row: any) => row.pallets);
    } catch (error) {
      logError('Error finding available pallets for UCP', { error });
      throw error;
    }
  }

  async findInUse(): Promise<PalletEntity[]> {
    return this.findByStatus(STATUS.PALLET.EM_USO);
  }

  async findDefective(): Promise<PalletEntity[]> {
    return this.findByStatus(STATUS.PALLET.DEFEITUOSO);
  }

  async markAsInUse(id: number): Promise<PalletEntity | null> {
    try {
      const currentPallet = await this.findById(id);
      if (!currentPallet) {
        throw new NotFoundError('Pallet', id);
      }

      const updateData = Pallet.markAsInUse(currentPallet);
      return this.update(id, updateData);
    } catch (error) {
      logError('Error marking pallet as in use', { error, id });
      throw error;
    }
  }

  async markAsAvailable(id: number): Promise<PalletEntity | null> {
    try {
      const updateData = Pallet.markAsAvailable({} as PalletEntity);
      return this.update(id, updateData);
    } catch (error) {
      logError('Error marking pallet as available', { error, id });
      throw error;
    }
  }

  async markAsDefective(id: number, reason?: string): Promise<PalletEntity | null> {
    try {
      const currentPallet = await this.findById(id);
      if (!currentPallet) {
        throw new NotFoundError('Pallet', id);
      }

      const updateData = Pallet.markAsDefective(currentPallet, reason);
      return this.update(id, updateData);
    } catch (error) {
      logError('Error marking pallet as defective', { error, id, reason });
      throw error;
    }
  }

  async findNeedingInspection(): Promise<PalletEntity[]> {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const result = await db
        .select()
        .from(pallets)
        .where(
          or(
            isNull(pallets.lastInspectionDate),
            lte(pallets.lastInspectionDate, sixMonthsAgo.toISOString())
          )
        )
        .orderBy(pallets.lastInspectionDate);

      return result.map(pallet => this.transformToPalletEntity(pallet));
    } catch (error) {
      logError('Error finding pallets needing inspection', { error });
      throw error;
    }
  }

  async updateLastInspection(id: number, date: Date): Promise<PalletEntity | null> {
    try {
      return this.update(id, { lastInspectionDate: date });
    } catch (error) {
      logError('Error updating last inspection date', { error, id, date });
      throw error;
    }
  }

  async getNextCode(): Promise<string> {
    try {
      // Create sequence if it doesn't exist (idempotent)
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'pallet_code_seq') THEN
            DECLARE
              max_num INTEGER := 0;
            BEGIN
              SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)), 0)
              INTO max_num
              FROM pallets 
              WHERE code ~ '^PLT[0-9]{4}$';
              
              EXECUTE format('CREATE SEQUENCE pallet_code_seq START WITH %s INCREMENT BY 1', max_num + 1);
            END;
          END IF;
        END
        $$
      `);

      // Get next value from sequence
      const result = await db.execute(sql`SELECT nextval('pallet_code_seq') as next_num`);
      const nextNumber = Number(result.rows[0].next_num);

      // Format the code with zero padding
      return `${BUSINESS_RULES.PALLET_CODE_PREFIX}${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      logError('Error generating next pallet code', { error });
      throw error;
    }
  }

  async codeExists(code: string): Promise<boolean> {
    try {
      const [result] = await db
        .select({ count: count() })
        .from(pallets)
        .where(eq(pallets.code, code.toUpperCase()));

      return result.count > 0;
    } catch (error) {
      logError('Error checking if pallet code exists', { error, code });
      throw error;
    }
  }

  async countByStatus(): Promise<{ status: string; count: number }[]> {
    try {
      const result = await db
        .select({
          status: pallets.status,
          count: count(),
        })
        .from(pallets)
        .groupBy(pallets.status);

      return result.map((row: any) => ({
        status: row.status,
        count: Number(row.count),
      }));
    } catch (error) {
      logError('Error counting pallets by status', { error });
      throw error;
    }
  }

  async countByType(): Promise<{ type: string; count: number }[]> {
    try {
      const result = await db
        .select({
          type: pallets.type,
          count: count(),
        })
        .from(pallets)
        .groupBy(pallets.type);

      return result.map((row: any) => ({
        type: row.type,
        count: Number(row.count),
      }));
    } catch (error) {
      logError('Error counting pallets by type', { error });
      throw error;
    }
  }

  async countByMaterial(): Promise<{ material: string; count: number }[]> {
    try {
      const result = await db
        .select({
          material: pallets.material,
          count: count(),
        })
        .from(pallets)
        .groupBy(pallets.material);

      return result.map((row: any) => ({
        material: row.material,
        count: Number(row.count),
      }));
    } catch (error) {
      logError('Error counting pallets by material', { error });
      throw error;
    }
  }

  async createMany(palletsData: (CreatePalletData & { createdBy: number })[]): Promise<PalletEntity[]> {
    try {
      // Validate unique codes
      const codes = palletsData.map(p => p.code.toUpperCase());
      const uniqueCodes = [...new Set(codes)];
      
      if (codes.length !== uniqueCodes.length) {
        throw new ConflictError('Duplicate codes found in batch');
      }

      // Check existing codes
      const existingPallets = await db
        .select()
        .from(pallets)
        .where(inArray(pallets.code, codes));

      if (existingPallets.length > 0) {
        const existingCodes = existingPallets.map(p => p.code);
        throw new ConflictError(`Pallets already exist with codes: ${existingCodes.join(', ')}`);
      }

      const palletData = palletsData.map(data => this.transformToDbData(Pallet.create(data)));
      const newPallets = await db
        .insert(pallets)
        .values(palletData)
        .returning();

      logInfo('Batch pallets created successfully', { count: newPallets.length });
      return newPallets.map(pallet => this.transformToPalletEntity(pallet));
    } catch (error) {
      logError('Error creating batch pallets', { error, count: palletsData.length });
      throw error;
    }
  }

  async updateStatusBulk(ids: number[], status: string): Promise<number> {
    try {
      const result = await db
        .update(pallets)
        .set({ status, updatedAt: new Date() })
        .where(inArray(pallets.id, ids));

      const updated = result.rowCount || 0;
      logInfo('Bulk pallet status update completed', { updated, status });
      return updated;
    } catch (error) {
      logError('Error updating pallet status in bulk', { error, ids, status });
      throw error;
    }
  }

  async count(filters?: PalletQueryFilters): Promise<number> {
    try {
      const query = db.select({ count: count() }).from(pallets);
      const conditions = [];

      if (filters) {

        if (filters.status) {
          conditions.push(eq(pallets.status, filters.status));
        }

        if (filters.type) {
          conditions.push(eq(pallets.type, filters.type));
        }

      }

      const baseQuery = conditions.length > 0 
        ? query.where(and(...conditions))
        : query;

      const [result] = await baseQuery;
      return result.count;
    } catch (error) {
      logError('Error counting pallets', { error, filters });
      throw error;
    }
  }

  async existsByCode(code: string): Promise<boolean> {
    return this.codeExists(code);
  }

  async findByCapacity(minWeight?: number, maxWeight?: number, minVolume?: number, maxVolume?: number): Promise<PalletEntity[]> {
    try {
      const conditions = [];

      if (minWeight) {
        conditions.push(gte(pallets.maxWeight, minWeight.toString()));
      }

      if (maxWeight) {
        conditions.push(lte(pallets.maxWeight, maxWeight.toString()));
      }

      if (minVolume || maxVolume) {
        // Calculate volume from dimensions
        const volumeConditions = [];
        
        if (minVolume) {
          volumeConditions.push(gte(
            sql`${pallets.width} * ${pallets.length} * ${pallets.height}`, 
            minVolume
          ));
        }

        if (maxVolume) {
          volumeConditions.push(lte(
            sql`${pallets.width} * ${pallets.length} * ${pallets.height}`, 
            maxVolume
          ));
        }

        conditions.push(...volumeConditions);
      }

      const query = db.select().from(pallets);
      
      const baseQuery = conditions.length > 0 
        ? query.where(and(...conditions))
        : query;

      const result = await baseQuery.orderBy(desc(pallets.createdAt));
      return result.map(pallet => this.transformToPalletEntity(pallet));
    } catch (error) {
      logError('Error finding pallets by capacity', { error, minWeight, maxWeight, minVolume, maxVolume });
      throw error;
    }
  }

  async getCapacityStats(): Promise<{ avgWeight: number; avgVolume: number; totalCapacity: number }> {
    try {
      const [result] = await db
        .select({
          avgWeight: sql<number>`AVG(CAST(max_weight AS NUMERIC))`,
          avgVolume: sql<number>`AVG(width * length * height)`,
          totalCapacity: sql<number>`SUM(CAST(max_weight AS NUMERIC))`,
        })
        .from(pallets)
        .where(eq(pallets.status, STATUS.PALLET.DISPONIVEL));

      return {
        avgWeight: Number(result.avgWeight) || 0,
        avgVolume: Number(result.avgVolume) || 0,
        totalCapacity: Number(result.totalCapacity) || 0,
      };
    } catch (error) {
      logError('Error getting pallet capacity stats', { error });
      throw error;
    }
  }
}