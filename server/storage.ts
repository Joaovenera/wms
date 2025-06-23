import {
  users,
  pallets,
  positions,
  products,
  ucps,
  ucpItems,
  ucpHistory,
  movements,
  palletStructures,
  type User,
  type InsertUser,
  type Pallet,
  type InsertPallet,
  type Position,
  type InsertPosition,
  type Product,
  type InsertProduct,
  type Ucp,
  type InsertUcp,
  type UcpItem,
  type InsertUcpItem,
  type UcpHistory,
  type InsertUcpHistory,
  type Movement,
  type InsertMovement,
  type PalletStructure,
  type InsertPalletStructure,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, like, or, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Pallet operations
  getPallets(): Promise<Pallet[]>;
  getPallet(id: number): Promise<Pallet | undefined>;
  getPalletByCode(code: string): Promise<Pallet | undefined>;
  createPallet(pallet: InsertPallet): Promise<Pallet>;
  updatePallet(id: number, pallet: Partial<InsertPallet>): Promise<Pallet | undefined>;
  deletePallet(id: number): Promise<boolean>;

  // Position operations
  getPositions(): Promise<Position[]>;
  getPosition(id: number): Promise<Position | undefined>;
  getPositionByCode(code: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: number, position: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: number): Promise<boolean>;

  // Product operations
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // UCP operations - Enhanced for lifecycle management
  getUcps(includeArchived?: boolean): Promise<(Ucp & { pallet?: Pallet; position?: Position })[]>;
  getUcp(id: number): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined>;
  getUcpByCode(code: string): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined>;
  createUcp(ucp: InsertUcp): Promise<Ucp>;
  updateUcp(id: number, ucp: Partial<InsertUcp>): Promise<Ucp | undefined>;
  deleteUcp(id: number): Promise<boolean>;
  
  // Enhanced UCP operations for comprehensive management
  createUcpWithHistory(ucp: InsertUcp, userId: number): Promise<Ucp>;
  moveUcpToPosition(ucpId: number, newPositionId: number, userId: number, reason?: string): Promise<boolean>;
  dismantleUcp(ucpId: number, userId: number, reason?: string): Promise<boolean>;
  reactivatePallet(palletId: number, userId: number): Promise<string>; // Returns new UCP code
  getArchivedUcps(): Promise<(Ucp & { pallet?: Pallet; position?: Position })[]>;
  
  // UCP Item operations - Enhanced for lifecycle tracking
  getUcpItems(ucpId: number, includeRemoved?: boolean): Promise<(UcpItem & { product?: Product })[]>;
  addUcpItem(item: InsertUcpItem, userId: number): Promise<UcpItem>;
  removeUcpItem(itemId: number, userId: number, reason: string): Promise<boolean>;
  getAvailableUcpsForProduct(productId?: number): Promise<(Ucp & { pallet?: Pallet; position?: Position; availableSpace?: number })[]>;
  
  // UCP History operations
  getUcpHistory(ucpId: number): Promise<(UcpHistory & { performedByUser?: User; item?: UcpItem & { product?: Product }; fromPosition?: Position; toPosition?: Position })[]>;
  addUcpHistoryEntry(entry: InsertUcpHistory): Promise<UcpHistory>;
  
  // UCP Code generation
  getNextUcpCode(): Promise<string>;

  // Movement operations
  getMovements(limit?: number): Promise<(Movement & { ucp?: Ucp; product?: Product; fromPosition?: Position; toPosition?: Position })[]>;
  createMovement(movement: InsertMovement): Promise<Movement>;

  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalPallets: number;
    activeUcps: number;
    occupancyRate: number;
    dailyMovements: number;
    palletsByStatus: { status: string; count: number }[];
  }>;

  // Pallet availability for UCP
  getAvailablePalletsForUcp(): Promise<Pallet[]>;

  // Pallet code generation
  getNextPalletCode(): Promise<string>;

  // Pallet Structure operations
  getPalletStructures(): Promise<PalletStructure[]>;
  getPalletStructure(id: number): Promise<PalletStructure | undefined>;
  createPalletStructure(structure: InsertPalletStructure): Promise<PalletStructure>;
  deletePalletStructure(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Pallet operations
  async getPallets(): Promise<Pallet[]> {
    console.log('DEBUG: Executando consulta getPallets()');
    const result = await db.select().from(pallets).orderBy(desc(pallets.createdAt));
    console.log('DEBUG: Resultado da consulta getPallets():', result.length, 'pallets encontrados');
    console.log('DEBUG: Primeiros 3 pallets:', result.slice(0, 3));
    return result;
  }

  async getPallet(id: number): Promise<Pallet | undefined> {
    const [pallet] = await db.select().from(pallets).where(eq(pallets.id, id));
    return pallet;
  }

  async getPalletByCode(code: string): Promise<Pallet | undefined> {
    const [pallet] = await db.select().from(pallets).where(eq(pallets.code, code));
    return pallet;
  }

  async createPallet(pallet: InsertPallet): Promise<Pallet> {
    const [newPallet] = await db.insert(pallets).values(pallet).returning();
    return newPallet;
  }

  async updatePallet(id: number, pallet: Partial<InsertPallet>): Promise<Pallet | undefined> {
    const [updatedPallet] = await db
      .update(pallets)
      .set({ ...pallet, updatedAt: new Date() })
      .where(eq(pallets.id, id))
      .returning();
    return updatedPallet;
  }

  async deletePallet(id: number): Promise<boolean> {
    const result = await db.delete(pallets).where(eq(pallets.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Position operations
  async getPositions(): Promise<Position[]> {
    return await db.select().from(positions).orderBy(positions.code);
  }

  async getPosition(id: number): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position;
  }

  async getPositionByCode(code: string): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.code, code));
    return position;
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const [newPosition] = await db.insert(positions).values(position).returning();
    return newPosition;
  }

  async updatePosition(id: number, position: Partial<InsertPosition>): Promise<Position | undefined> {
    const [updatedPosition] = await db
      .update(positions)
      .set({ ...position, updatedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();
    return updatedPosition;
  }

  async deletePosition(id: number): Promise<boolean> {
    const result = await db.delete(positions).where(eq(positions.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Product operations
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const [updatedProduct] = await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return !!updatedProduct;
  }

  // UCP operations - Enhanced for lifecycle management
  async getUcps(includeArchived = false): Promise<(Ucp & { pallet?: Pallet; position?: Position })[]> {
    if (includeArchived) {
      return await db
        .select()
        .from(ucps)
        .leftJoin(pallets, eq(ucps.palletId, pallets.id))
        .leftJoin(positions, eq(ucps.positionId, positions.id))
        .orderBy(desc(ucps.createdAt))
        .then(rows => rows.map(row => ({
          ...row.ucps,
          pallet: row.pallets || undefined,
          position: row.positions || undefined,
        })));
    } else {
      return await db
        .select()
        .from(ucps)
        .leftJoin(pallets, eq(ucps.palletId, pallets.id))
        .leftJoin(positions, eq(ucps.positionId, positions.id))
        .where(or(eq(ucps.status, "active"), eq(ucps.status, "empty")))
        .orderBy(desc(ucps.createdAt))
        .then(rows => rows.map(row => ({
          ...row.ucps,
          pallet: row.pallets || undefined,
          position: row.positions || undefined,
        })));
    }
  }

  async getUcp(id: number): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined> {
    const [ucpData] = await db
      .select()
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .where(eq(ucps.id, id));

    if (!ucpData) return undefined;

    const items = await db
      .select()
      .from(ucpItems)
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(eq(ucpItems.ucpId, id))
      .then(rows => rows.map(row => ({
        ...row.ucp_items,
        product: row.products || undefined,
      })));

    return {
      ...ucpData.ucps,
      pallet: ucpData.pallets || undefined,
      position: ucpData.positions || undefined,
      items,
    };
  }

  async getUcpByCode(code: string): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined> {
    const [ucpData] = await db
      .select()
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .where(eq(ucps.code, code));

    if (!ucpData) return undefined;

    const items = await db
      .select()
      .from(ucpItems)
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(eq(ucpItems.ucpId, ucpData.ucps.id))
      .then(rows => rows.map(row => ({
        ...row.ucp_items,
        product: row.products || undefined,
      })));

    return {
      ...ucpData.ucps,
      pallet: ucpData.pallets || undefined,
      position: ucpData.positions || undefined,
      items,
    };
  }

  async createUcp(ucp: InsertUcp): Promise<Ucp> {
    const [newUcp] = await db.insert(ucps).values(ucp).returning();
    return newUcp;
  }

  async updateUcp(id: number, ucp: Partial<InsertUcp>): Promise<Ucp | undefined> {
    const [updatedUcp] = await db
      .update(ucps)
      .set({ ...ucp, updatedAt: new Date() })
      .where(eq(ucps.id, id))
      .returning();
    return updatedUcp;
  }

  async deleteUcp(id: number): Promise<boolean> {
    const result = await db.delete(ucps).where(eq(ucps.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Enhanced UCP operations for comprehensive lifecycle management
  async createUcpWithHistory(ucp: InsertUcp, userId: number): Promise<Ucp> {
    const [newUcp] = await db.insert(ucps).values(ucp).returning();
    
    // Create initial history entry
    await this.addUcpHistoryEntry({
      ucpId: newUcp.id,
      action: "created",
      description: `UCP ${newUcp.code} criada`,
      newValue: { status: newUcp.status, palletId: newUcp.palletId },
      performedBy: userId,
    });

    // Update pallet status to "em_uso" if pallet is assigned
    if (newUcp.palletId) {
      await db.update(pallets)
        .set({ status: "em_uso", updatedAt: new Date() })
        .where(eq(pallets.id, newUcp.palletId));
    }

    return newUcp;
  }

  async moveUcpToPosition(ucpId: number, newPositionId: number, userId: number, reason?: string): Promise<boolean> {
    const currentUcp = await this.getUcp(ucpId);
    if (!currentUcp) return false;

    const oldPositionId = currentUcp.positionId;
    
    // Update UCP position
    await db.update(ucps)
      .set({ positionId: newPositionId, updatedAt: new Date() })
      .where(eq(ucps.id, ucpId));

    // Update position statuses
    if (oldPositionId) {
      await db.update(positions)
        .set({ status: "disponivel", updatedAt: new Date() })
        .where(eq(positions.id, oldPositionId));
    }
    
    await db.update(positions)
      .set({ status: "ocupada", updatedAt: new Date() })
      .where(eq(positions.id, newPositionId));

    // Create history entry
    await this.addUcpHistoryEntry({
      ucpId,
      action: "moved",
      description: `UCP movida ${reason ? `- ${reason}` : ''}`,
      oldValue: { positionId: oldPositionId },
      newValue: { positionId: newPositionId },
      fromPositionId: oldPositionId || undefined,
      toPositionId: newPositionId,
      performedBy: userId,
    });

    return true;
  }

  async dismantleUcp(ucpId: number, userId: number, reason?: string): Promise<boolean> {
    const currentUcp = await this.getUcp(ucpId);
    if (!currentUcp) return false;

    // Mark all active items as removed
    await db.update(ucpItems)
      .set({ 
        isActive: false, 
        removedBy: userId, 
        removedAt: new Date(),
        removalReason: reason || "UCP desmontada"
      })
      .where(and(eq(ucpItems.ucpId, ucpId), eq(ucpItems.isActive, true)));

    // Update UCP status to archived
    await db.update(ucps)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(ucps.id, ucpId));

    // Free the pallet
    if (currentUcp.palletId) {
      await db.update(pallets)
        .set({ status: "disponivel", updatedAt: new Date() })
        .where(eq(pallets.id, currentUcp.palletId));
    }

    // Free the position
    if (currentUcp.positionId) {
      await db.update(positions)
        .set({ status: "disponivel", updatedAt: new Date() })
        .where(eq(positions.id, currentUcp.positionId));
    }

    // Create history entry
    await this.addUcpHistoryEntry({
      ucpId,
      action: "dismantled",
      description: `UCP desmontada${reason ? ` - ${reason}` : ''}`,
      oldValue: { status: currentUcp.status },
      newValue: { status: "archived" },
      performedBy: userId,
    });

    return true;
  }

  async reactivatePallet(palletId: number, userId: number): Promise<string> {
    const newUcpCode = await this.getNextUcpCode();
    
    const newUcp = await this.createUcpWithHistory({
      code: newUcpCode,
      palletId,
      status: "active",
      createdBy: userId,
    }, userId);

    return newUcp.code;
  }

  async getArchivedUcps(): Promise<(Ucp & { pallet?: Pallet; position?: Position })[]> {
    return await db
      .select()
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .where(eq(ucps.status, "archived"))
      .orderBy(desc(ucps.updatedAt))
      .then(rows => rows.map(row => ({
        ...row.ucps,
        pallet: row.pallets || undefined,
        position: row.positions || undefined,
      })));
  }

  async getUcpItems(ucpId: number, includeRemoved = false): Promise<(UcpItem & { product?: Product })[]> {
    if (includeRemoved) {
      return await db
        .select()
        .from(ucpItems)
        .leftJoin(products, eq(ucpItems.productId, products.id))
        .where(eq(ucpItems.ucpId, ucpId))
        .then(rows => rows.map(row => ({
          ...row.ucp_items,
          product: row.products || undefined,
        })));
    } else {
      return await db
        .select()
        .from(ucpItems)
        .leftJoin(products, eq(ucpItems.productId, products.id))
        .where(and(eq(ucpItems.ucpId, ucpId), eq(ucpItems.isActive, true)))
        .then(rows => rows.map(row => ({
          ...row.ucp_items,
          product: row.products || undefined,
        })));
    }
  }

  async addUcpItem(item: InsertUcpItem, userId: number): Promise<UcpItem> {
    const [newItem] = await db.insert(ucpItems).values({
      ...item,
      addedBy: userId,
    }).returning();

    // Create history entry
    await this.addUcpHistoryEntry({
      ucpId: item.ucpId,
      action: "item_added",
      description: `Produto adicionado à UCP`,
      newValue: { productId: item.productId, quantity: item.quantity },
      itemId: newItem.id,
      performedBy: userId,
    });

    return newItem;
  }

  async removeUcpItem(itemId: number, userId: number, reason: string): Promise<boolean> {
    const item = await db.select().from(ucpItems).where(eq(ucpItems.id, itemId)).then(rows => rows[0]);
    if (!item) return false;

    // Mark item as removed instead of deleting
    await db.update(ucpItems)
      .set({ 
        isActive: false, 
        removedBy: userId, 
        removedAt: new Date(),
        removalReason: reason
      })
      .where(eq(ucpItems.id, itemId));

    // Create history entry
    await this.addUcpHistoryEntry({
      ucpId: item.ucpId,
      action: "item_removed",
      description: `Produto removido da UCP - ${reason}`,
      oldValue: { productId: item.productId, quantity: item.quantity },
      itemId: itemId,
      performedBy: userId,
    });

    // Check if UCP is now empty and update status
    const remainingItems = await this.getUcpItems(item.ucpId, false);
    if (remainingItems.length === 0) {
      await db.update(ucps)
        .set({ status: "empty", updatedAt: new Date() })
        .where(eq(ucps.id, item.ucpId));

      await this.addUcpHistoryEntry({
        ucpId: item.ucpId,
        action: "status_changed",
        description: "UCP marcada como vazia - último item removido",
        oldValue: { status: "active" },
        newValue: { status: "empty" },
        performedBy: userId,
      });
    }

    return true;
  }

  async getAvailableUcpsForProduct(productId?: number): Promise<(Ucp & { pallet?: Pallet; position?: Position; availableSpace?: number })[]> {
    return await db
      .select()
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .where(eq(ucps.status, "active"))
      .orderBy(desc(ucps.createdAt))
      .then(rows => rows.map(row => ({
        ...row.ucps,
        pallet: row.pallets || undefined,
        position: row.positions || undefined,
        availableSpace: 100, // TODO: Calculate based on pallet capacity and current items
      })));
  }

  async getUcpHistory(ucpId: number): Promise<(UcpHistory & { performedByUser?: User; item?: UcpItem & { product?: Product }; fromPosition?: Position; toPosition?: Position })[]> {
    return await db
      .select()
      .from(ucpHistory)
      .leftJoin(users, eq(ucpHistory.performedBy, users.id))
      .leftJoin(ucpItems, eq(ucpHistory.itemId, ucpItems.id))
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .leftJoin(positions, eq(ucpHistory.fromPositionId, positions.id))
      .where(eq(ucpHistory.ucpId, ucpId))
      .orderBy(desc(ucpHistory.timestamp))
      .then(rows => rows.map(row => ({
        ...row.ucp_history,
        performedByUser: row.users || undefined,
        item: row.ucp_items ? {
          ...row.ucp_items,
          product: row.products || undefined,
        } : undefined,
        fromPosition: row.positions || undefined,
        toPosition: undefined, // Would need separate join for toPosition
      })));
  }

  async addUcpHistoryEntry(entry: InsertUcpHistory): Promise<UcpHistory> {
    const [newEntry] = await db.insert(ucpHistory).values(entry).returning();
    return newEntry;
  }

  async getNextUcpCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    
    // Get the highest UCP number for today
    const lastUcp = await db
      .select()
      .from(ucps)
      .where(like(ucps.code, `UCP-${dateStr}-%`))
      .orderBy(desc(ucps.code))
      .limit(1)
      .then(rows => rows[0]);

    let nextNumber = 1;
    if (lastUcp) {
      const lastNumber = parseInt(lastUcp.code.split('-')[2] || '0');
      nextNumber = lastNumber + 1;
    }

    return `UCP-${dateStr}-${nextNumber.toString().padStart(4, '0')}`;
  }

  // Movement operations
  async getMovements(limit = 50): Promise<(Movement & { ucp?: Ucp; product?: Product; fromPosition?: Position; toPosition?: Position })[]> {
    return await db
      .select()
      .from(movements)
      .leftJoin(ucps, eq(movements.ucpId, ucps.id))
      .leftJoin(products, eq(movements.productId, products.id))
      .leftJoin(positions, eq(movements.fromPositionId, positions.id))
      .orderBy(desc(movements.createdAt))
      .limit(limit)
      .then(rows => rows.map(row => ({
        ...row.movements,
        ucp: row.ucps || undefined,
        product: row.products || undefined,
        fromPosition: row.positions || undefined,
        toPosition: undefined, // Note: This would need a second join for toPosition
      })));
  }

  async createMovement(movement: InsertMovement): Promise<Movement> {
    const [newMovement] = await db.insert(movements).values(movement).returning();
    return newMovement;
  }

  // Dashboard statistics
  async getDashboardStats(): Promise<{
    totalPallets: number;
    activeUcps: number;
    occupancyRate: number;
    dailyMovements: number;
    palletsByStatus: { status: string; count: number }[];
  }> {
    const [totalPalletsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pallets);

    const [activeUcpsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ucps)
      .where(eq(ucps.status, "active"));

    const [totalPositionsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(positions);

    const [occupiedPositionsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(positions)
      .where(eq(positions.status, "occupied"));

    const [dailyMovementsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(movements)
      .where(sql`DATE(created_at) = CURRENT_DATE`);

    const palletsByStatus = await db
      .select({
        status: pallets.status,
        count: sql<number>`count(*)`,
      })
      .from(pallets)
      .groupBy(pallets.status);

    const occupancyRate = totalPositionsResult.count > 0 
      ? (occupiedPositionsResult.count / totalPositionsResult.count) * 100 
      : 0;

    return {
      totalPallets: totalPalletsResult.count,
      activeUcps: activeUcpsResult.count,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      dailyMovements: dailyMovementsResult.count,
      palletsByStatus: palletsByStatus.map(item => ({
        status: item.status,
        count: item.count,
      })),
    };
  }

  async getAvailablePalletsForUcp(): Promise<Pallet[]> {
    // Consulta SQL direta para buscar pallets disponíveis que não estão em UCPs ativas
    const result = await db.execute(sql`
      SELECT p.* FROM pallets p
      WHERE p.status = 'available'
      AND p.id NOT IN (
        SELECT DISTINCT u.pallet_id 
        FROM ucps u 
        WHERE u.status = 'active' 
        AND u.pallet_id IS NOT NULL
      )
      ORDER BY p.created_at DESC
    `);

    return result.rows as Pallet[];
  }

  async getNextPalletCode(): Promise<string> {
    // Busca todos os códigos existentes no formato PLT#### 
    const existingPallets = await db
      .select({ code: pallets.code })
      .from(pallets)
      .where(sql`code ~ '^PLT[0-9]{4}$'`)
      .orderBy(pallets.code);

    // Extrai números dos códigos existentes
    const existingNumbers = existingPallets
      .map(p => parseInt(p.code.replace('PLT', ''), 10))
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b);

    // Encontra o próximo número sequencial disponível
    let nextNumber = 1;
    for (const num of existingNumbers) {
      if (num === nextNumber) {
        nextNumber++;
      } else if (num > nextNumber) {
        break;
      }
    }

    // Formata o código com zero padding
    return `PLT${nextNumber.toString().padStart(4, '0')}`;
  }

  // Pallet Structure operations
  async getPalletStructures(): Promise<PalletStructure[]> {
    return await db.select().from(palletStructures).orderBy(desc(palletStructures.createdAt));
  }

  async getPalletStructure(id: number): Promise<PalletStructure | undefined> {
    const [structure] = await db.select().from(palletStructures).where(eq(palletStructures.id, id));
    return structure;
  }

  async createPalletStructure(structureData: InsertPalletStructure): Promise<PalletStructure> {
    // Criar a estrutura
    const [structure] = await db
      .insert(palletStructures)
      .values(structureData)
      .returning();

    // Gerar automaticamente todas as vagas com endereçamento PP-RUA-LADO-POSIÇÃO-NÍVEL
    const positionsToInsert: InsertPosition[] = [];
    
    for (let level = 0; level <= structure.maxLevels; level++) {
      for (let position = 1; position <= structure.maxPositions; position++) {
        const positionCode = `PP-${structure.street}-${structure.side}-${position.toString().padStart(2, '0')}-${level}`;
        
        positionsToInsert.push({
          code: positionCode,
          street: structure.street,
          side: structure.side,
          position: position,
          level: level,
          status: 'available',
          structureId: structure.id,
          maxPallets: 1,
          rackType: structure.rackType || 'conventional',
          corridor: null,
          restrictions: null,
          createdBy: structureData.createdBy,
          observations: `Vaga gerada automaticamente da estrutura ${structure.name}`,
          hasDivision: false,
          layoutConfig: null,
        });
      }
    }

    // Inserir todas as vagas em batch
    if (positionsToInsert.length > 0) {
      await db.insert(positions).values(positionsToInsert);
    }

    return structure;
  }

  async deletePalletStructure(id: number): Promise<boolean> {
    // Primeiro, deletar todas as vagas associadas à estrutura
    await db.delete(positions).where(eq(positions.structureId, id));
    
    // Depois, deletar a estrutura
    const result = await db.delete(palletStructures).where(eq(palletStructures.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
