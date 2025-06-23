import {
  users,
  pallets,
  positions,
  products,
  ucps,
  ucpItems,
  movements,
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
  type Movement,
  type InsertMovement,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, like, or } from "drizzle-orm";

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

  // UCP operations
  getUcps(): Promise<(Ucp & { pallet?: Pallet; position?: Position })[]>;
  getUcp(id: number): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined>;
  getUcpByCode(code: string): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined>;
  createUcp(ucp: InsertUcp): Promise<Ucp>;
  updateUcp(id: number, ucp: Partial<InsertUcp>): Promise<Ucp | undefined>;
  deleteUcp(id: number): Promise<boolean>;

  // UCP Item operations
  getUcpItems(ucpId: number): Promise<(UcpItem & { product?: Product })[]>;
  addUcpItem(item: InsertUcpItem): Promise<UcpItem>;
  removeUcpItem(id: number): Promise<boolean>;

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

  // Pallet code generation
  getNextPalletCode(): Promise<string>;
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
    return await db.select().from(pallets).orderBy(desc(pallets.createdAt));
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
    return result.rowCount > 0;
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
    return result.rowCount > 0;
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

  // UCP operations
  async getUcps(): Promise<(Ucp & { pallet?: Pallet; position?: Position })[]> {
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
      })));
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
    return result.rowCount > 0;
  }

  // UCP Item operations
  async getUcpItems(ucpId: number): Promise<(UcpItem & { product?: Product })[]> {
    return await db
      .select()
      .from(ucpItems)
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(eq(ucpItems.ucpId, ucpId))
      .then(rows => rows.map(row => ({
        ...row.ucp_items,
        product: row.products || undefined,
      })));
  }

  async addUcpItem(item: InsertUcpItem): Promise<UcpItem> {
    const [newItem] = await db.insert(ucpItems).values(item).returning();
    return newItem;
  }

  async removeUcpItem(id: number): Promise<boolean> {
    const result = await db.delete(ucpItems).where(eq(ucpItems.id, id));
    return result.rowCount > 0;
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
}

export const storage = new DatabaseStorage();
