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
} from "./db/schema.js";
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
  upsertUser(user: Omit<InsertUser, 'id'>): Promise<User>;

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

  async upsertUser(user: Omit<InsertUser, 'id'>): Promise<User> {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email));

    if (existingUser) {
      const [updatedUser] = await db
        .update(users)
        .set({ ...user, updatedAt: new Date() })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updatedUser;
    } else {
      const [newUser] = await db
        .insert(users)
        .values(user)
        .returning();
      return newUser;
    }
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
    // Use a single query with JOINs to get all data at once
    const result = await db
      .select({
        // UCP fields
        ucpId: ucps.id,
        ucpCode: ucps.code,
        ucpStatus: ucps.status,
        ucpPalletId: ucps.palletId,
        ucpPositionId: ucps.positionId,
        ucpCreatedBy: ucps.createdBy,
        ucpCreatedAt: ucps.createdAt,
        ucpUpdatedAt: ucps.updatedAt,
        
        // Pallet fields
        palletId: pallets.id,
        palletCode: pallets.code,
        palletStatus: pallets.status,
        palletType: pallets.type,
        palletMaxWeight: pallets.maxWeight,
        palletCurrentWeight: pallets.currentWeight,
        palletCreatedAt: pallets.createdAt,
        palletUpdatedAt: pallets.updatedAt,
        
        // Position fields
        positionId: positions.id,
        positionCode: positions.code,
        positionStatus: positions.status,
        positionStreet: positions.street,
        positionSide: positions.side,
        positionLevel: positions.level,
        positionPosition: positions.position,
        positionCreatedAt: positions.createdAt,
        positionUpdatedAt: positions.updatedAt,
        
        // UCP Item fields
        itemId: ucpItems.id,
        itemQuantity: ucpItems.quantity,
        itemIsActive: ucpItems.isActive,
        itemAddedBy: ucpItems.addedBy,
        itemAddedAt: ucpItems.addedAt,
        itemRemovedBy: ucpItems.removedBy,
        itemRemovedAt: ucpItems.removedAt,
        itemRemovalReason: ucpItems.removalReason,
        
        // Product fields
        productId: products.id,
        productSku: products.sku,
        productName: products.name,
        productDescription: products.description,
        productWeight: products.weight,
        productIsActive: products.isActive,
        productCreatedAt: products.createdAt,
        productUpdatedAt: products.updatedAt,
      })
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .leftJoin(ucpItems, eq(ucps.id, ucpItems.ucpId))
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(eq(ucps.id, id));

    if (result.length === 0) return undefined;

    const firstRow = result[0];
    
    // Build the UCP object
    const ucp: Ucp = {
      id: firstRow.ucpId,
      code: firstRow.ucpCode,
      status: firstRow.ucpStatus,
      palletId: firstRow.ucpPalletId,
      positionId: firstRow.ucpPositionId,
      createdBy: firstRow.ucpCreatedBy,
      createdAt: firstRow.ucpCreatedAt,
      updatedAt: firstRow.ucpUpdatedAt,
    };

    // Build the pallet object if exists
    const pallet = firstRow.palletId ? {
      id: firstRow.palletId,
      code: firstRow.palletCode,
      status: firstRow.palletStatus,
      type: firstRow.palletType,
      maxWeight: firstRow.palletMaxWeight,
      currentWeight: firstRow.palletCurrentWeight,
      createdAt: firstRow.palletCreatedAt,
      updatedAt: firstRow.palletUpdatedAt,
    } : undefined;

    // Build the position object if exists
    const position = firstRow.positionId ? {
      id: firstRow.positionId,
      code: firstRow.positionCode,
      status: firstRow.positionStatus,
      street: firstRow.positionStreet,
      side: firstRow.positionSide,
      level: firstRow.positionLevel,
      position: firstRow.positionPosition,
      createdAt: firstRow.positionCreatedAt,
      updatedAt: firstRow.positionUpdatedAt,
    } : undefined;

    // Build the items array
    const itemsMap = new Map();
    result.forEach(row => {
      if (row.itemId && !itemsMap.has(row.itemId)) {
        itemsMap.set(row.itemId, {
          id: row.itemId,
          ucpId: row.ucpId,
          productId: row.productId,
          quantity: row.itemQuantity,
          isActive: row.itemIsActive,
          addedBy: row.itemAddedBy,
          addedAt: row.itemAddedAt,
          removedBy: row.itemRemovedBy,
          removedAt: row.itemRemovedAt,
          removalReason: row.itemRemovalReason,
          product: row.productId ? {
            id: row.productId,
            sku: row.productSku,
            name: row.productName,
            description: row.productDescription,
            weight: row.productWeight,
            isActive: row.productIsActive,
            createdAt: row.productCreatedAt,
            updatedAt: row.productUpdatedAt,
          } : undefined,
        });
      }
    });

    const items = Array.from(itemsMap.values());

    return {
      ...ucp,
      pallet,
      position,
      items,
    };
  }

  async getUcpByCode(code: string): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined> {
    // Use a single query with JOINs to get all data at once
    const result = await db
      .select({
        // UCP fields
        ucpId: ucps.id,
        ucpCode: ucps.code,
        ucpStatus: ucps.status,
        ucpPalletId: ucps.palletId,
        ucpPositionId: ucps.positionId,
        ucpCreatedBy: ucps.createdBy,
        ucpCreatedAt: ucps.createdAt,
        ucpUpdatedAt: ucps.updatedAt,
        
        // Pallet fields
        palletId: pallets.id,
        palletCode: pallets.code,
        palletStatus: pallets.status,
        palletType: pallets.type,
        palletMaxWeight: pallets.maxWeight,
        palletCurrentWeight: pallets.currentWeight,
        palletCreatedAt: pallets.createdAt,
        palletUpdatedAt: pallets.updatedAt,
        
        // Position fields
        positionId: positions.id,
        positionCode: positions.code,
        positionStatus: positions.status,
        positionStreet: positions.street,
        positionSide: positions.side,
        positionLevel: positions.level,
        positionPosition: positions.position,
        positionCreatedAt: positions.createdAt,
        positionUpdatedAt: positions.updatedAt,
        
        // UCP Item fields
        itemId: ucpItems.id,
        itemQuantity: ucpItems.quantity,
        itemIsActive: ucpItems.isActive,
        itemAddedBy: ucpItems.addedBy,
        itemAddedAt: ucpItems.addedAt,
        itemRemovedBy: ucpItems.removedBy,
        itemRemovedAt: ucpItems.removedAt,
        itemRemovalReason: ucpItems.removalReason,
        
        // Product fields
        productId: products.id,
        productSku: products.sku,
        productName: products.name,
        productDescription: products.description,
        productWeight: products.weight,
        productIsActive: products.isActive,
        productCreatedAt: products.createdAt,
        productUpdatedAt: products.updatedAt,
      })
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .leftJoin(ucpItems, eq(ucps.id, ucpItems.ucpId))
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(eq(ucps.code, code));

    if (result.length === 0) return undefined;

    const firstRow = result[0];
    
    // Build the UCP object
    const ucp: Ucp = {
      id: firstRow.ucpId,
      code: firstRow.ucpCode,
      status: firstRow.ucpStatus,
      palletId: firstRow.ucpPalletId,
      positionId: firstRow.ucpPositionId,
      createdBy: firstRow.ucpCreatedBy,
      createdAt: firstRow.ucpCreatedAt,
      updatedAt: firstRow.ucpUpdatedAt,
    };

    // Build the pallet object if exists
    const pallet = firstRow.palletId ? {
      id: firstRow.palletId,
      code: firstRow.palletCode,
      status: firstRow.palletStatus,
      type: firstRow.palletType,
      maxWeight: firstRow.palletMaxWeight,
      currentWeight: firstRow.palletCurrentWeight,
      createdAt: firstRow.palletCreatedAt,
      updatedAt: firstRow.palletUpdatedAt,
    } : undefined;

    // Build the position object if exists
    const position = firstRow.positionId ? {
      id: firstRow.positionId,
      code: firstRow.positionCode,
      status: firstRow.positionStatus,
      street: firstRow.positionStreet,
      side: firstRow.positionSide,
      level: firstRow.positionLevel,
      position: firstRow.positionPosition,
      createdAt: firstRow.positionCreatedAt,
      updatedAt: firstRow.positionUpdatedAt,
    } : undefined;

    // Build the items array
    const itemsMap = new Map();
    result.forEach(row => {
      if (row.itemId && !itemsMap.has(row.itemId)) {
        itemsMap.set(row.itemId, {
          id: row.itemId,
          ucpId: row.ucpId,
          productId: row.productId,
          quantity: row.itemQuantity,
          isActive: row.itemIsActive,
          addedBy: row.itemAddedBy,
          addedAt: row.itemAddedAt,
          removedBy: row.itemRemovedBy,
          removedAt: row.itemRemovedAt,
          removalReason: row.itemRemovalReason,
          product: row.productId ? {
            id: row.productId,
            sku: row.productSku,
            name: row.productName,
            description: row.productDescription,
            weight: row.productWeight,
            isActive: row.productIsActive,
            createdAt: row.productCreatedAt,
            updatedAt: row.productUpdatedAt,
          } : undefined,
        });
      }
    });

    const items = Array.from(itemsMap.values());

    return {
      ...ucp,
      pallet,
      position,
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
    return await db.transaction(async (tx) => {
      // Create the UCP
      const [newUcp] = await tx.insert(ucps).values(ucp).returning();
      
      // Create initial history entry
      await tx.insert(ucpHistory).values({
        ucpId: newUcp.id,
        action: "created",
        description: `UCP ${newUcp.code} criada`,
        newValue: { status: newUcp.status, palletId: newUcp.palletId },
        performedBy: userId,
      });

      // Update pallet status to "em_uso" if pallet is assigned
      if (newUcp.palletId) {
        await tx.update(pallets)
          .set({ status: "em_uso", updatedAt: new Date() })
          .where(eq(pallets.id, newUcp.palletId));
      }

      return newUcp;
    });
  }

  async moveUcpToPosition(ucpId: number, newPositionId: number, userId: number, reason?: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Get current UCP data
      const [currentUcp] = await tx.select().from(ucps).where(eq(ucps.id, ucpId));
      if (!currentUcp) return false;

      const oldPositionId = currentUcp.positionId;
      
      // Update UCP position
      await tx.update(ucps)
        .set({ positionId: newPositionId, updatedAt: new Date() })
        .where(eq(ucps.id, ucpId));

      // Update old position status if it exists
      if (oldPositionId) {
        await tx.update(positions)
          .set({ status: "disponivel", updatedAt: new Date() })
          .where(eq(positions.id, oldPositionId));
      }
      
      // Update new position status
      await tx.update(positions)
        .set({ status: "ocupada", updatedAt: new Date() })
        .where(eq(positions.id, newPositionId));

      // Create history entry
      await tx.insert(ucpHistory).values({
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
    });
  }

  async dismantleUcp(ucpId: number, userId: number, reason?: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Get current UCP data
      const [currentUcp] = await tx.select().from(ucps).where(eq(ucps.id, ucpId));
      if (!currentUcp) return false;

      // Mark all active items as removed
      await tx.update(ucpItems)
        .set({ 
          isActive: false, 
          removedBy: userId, 
          removedAt: new Date(),
          removalReason: reason || "UCP desmontada"
        })
        .where(and(eq(ucpItems.ucpId, ucpId), eq(ucpItems.isActive, true)));

      // Update UCP status to archived
      await tx.update(ucps)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(ucps.id, ucpId));

      // Free the pallet if assigned
      if (currentUcp.palletId) {
        await tx.update(pallets)
          .set({ status: "disponivel", updatedAt: new Date() })
          .where(eq(pallets.id, currentUcp.palletId));
      }

      // Free the position if assigned
      if (currentUcp.positionId) {
        await tx.update(positions)
          .set({ status: "disponivel", updatedAt: new Date() })
          .where(eq(positions.id, currentUcp.positionId));
      }

      // Create history entry
      await tx.insert(ucpHistory).values({
        ucpId,
        action: "dismantled",
        description: `UCP desmontada${reason ? ` - ${reason}` : ''}`,
        oldValue: { status: currentUcp.status },
        newValue: { status: "archived" },
        performedBy: userId,
      });

      return true;
    });
  }

  async reactivatePallet(palletId: number, userId: number): Promise<string> {
    return await db.transaction(async (tx) => {
      const newUcpCode = await this.getNextUcpCode();
      
      // Create new UCP
      const [newUcp] = await tx.insert(ucps).values({
        code: newUcpCode,
        palletId,
        status: "active",
        createdBy: userId,
      }).returning();

      // Create initial history entry
      await tx.insert(ucpHistory).values({
        ucpId: newUcp.id,
        action: "created",
        description: `UCP ${newUcp.code} criada por reativação de pallet`,
        newValue: { status: newUcp.status, palletId: newUcp.palletId },
        performedBy: userId,
      });

      // Update pallet status to "em_uso"
      await tx.update(pallets)
        .set({ status: "em_uso", updatedAt: new Date() })
        .where(eq(pallets.id, palletId));

      return newUcp.code;
    });
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
    return await db.transaction(async (tx) => {
      const [newItem] = await tx.insert(ucpItems).values({
        ...item,
        addedBy: userId,
      }).returning();

      // Create history entry
      await tx.insert(ucpHistory).values({
        ucpId: item.ucpId,
        action: "item_added",
        description: `Produto adicionado à UCP`,
        newValue: { productId: item.productId, quantity: item.quantity },
        itemId: newItem.id,
        performedBy: userId,
      });

      return newItem;
    });
  }

  async removeUcpItem(itemId: number, userId: number, reason: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Get the item data
      const [item] = await tx.select().from(ucpItems).where(eq(ucpItems.id, itemId));
      if (!item) return false;

      // Mark item as removed instead of deleting
      await tx.update(ucpItems)
        .set({ 
          isActive: false, 
          removedBy: userId, 
          removedAt: new Date(),
          removalReason: reason
        })
        .where(eq(ucpItems.id, itemId));

      // Create history entry
      await tx.insert(ucpHistory).values({
        ucpId: item.ucpId,
        action: "item_removed",
        description: `Produto removido da UCP - ${reason}`,
        oldValue: { productId: item.productId, quantity: item.quantity },
        itemId: itemId,
        performedBy: userId,
      });

      // Check if UCP is now empty and update status
      const [remainingItemsCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(ucpItems)
        .where(and(eq(ucpItems.ucpId, item.ucpId), eq(ucpItems.isActive, true)));

      if (remainingItemsCount.count === 0) {
        await tx.update(ucps)
          .set({ status: "empty", updatedAt: new Date() })
          .where(eq(ucps.id, item.ucpId));

        await tx.insert(ucpHistory).values({
          ucpId: item.ucpId,
          action: "status_changed",
          description: "UCP marcada como vazia - último item removido",
          oldValue: { status: "active" },
          newValue: { status: "empty" },
          performedBy: userId,
        });
      }

      return true;
    });
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
    try {
      const result = await db
        .select({
          id: ucpHistory.id,
          ucpId: ucpHistory.ucpId,
          action: ucpHistory.action,
          description: ucpHistory.description,
          oldValue: ucpHistory.oldValue,
          newValue: ucpHistory.newValue,
          itemId: ucpHistory.itemId,
          fromPositionId: ucpHistory.fromPositionId,
          toPositionId: ucpHistory.toPositionId,
          performedBy: ucpHistory.performedBy,
          timestamp: ucpHistory.timestamp,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(ucpHistory)
        .leftJoin(users, eq(ucpHistory.performedBy, users.id))
        .where(eq(ucpHistory.ucpId, ucpId))
        .orderBy(desc(ucpHistory.timestamp));

      console.log(`DEBUG: Raw query result for UCP ${ucpId}:`, result);

      return result.map(row => ({
        id: row.id,
        ucpId: row.ucpId,
        action: row.action,
        description: row.description,
        oldValue: row.oldValue,
        newValue: row.newValue,
        itemId: row.itemId,
        fromPositionId: row.fromPositionId,
        toPositionId: row.toPositionId,
        performedBy: row.performedBy,
        timestamp: row.timestamp?.toISOString() || null,
        performedByUser: row.userFirstName ? {
          id: row.performedBy,
          firstName: row.userFirstName,
          lastName: row.userLastName,
          email: row.userEmail || '',
        } : undefined,
      }));
    } catch (error) {
      console.error('Error in getUcpHistory:', error);
      throw error;
    }
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
    // Busca todos os pallets com status 'available'
    const allAvailablePallets = await db
      .select()
      .from(pallets)
      .where(eq(pallets.status, 'available'))
      .orderBy(desc(pallets.createdAt));

    // Para UCPs, consideramos todos os pallets com status 'available' como disponíveis
    // já que o status do pallet é gerenciado automaticamente pelo sistema
    return allAvailablePallets;
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
    return await db.transaction(async (tx) => {
      // Create the structure
      const [structure] = await tx
        .insert(palletStructures)
        .values(structureData)
        .returning();

      // Generate all positions automatically with addressing PP-STREET-SIDE-POSITION-LEVEL
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

      // Insert all positions in a single batch operation
      if (positionsToInsert.length > 0) {
        await tx.insert(positions).values(positionsToInsert);
      }

      return structure;
    });
  }

  async deletePalletStructure(id: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // First, delete all positions associated with the structure
      await tx.delete(positions).where(eq(positions.structureId, id));
      
      // Then, delete the structure
      const result = await tx.delete(palletStructures).where(eq(palletStructures.id, id));
      return (result.rowCount ?? 0) > 0;
    });
  }
}

export const storage = new DatabaseStorage();
