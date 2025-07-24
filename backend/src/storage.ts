import {
  users,
  pallets,
  positions,
  products,
  productPhotos,
  productPhotoHistory,
  ucps,
  ucpItems,
  ucpHistory,
  itemTransfers,
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
  type ProductPhoto,
  type InsertProductPhoto,
  type ProductPhotoHistory,
  type InsertProductPhotoHistory,
  type Ucp,
  type InsertUcp,
  type UcpItem,
  type InsertUcpItem,
  type UcpHistory,
  type InsertUcpHistory,
  type ItemTransfer,
  type InsertItemTransfer,
  type Movement,
  type InsertMovement,
  type PalletStructure,
  type InsertPalletStructure,
} from "./db/schema.js";
import { db } from "./db";
import { imageService } from "./services/image.service";
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
  getProductsWithStock(id?: number): Promise<any[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Product Photo operations
  getProductPhotos(productId: number): Promise<any[]>;
  getProductPhoto(photoId: number): Promise<any>;
  addProductPhoto(photo: InsertProductPhoto, userId: number): Promise<ProductPhoto>;
  removeProductPhoto(photoId: number, userId: number, notes?: string): Promise<boolean>;
  setPrimaryPhoto(photoId: number, userId: number): Promise<boolean>;
  getProductPhotoHistory(productId: number): Promise<any[]>;

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
    const result = await db.select().from(pallets).orderBy(desc(pallets.createdAt));
    return result.map((row: any) => ({
      ...row,
      // Ensure proper camelCase conversion for fields that may come as snake_case
      maxWeight: row.max_weight !== undefined ? row.max_weight : row.maxWeight,
      photoUrl: row.photo_url !== undefined ? row.photo_url : row.photoUrl,
      lastInspectionDate: row.last_inspection_date !== undefined ? row.last_inspection_date : row.lastInspectionDate,
      createdBy: row.created_by !== undefined ? row.created_by : row.createdBy,
      createdAt: row.created_at !== undefined ? row.created_at : row.createdAt,
      updatedAt: row.updated_at !== undefined ? row.updated_at : row.updatedAt
    }));
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
    const result = await db.select().from(positions).orderBy(positions.code);
    return result.map((row: any) => ({
      ...row,
      // Ensure proper camelCase conversion for fields that may come as snake_case
      structureId: row.structure_id !== undefined ? row.structure_id : row.structureId,
      currentPalletId: row.current_pallet_id !== undefined ? row.current_pallet_id : row.currentPalletId,
      createdBy: row.created_by !== undefined ? row.created_by : row.createdBy,
      createdAt: row.created_at !== undefined ? row.created_at : row.createdAt,
      updatedAt: row.updated_at !== undefined ? row.updated_at : row.updatedAt,
      hasDivision: row.has_division !== undefined ? row.has_division : row.hasDivision,
      layoutConfig: row.layout_config !== undefined ? row.layout_config : row.layoutConfig,
      rackType: row.rack_type !== undefined ? row.rack_type : row.rackType,
      maxPallets: row.max_pallets !== undefined ? row.max_pallets : row.maxPallets
    }));
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

  async getProductsWithStock(id?: number): Promise<any[]> {
    const whereId = id ? sql`AND p.id = ${id}` : sql``;
    const query = sql`
      SELECT 
        p.*,
        COALESCE(SUM(ui.quantity)::decimal, 0) as total_stock,
        jsonb_agg(
          DISTINCT 
          CASE 
            WHEN ui.id IS NOT NULL THEN 
              jsonb_build_object(
                'ucp_id', u.id,
                'ucp_code', u.code,
                'ucp_type', COALESCE(pal.type, 'N/A'),
                'position_code', pos.code,
                'quantity', ui.quantity,
                'lot', ui.lot,
                'expiry_date', ui.expiry_date,
                'internal_code', ui.internal_code
              )
            ELSE NULL
          END
        ) FILTER (WHERE ui.id IS NOT NULL) as ucp_stock
      FROM products p
      LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
      LEFT JOIN ucps u ON ui.ucp_id = u.id
      LEFT JOIN pallets pal ON u.pallet_id = pal.id
      LEFT JOIN positions pos ON u.position_id = pos.id
      WHERE p.is_active = true ${whereId}
      GROUP BY p.id, p.sku, p.name, p.description, p.category, p.brand, p.unit, p.weight, 
               p.dimensions, p.barcode, p.requires_lot, p.requires_expiry, p.min_stock, 
               p.max_stock, p.is_active, p.created_by, p.created_at, p.updated_at
      ORDER BY p.name
    `;
    
    const result = await db.execute(query);
    return result.rows.map((row: any) => ({
      ...row,
      totalStock: parseFloat(row.total_stock) || 0,
      ucpStock: row.ucp_stock || [],
      // Ensure proper camelCase conversion for fields that may come as snake_case
      isActive: row.is_active !== undefined ? row.is_active : row.isActive,
      createdBy: row.created_by !== undefined ? row.created_by : row.createdBy,
      createdAt: row.created_at !== undefined ? row.created_at : row.createdAt,
      updatedAt: row.updated_at !== undefined ? row.updated_at : row.updatedAt,
      requiresLot: row.requires_lot !== undefined ? row.requires_lot : row.requiresLot,
      requiresExpiry: row.requires_expiry !== undefined ? row.requires_expiry : row.requiresExpiry,
      minStock: row.min_stock !== undefined ? row.min_stock : row.minStock,
      maxStock: row.max_stock !== undefined ? row.max_stock : row.maxStock
    }));
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

  // Product Photo operations
  async getProductPhotos(productId: number): Promise<any[]> {
    const result = await db
      .select()
      .from(productPhotos)
      .leftJoin(users, eq(productPhotos.uploadedBy, users.id))
      .where(and(eq(productPhotos.productId, productId), eq(productPhotos.isActive, true)))
      .orderBy(desc(productPhotos.isPrimary), desc(productPhotos.uploadedAt));

    return result.map(row => {
      const photo = row.product_photos;
      const user = row.users;
      return {
        ...photo,
        uploadedBy: user || undefined,
      };
    });
  }

  async getProductPhoto(photoId: number): Promise<any> {
    const result = await db
      .select()
      .from(productPhotos)
      .leftJoin(users, eq(productPhotos.uploadedBy, users.id))
      .where(and(eq(productPhotos.id, photoId), eq(productPhotos.isActive, true)))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    const photo = row.product_photos;
    const user = row.users;
    return {
      ...photo,
      uploadedBy: user || undefined,
    };
  }

  async addProductPhoto(photo: InsertProductPhoto, userId: number): Promise<ProductPhoto> {
    return await db.transaction(async (tx) => {
      // Process image to generate thumbnail if URL contains base64 data
      let processedPhoto = { ...photo };
      
      try {
        // Check if URL contains base64 data (starts with data:image)
        if (photo.url && photo.url.startsWith('data:image')) {
          const processed = await imageService.processImage(photo.url);
          
          processedPhoto = {
            ...photo,
            url: processed.original,
            thumbnailUrl: processed.thumbnail,
            width: processed.width || photo.width,
            height: processed.height || photo.height,
            size: processed.size
          };
        }
      } catch (error) {
        console.error('Error processing image for thumbnail:', error);
        // Continue with original photo if processing fails
      }

      // If this is being set as primary, unset all other primary photos for this product
      if (processedPhoto.isPrimary) {
        await tx
          .update(productPhotos)
          .set({ isPrimary: false })
          .where(and(eq(productPhotos.productId, processedPhoto.productId), eq(productPhotos.isPrimary, true)));
      }

      // Insert the new photo
      const [newPhoto] = await tx
        .insert(productPhotos)
        .values(processedPhoto)
        .returning();

      // Add history entry
      await tx.insert(productPhotoHistory).values({
        productId: photo.productId,
        photoId: newPhoto.id,
        action: 'added',
        filename: photo.filename,
        isPrimary: photo.isPrimary || false,
        performedBy: userId,
        notes: `Photo uploaded: ${photo.filename}`,
      });

      // If this is the first photo for the product, set it as primary
      if (!photo.isPrimary) {
        const photoCount = await tx
          .select({ count: sql<number>`count(*)` })
          .from(productPhotos)
          .where(and(eq(productPhotos.productId, photo.productId), eq(productPhotos.isActive, true)));

        if (photoCount[0].count === 1) {
          await tx
            .update(productPhotos)
            .set({ isPrimary: true })
            .where(eq(productPhotos.id, newPhoto.id));

          await tx.insert(productPhotoHistory).values({
            productId: photo.productId,
            photoId: newPhoto.id,
            action: 'set_primary',
            filename: photo.filename,
            isPrimary: true,
            performedBy: userId,
            notes: 'Automatically set as primary (first photo)',
          });

          newPhoto.isPrimary = true;
        }
      }

      return newPhoto;
    });
  }

  async removeProductPhoto(photoId: number, userId: number, notes?: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [photo] = await tx
        .select()
        .from(productPhotos)
        .where(and(eq(productPhotos.id, photoId), eq(productPhotos.isActive, true)))
        .limit(1);

      if (!photo) return false;

      // Mark photo as inactive
      await tx
        .update(productPhotos)
        .set({ isActive: false })
        .where(eq(productPhotos.id, photoId));

      // Add history entry
      await tx.insert(productPhotoHistory).values({
        productId: photo.productId,
        photoId: photoId,
        action: 'removed',
        filename: photo.filename,
        isPrimary: photo.isPrimary,
        performedBy: userId,
        notes: notes || `Photo removed: ${photo.filename}`,
      });

      // If this was the primary photo, set another photo as primary
      if (photo.isPrimary) {
        const [nextPhoto] = await tx
          .select()
          .from(productPhotos)
          .where(and(eq(productPhotos.productId, photo.productId), eq(productPhotos.isActive, true)))
          .orderBy(desc(productPhotos.uploadedAt))
          .limit(1);

        if (nextPhoto) {
          await tx
            .update(productPhotos)
            .set({ isPrimary: true })
            .where(eq(productPhotos.id, nextPhoto.id));

          await tx.insert(productPhotoHistory).values({
            productId: photo.productId,
            photoId: nextPhoto.id,
            action: 'set_primary',
            filename: nextPhoto.filename,
            isPrimary: true,
            performedBy: userId,
            notes: 'Automatically set as primary (previous primary was removed)',
          });
        }
      }

      return true;
    });
  }

  async setPrimaryPhoto(photoId: number, userId: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [photo] = await tx
        .select()
        .from(productPhotos)
        .where(and(eq(productPhotos.id, photoId), eq(productPhotos.isActive, true)))
        .limit(1);

      if (!photo) return false;
      if (photo.isPrimary) return true; // Already primary

      // Unset current primary photo
      const [currentPrimary] = await tx
        .select()
        .from(productPhotos)
        .where(and(
          eq(productPhotos.productId, photo.productId), 
          eq(productPhotos.isPrimary, true),
          eq(productPhotos.isActive, true)
        ))
        .limit(1);

      if (currentPrimary) {
        await tx
          .update(productPhotos)
          .set({ isPrimary: false })
          .where(eq(productPhotos.id, currentPrimary.id));

        await tx.insert(productPhotoHistory).values({
          productId: photo.productId,
          photoId: currentPrimary.id,
          action: 'unset_primary',
          filename: currentPrimary.filename,
          isPrimary: false,
          performedBy: userId,
          notes: 'Unset as primary photo',
        });
      }

      // Set new primary photo
      await tx
        .update(productPhotos)
        .set({ isPrimary: true })
        .where(eq(productPhotos.id, photoId));

      await tx.insert(productPhotoHistory).values({
        productId: photo.productId,
        photoId: photoId,
        action: 'set_primary',
        filename: photo.filename,
        isPrimary: true,
        performedBy: userId,
        notes: 'Set as primary photo',
      });

      return true;
    });
  }

  async getProductPhotoHistory(productId: number): Promise<any[]> {
    const result = await db
      .select()
      .from(productPhotoHistory)
      .leftJoin(users, eq(productPhotoHistory.performedBy, users.id))
      .where(eq(productPhotoHistory.productId, productId))
      .orderBy(desc(productPhotoHistory.performedAt));

    return result.map(row => {
      const history = row.product_photo_history;
      const user = row.users;
      return {
        ...history,
        performedBy: user || undefined,
      };
    });
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
    // First get the UCP with basic relations
    const ucpResult = await db
      .select()
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .where(eq(ucps.id, id))
      .limit(1);

    if (ucpResult.length === 0) return undefined;

    const ucpRow = ucpResult[0];
    const baseUcp = {
      ...ucpRow.ucps,
      pallet: ucpRow.pallets || undefined,
      position: ucpRow.positions || undefined,
    };

    // Then get the items separately (only active items)
    console.log(`DEBUG: Fetching active items for UCP ID: ${id}`);
    const itemsResult = await db
      .select()
      .from(ucpItems)
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(and(eq(ucpItems.ucpId, id), eq(ucpItems.isActive, true)));

    console.log(`DEBUG: Found ${itemsResult.length} active items for UCP ${id}`);
    console.log('DEBUG: Items result:', itemsResult);

    const items = itemsResult.map(row => ({
      ...row.ucp_items,
      product: row.products || undefined,
    }));

    console.log(`DEBUG: Processed items for UCP ${id}:`, items.map(item => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      isActive: item.isActive,
      lot: item.lot
    })));

    return {
      ...baseUcp,
      items,
    };
  }

  async getUcpByCode(code: string): Promise<(Ucp & { pallet?: Pallet; position?: Position; items?: (UcpItem & { product?: Product })[] }) | undefined> {
    // First get the UCP with basic relations
    const ucpResult = await db
      .select()
      .from(ucps)
      .leftJoin(pallets, eq(ucps.palletId, pallets.id))
      .leftJoin(positions, eq(ucps.positionId, positions.id))
      .where(eq(ucps.code, code))
      .limit(1);

    if (ucpResult.length === 0) return undefined;

    const ucpRow = ucpResult[0];
    const baseUcp = {
      ...ucpRow.ucps,
      pallet: ucpRow.pallets || undefined,
      position: ucpRow.positions || undefined,
    };

    // Then get the items separately
    const itemsResult = await db
      .select()
      .from(ucpItems)
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(and(eq(ucpItems.ucpId, baseUcp.id), eq(ucpItems.isActive, true)));

    const items = itemsResult.map(row => ({
      ...row.ucp_items,
      product: row.products || undefined,
    }));

    return {
      ...baseUcp,
      items,
    };
  }

  async createUcp(ucp: InsertUcp): Promise<Ucp> {
    const [newUcp] = await db.insert(ucps).values(ucp).returning();
    return newUcp;
  }

  async updateUcp(id: number, ucp: Partial<InsertUcp>): Promise<Ucp | undefined> {
    return await db.transaction(async (tx) => {
      // Get current UCP data to compare positions
      const [currentUcp] = await tx.select().from(ucps).where(eq(ucps.id, id));
      if (!currentUcp) {
        throw new Error(`UCP with ID ${id} not found`);
      }

      // Check if position is being changed
      if (ucp.positionId !== undefined && ucp.positionId !== currentUcp.positionId) {
        // Validate new position if provided
        if (ucp.positionId) {
          const [newPosition] = await tx
            .select()
            .from(positions)
            .where(eq(positions.id, ucp.positionId));

          if (!newPosition) {
            throw new Error(`Position with ID ${ucp.positionId} not found`);
          }

          if (newPosition.status !== 'disponivel') {
            throw new Error(`Position ${newPosition.code} is not available (current status: ${newPosition.status})`);
          }

          // Check if position is already occupied by another active UCP
          const [existingUcpInPosition] = await tx
            .select()
            .from(ucps)
            .where(and(
              eq(ucps.positionId, ucp.positionId),
              eq(ucps.status, 'active'),
              ne(ucps.id, id) // Exclude current UCP
            ));

          if (existingUcpInPosition) {
            throw new Error(`Position ${newPosition.code} is already occupied by UCP ${existingUcpInPosition.code}`);
          }
        }

        // Update old position status to "disponivel" if it exists
        if (currentUcp.positionId) {
          await tx.update(positions)
            .set({ status: "disponivel", updatedAt: new Date() })
            .where(eq(positions.id, currentUcp.positionId));
        }

        // Update new position status to "ocupada" if provided
        if (ucp.positionId) {
          await tx.update(positions)
            .set({ status: "ocupada", updatedAt: new Date() })
            .where(eq(positions.id, ucp.positionId));
        }
      }

      // Update the UCP
      const [updatedUcp] = await tx
        .update(ucps)
        .set({ ...ucp, updatedAt: new Date() })
        .where(eq(ucps.id, id))
        .returning();

      return updatedUcp;
    });
  }

  async deleteUcp(id: number): Promise<boolean> {
    const result = await db.delete(ucps).where(eq(ucps.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Enhanced UCP operations for comprehensive lifecycle management
  async createUcpWithHistory(ucp: InsertUcp, userId: number): Promise<Ucp> {
    return await db.transaction(async (tx) => {
      // CRITICAL VALIDATION: Check if pallet is already in use
      if (ucp.palletId) {
        // Check if pallet exists and is available
        const [pallet] = await tx
          .select()
          .from(pallets)
          .where(eq(pallets.id, ucp.palletId));

        if (!pallet) {
          throw new Error(`Pallet with ID ${ucp.palletId} not found`);
        }

        if (pallet.status !== 'disponivel') {
          throw new Error(`Pallet ${pallet.code} is not available (current status: ${pallet.status})`);
        }

        // Check if pallet is already being used in an active UCP
        const [existingUcp] = await tx
          .select()
          .from(ucps)
          .where(and(
            eq(ucps.palletId, ucp.palletId),
            eq(ucps.status, 'active')
          ));

        if (existingUcp) {
          throw new Error(`Pallet ${pallet.code} is already being used in UCP ${existingUcp.code}`);
        }
      }

      // CRITICAL VALIDATION: Check if position is available
      if (ucp.positionId) {
        const [position] = await tx
          .select()
          .from(positions)
          .where(eq(positions.id, ucp.positionId));

        if (!position) {
          throw new Error(`Position with ID ${ucp.positionId} not found`);
        }

        if (position.status !== 'disponivel') {
          throw new Error(`Position ${position.code} is not available (current status: ${position.status})`);
        }

        // Check if position is already occupied by another active UCP
        const [existingUcpInPosition] = await tx
          .select()
          .from(ucps)
          .where(and(
            eq(ucps.positionId, ucp.positionId),
            eq(ucps.status, 'active')
          ));

        if (existingUcpInPosition) {
          throw new Error(`Position ${position.code} is already occupied by UCP ${existingUcpInPosition.code}`);
        }
      }

      // Create the UCP
      const [newUcp] = await tx.insert(ucps).values(ucp).returning();
      
      // Create initial history entry
      await tx.insert(ucpHistory).values({
        ucpId: newUcp.id,
        action: "created",
        description: `UCP ${newUcp.code} criada`,
        newValue: { status: newUcp.status, palletId: newUcp.palletId, positionId: newUcp.positionId },
        performedBy: userId,
      });

      // Update pallet status to "em_uso" if pallet is assigned
      if (newUcp.palletId) {
        await tx.update(pallets)
          .set({ status: "em_uso", updatedAt: new Date() })
          .where(eq(pallets.id, newUcp.palletId));
      }

      // CRITICAL FIX: Update position status to "ocupada" if position is assigned
      if (newUcp.positionId) {
        await tx.update(positions)
          .set({ status: "ocupada", updatedAt: new Date() })
          .where(eq(positions.id, newUcp.positionId));
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

  async getUcpItemById(itemId: number): Promise<(UcpItem & { product?: Product }) | undefined> {
    const result = await db
      .select()
      .from(ucpItems)
      .leftJoin(products, eq(ucpItems.productId, products.id))
      .where(eq(ucpItems.id, itemId))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      ...row.ucp_items,
      product: row.products || undefined,
    };
  }

  async transferUcpItem(data: {
    sourceItemId: number;
    targetUcpId: number;
    quantity: number;
    reason: string;
    userId: number;
  }): Promise<{ 
    success: boolean; 
    transferId: number;
    sourceUpdated: boolean; 
    targetCreated: boolean;
    sourceUcpId: number;
    targetUcpId: number;
    timestamp: Date;
  }> {
    const transferTimestamp = new Date();
    
    return await db.transaction(async (tx) => {
      console.log('=== INICIANDO TRANSFERÊNCIA DE ITEM ===');
      console.log('Dados da transferência:', {
        sourceItemId: data.sourceItemId,
        targetUcpId: data.targetUcpId,
        quantity: data.quantity,
        reason: data.reason,
        userId: data.userId,
        timestamp: transferTimestamp.toISOString()
      });

      // 1. VALIDAÇÕES INICIAIS
      // Buscar item de origem
      const [sourceItem] = await tx
        .select()
        .from(ucpItems)
        .where(and(eq(ucpItems.id, data.sourceItemId), eq(ucpItems.isActive, true)));

      if (!sourceItem) {
        throw new Error('Item de origem não encontrado ou inativo');
      }

      // Buscar UCP de destino
      const [targetUcp] = await tx
        .select()
        .from(ucps)
        .where(eq(ucps.id, data.targetUcpId));

      if (!targetUcp) {
        throw new Error('UCP de destino não encontrada');
      }

      if (targetUcp.status !== 'active') {
        throw new Error('UCP de destino não está ativa');
      }

      // Validar quantidades
      const sourceQuantity = parseInt(sourceItem.quantity);
      const transferQuantity = data.quantity;
      const remainingQuantity = sourceQuantity - transferQuantity;

      if (transferQuantity <= 0) {
        throw new Error('Quantidade de transferência deve ser positiva');
      }

      if (transferQuantity > sourceQuantity) {
        throw new Error('Quantidade de transferência excede quantidade disponível');
      }

      console.log('✅ Validações aprovadas:', {
        sourceItemId: sourceItem.id,
        sourceUcpId: sourceItem.ucpId,
        sourceQuantity,
        transferQuantity,
        remainingQuantity,
        transferType: remainingQuantity === 0 ? 'complete' : 'partial'
      });

      // 2. PROCESSAMENTO DA ORIGEM
      let sourceUpdated = false;
      // let sourceItemAfterUpdate = null; // Removed unused variable

      if (remainingQuantity === 0) {
        // Transferência total - marcar item como inativo
        console.log('📤 Transferência TOTAL - removendo item da origem');
        
        const [updatedSourceItem] = await tx
          .update(ucpItems)
          .set({
            isActive: false,
            removedBy: data.userId,
            removedAt: transferTimestamp,
            removalReason: `Transferido completamente para UCP ${targetUcp.code}: ${data.reason}`
          })
          .where(eq(ucpItems.id, data.sourceItemId))
          .returning();
        
        // sourceItemAfterUpdate = updatedSourceItem; // Removed unused variable assignment
        sourceUpdated = true;
        console.log('✅ Item removido da origem:', updatedSourceItem.id);
      } else {
        // Transferência parcial - atualizar quantidade
        console.log('📤 Transferência PARCIAL - atualizando quantidade na origem');
        
        const [updatedSourceItem] = await tx
          .update(ucpItems)
          .set({
            quantity: remainingQuantity.toString()
          })
          .where(eq(ucpItems.id, data.sourceItemId))
          .returning();
        
        // sourceItemAfterUpdate = updatedSourceItem; // Removed unused variable assignment
        sourceUpdated = true;
        console.log('✅ Quantidade atualizada na origem:', {
          itemId: updatedSourceItem.id,
          novaQuantidade: updatedSourceItem.quantity
        });
      }

      // 3. PROCESSAMENTO DO DESTINO
      let targetCreated = false;
      let targetItemId = null;

      // Verificar se já existe o mesmo produto na UCP de destino (com mesmo lote)
      console.log('🔍 Verificando item existente no destino...');
      
      const [existingTargetItem] = await tx
        .select()
        .from(ucpItems)
        .where(
          and(
            eq(ucpItems.ucpId, data.targetUcpId),
            eq(ucpItems.productId, sourceItem.productId),
            eq(ucpItems.isActive, true),
            sourceItem.lot ? eq(ucpItems.lot, sourceItem.lot) : isNull(ucpItems.lot)
          )
        );

      if (existingTargetItem) {
        // Somar à quantidade existente
        const newTargetQuantity = parseInt(existingTargetItem.quantity) + transferQuantity;
        console.log('📥 Item EXISTENTE no destino - somando quantidades:', {
          existingQuantity: existingTargetItem.quantity,
          transferQuantity,
          newQuantity: newTargetQuantity
        });

        const [updatedTargetItem] = await tx
          .update(ucpItems)
          .set({
            quantity: newTargetQuantity.toString()
          })
          .where(eq(ucpItems.id, existingTargetItem.id))
          .returning();

        targetItemId = updatedTargetItem.id;
        targetCreated = false;
        console.log('✅ Quantidade atualizada no destino:', updatedTargetItem.id);
      } else {
        // Criar novo item no destino
        console.log('📥 NOVO item no destino - criando...');
        
        const [newTargetItem] = await tx
          .insert(ucpItems)
          .values({
            ucpId: data.targetUcpId,
            productId: sourceItem.productId,
            quantity: transferQuantity.toString(),
            lot: sourceItem.lot,
            expiryDate: sourceItem.expiryDate,
            internalCode: sourceItem.internalCode,
            addedBy: data.userId,
            isActive: true,
          })
          .returning();

        targetItemId = newTargetItem.id;
        targetCreated = true;
        console.log('✅ Novo item criado no destino:', newTargetItem.id);
      }

      // 4. REGISTRO DA TRANSFERÊNCIA
      console.log('📝 Registrando transferência...');
      
      const [transferRecord] = await tx
        .insert(itemTransfers)
        .values({
          sourceUcpId: sourceItem.ucpId,
          targetUcpId: data.targetUcpId,
          sourceItemId: data.sourceItemId,
          targetItemId,
          productId: sourceItem.productId,
          quantity: transferQuantity.toString(),
          lot: sourceItem.lot,
          reason: data.reason,
          transferType: remainingQuantity === 0 ? 'complete' : 'partial',
          performedBy: data.userId,
        })
        .returning();

      console.log('✅ Transferência registrada:', transferRecord.id);

      // 4.5. VERIFICAÇÃO FINAL - DEBUG
      console.log('🔍 VERIFICAÇÃO FINAL - Estado dos itens após transferência:');
      
      // Verificar item de origem
      const [finalSourceItem] = await tx
        .select()
        .from(ucpItems)
        .where(eq(ucpItems.id, data.sourceItemId));
      
      console.log('📤 Estado final do item de origem:', {
        id: finalSourceItem.id,
        ucpId: finalSourceItem.ucpId,
        quantity: finalSourceItem.quantity,
        isActive: finalSourceItem.isActive,
        removalReason: finalSourceItem.removalReason
      });

      // Verificar item de destino
      if (targetItemId) {
        const [finalTargetItem] = await tx
          .select()
          .from(ucpItems)
          .where(eq(ucpItems.id, targetItemId));
        
        console.log('📥 Estado final do item de destino:', {
          id: finalTargetItem.id,
          ucpId: finalTargetItem.ucpId,
          quantity: finalTargetItem.quantity,
          isActive: finalTargetItem.isActive,
          productId: finalTargetItem.productId
        });
      }

      // Verificar todos os itens ativos na UCP de destino
      const allTargetItems = await tx
        .select()
        .from(ucpItems)
        .where(and(eq(ucpItems.ucpId, data.targetUcpId), eq(ucpItems.isActive, true)));
      
      console.log('📦 TODOS os itens ativos na UCP de destino:', allTargetItems.map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        lot: item.lot
      })));

      // 5. HISTÓRICO DAS UCPs
      // Histórico UCP origem
      await tx.insert(ucpHistory).values({
        ucpId: sourceItem.ucpId,
        action: 'item_transferred_out',
        description: `${transferQuantity} unidades de ${sourceItem.productId} transferidas para UCP ${targetUcp.code}`,
        performedBy: data.userId,
        itemId: data.sourceItemId,
        oldValue: { 
          quantity: sourceQuantity,
          targetUcp: targetUcp.code,
          transferId: transferRecord.id
        },
        newValue: { 
          quantity: remainingQuantity,
          reason: data.reason,
          transferType: remainingQuantity === 0 ? 'complete' : 'partial'
        },
      });

      // Histórico UCP destino
      await tx.insert(ucpHistory).values({
        ucpId: data.targetUcpId,
        action: 'item_transferred_in',
        description: `${transferQuantity} unidades de ${sourceItem.productId} recebidas da UCP ${sourceItem.ucpId}`,
        performedBy: data.userId,
        itemId: targetItemId,
        oldValue: null,
        newValue: { 
          quantity: transferQuantity,
          reason: data.reason,
          sourceUcp: sourceItem.ucpId,
          transferId: transferRecord.id
        },
      });

      console.log('✅ Histórico registrado para ambas as UCPs');
      console.log('=== TRANSFERÊNCIA CONCLUÍDA COM SUCESSO ===');

      return {
        success: true,
        transferId: transferRecord.id,
        sourceUpdated,
        targetCreated,
        sourceUcpId: sourceItem.ucpId,
        targetUcpId: data.targetUcpId,
        timestamp: transferTimestamp
      };
    });
  }

  async addUcpItem(item: InsertUcpItem & { fromPositionId?: number }, userId: number): Promise<UcpItem> {
    return await db.transaction(async (tx) => {
      const { fromPositionId, ...itemData } = item;
      const [newItem] = await tx.insert(ucpItems).values({
        ...itemData,
        addedBy: userId,
      }).returning();

      // Create history entry (registrando origem se fornecida)
      await tx.insert(ucpHistory).values({
        ucpId: item.ucpId,
        action: "item_added",
        description: `Produto adicionado à UCP`,
        newValue: { productId: item.productId, quantity: item.quantity },
        itemId: newItem.id,
        performedBy: userId,
        fromPositionId: fromPositionId,
      });

      return newItem;
    });
  }

  async removeUcpItem(itemId: number, userId: number, reason: string, toPositionId?: number): Promise<boolean> {
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

      // Create history entry (registrando destino se fornecido)
      await tx.insert(ucpHistory).values({
        ucpId: item.ucpId,
        action: "item_removed",
        description: `Produto removido da UCP - ${reason}`,
        oldValue: { productId: item.productId, quantity: item.quantity },
        itemId: itemId,
        performedBy: userId,
        toPositionId: toPositionId,
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
    // Optimized query that calculates available space and filters at database level
    const query = sql`
      SELECT 
        u.*,
        p.*,
        pos.*,
        COALESCE(pallet_capacity.capacity, 1000) - COALESCE(current_weight.total_weight, 0) as available_space
      FROM ucps u
      LEFT JOIN pallets p ON u.pallet_id = p.id
      LEFT JOIN positions pos ON u.position_id = pos.id
      LEFT JOIN (
        -- Calculate pallet capacity based on type
        SELECT 
          id,
          CASE 
            WHEN type = 'PBR' THEN 1000
            WHEN type = 'Europeu' THEN 800
            WHEN type = 'Chep' THEN 1200
            ELSE 1000
          END as capacity
        FROM pallets
      ) pallet_capacity ON p.id = pallet_capacity.id
      LEFT JOIN (
        -- Calculate current weight of items in UCP
        SELECT 
          ui.ucp_id,
          SUM(CAST(ui.quantity AS INTEGER) * COALESCE(CAST(pr.weight AS DECIMAL), 1)) as total_weight
        FROM ucp_items ui
        LEFT JOIN products pr ON ui.product_id = pr.id
        WHERE ui.is_active = true
        GROUP BY ui.ucp_id
      ) current_weight ON u.id = current_weight.ucp_id
      WHERE u.status = 'active'
        AND (${productId ? sql`${productId} IS NOT NULL` : sql`true`})
        AND (
          -- If productId specified, check if UCP can accommodate the product
          ${productId ? sql`
            NOT EXISTS (
              SELECT 1 FROM ucp_items ui2 
              WHERE ui2.ucp_id = u.id 
                AND ui2.product_id != ${productId}
                AND ui2.is_active = true
            )
          ` : sql`true`}
        )
        AND COALESCE(pallet_capacity.capacity, 1000) - COALESCE(current_weight.total_weight, 0) > 0
      ORDER BY 
        -- Prioritize UCPs with more available space
        available_space DESC,
        u.created_at DESC
    `;

    const result = await db.execute(query);
    
    return result.rows.map((row: any) => ({
      // UCP fields
      id: row.id,
      code: row.code,
      palletId: row.pallet_id,
      positionId: row.position_id,
      status: row.status,
      observations: row.observations,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Pallet fields (if exists)
      pallet: row.pallet_id ? {
        id: row.pallet_id,
        code: row.code_1, // Second code field from pallets table
        type: row.type,
        material: row.material,
        width: row.width,
        length: row.length,
        height: row.height,
        maxWeight: row.max_weight,
        status: row.status_1, // Second status field from pallets table
        photoUrl: row.photo_url,
        observations: row.observations_1,
        lastInspectionDate: row.last_inspection_date,
        createdBy: row.created_by_1,
        createdAt: row.created_at_1,
        updatedAt: row.updated_at_1
      } : undefined,
      // Position fields (if exists)
      position: row.position_id ? {
        id: row.position_id,
        code: row.code_2, // Third code field from positions table
        structureId: row.structure_id,
        street: row.street,
        side: row.side,
        corridor: row.corridor,
        position: row.position,
        level: row.level,
        rackType: row.rack_type,
        maxPallets: row.max_pallets,
        restrictions: row.restrictions,
        status: row.status_2, // Third status field from positions table
        currentPalletId: row.current_pallet_id,
        observations: row.observations_2,
        createdBy: row.created_by_2,
        createdAt: row.created_at_2,
        updatedAt: row.updated_at_2,
        hasDivision: row.has_division,
        layoutConfig: row.layout_config
      } : undefined,
      // Available space calculated by database
      availableSpace: Math.max(0, Number(row.available_space) || 0)
    }));
  }

  async getUcpHistory(ucpId: number): Promise<(UcpHistory & { performedByUser?: User; item?: UcpItem & { product?: Product }; fromPosition?: Position; toPosition?: Position })[]> {
    try {
      // Single optimized query with all JOINs to avoid N+1 problem
      const result = await db
        .select({
          // History fields
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
          // User fields
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          // Item fields
          itemUcpId: ucpItems.ucpId,
          itemProductId: ucpItems.productId,
          itemQuantity: ucpItems.quantity,
          itemLot: ucpItems.lot,
          itemExpiryDate: ucpItems.expiryDate,
          itemInternalCode: ucpItems.internalCode,
          itemAddedAt: ucpItems.addedAt,
          itemIsActive: ucpItems.isActive,
          itemAddedBy: ucpItems.addedBy,
          itemRemovedBy: ucpItems.removedBy,
          itemRemovedAt: ucpItems.removedAt,
          itemRemovalReason: ucpItems.removalReason,
          // Product fields
          productSku: products.sku,
          productName: products.name,
          productDescription: products.description,
          productBrand: products.brand,
          productCategory: products.category,
          productUnit: products.unit,
          productWeight: products.weight,
          productDimensions: products.dimensions,
          productBarcode: products.barcode,
          productRequiresLot: products.requiresLot,
          productRequiresExpiry: products.requiresExpiry,
          productMinStock: products.minStock,
          productMaxStock: products.maxStock,
          productIsActive: products.isActive,
          productCreatedAt: products.createdAt,
          productUpdatedAt: products.updatedAt,
          productCreatedBy: products.createdBy,
          // From position fields
          fromPositionCode: sql<string>`from_pos.code`,
          fromPositionStreet: sql<string>`from_pos.street`,
          fromPositionSide: sql<string>`from_pos.side`,
          fromPositionPosition: sql<number>`from_pos.position`,
          fromPositionLevel: sql<number>`from_pos.level`,
          fromPositionStatus: sql<string>`from_pos.status`,
          fromPositionMaxPallets: sql<number>`from_pos.max_pallets`,
          fromPositionRackType: sql<string>`from_pos.rack_type`,
          fromPositionCorridor: sql<string>`from_pos.corridor`,
          fromPositionRestrictions: sql<string>`from_pos.restrictions`,
          fromPositionObservations: sql<string>`from_pos.observations`,
          fromPositionHasDivision: sql<boolean>`from_pos.has_division`,
          fromPositionLayoutConfig: sql<any>`from_pos.layout_config`,
          fromPositionStructureId: sql<number>`from_pos.structure_id`,
          fromPositionCurrentPalletId: sql<number>`from_pos.current_pallet_id`,
          fromPositionCreatedBy: sql<number>`from_pos.created_by`,
          fromPositionCreatedAt: sql<Date>`from_pos.created_at`,
          fromPositionUpdatedAt: sql<Date>`from_pos.updated_at`,
          // To position fields
          toPositionCode: sql<string>`to_pos.code`,
          toPositionStreet: sql<string>`to_pos.street`,
          toPositionSide: sql<string>`to_pos.side`,
          toPositionPosition: sql<number>`to_pos.position`,
          toPositionLevel: sql<number>`to_pos.level`,
          toPositionStatus: sql<string>`to_pos.status`,
          toPositionMaxPallets: sql<number>`to_pos.max_pallets`,
          toPositionRackType: sql<string>`to_pos.rack_type`,
          toPositionCorridor: sql<string>`to_pos.corridor`,
          toPositionRestrictions: sql<string>`to_pos.restrictions`,
          toPositionObservations: sql<string>`to_pos.observations`,
          toPositionHasDivision: sql<boolean>`to_pos.has_division`,
          toPositionLayoutConfig: sql<any>`to_pos.layout_config`,
          toPositionStructureId: sql<number>`to_pos.structure_id`,
          toPositionCurrentPalletId: sql<number>`to_pos.current_pallet_id`,
          toPositionCreatedBy: sql<number>`to_pos.created_by`,
          toPositionCreatedAt: sql<Date>`to_pos.created_at`,
          toPositionUpdatedAt: sql<Date>`to_pos.updated_at`,
        })
        .from(ucpHistory)
        .leftJoin(users, eq(ucpHistory.performedBy, users.id))
        .leftJoin(ucpItems, eq(ucpHistory.itemId, ucpItems.id))
        .leftJoin(products, eq(ucpItems.productId, products.id))
        .leftJoin(sql`positions as from_pos`, sql`${ucpHistory.fromPositionId} = from_pos.id`)
        .leftJoin(sql`positions as to_pos`, sql`${ucpHistory.toPositionId} = to_pos.id`)
        .where(eq(ucpHistory.ucpId, ucpId))
        .orderBy(desc(ucpHistory.timestamp));

      console.log(`DEBUG: Optimized query result for UCP ${ucpId}:`, result.length, 'entries');

      // Transform the flattened result into the expected structure
      const processedHistory = result.map((row) => {
        let item: (UcpItem & { product?: Product }) | undefined;
        let fromPosition: Position | undefined;
        let toPosition: Position | undefined;

        // Build item object if item data exists
        if (row.itemId && row.itemUcpId !== null) {
          item = {
            id: row.itemId,
            ucpId: row.itemUcpId!,
            productId: row.itemProductId!,
            quantity: row.itemQuantity!,
            lot: row.itemLot,
            expiryDate: row.itemExpiryDate,
            internalCode: row.itemInternalCode,
            addedAt: row.itemAddedAt!,
            isActive: row.itemIsActive!,
            addedBy: row.itemAddedBy!,
            removedBy: row.itemRemovedBy,
            removedAt: row.itemRemovedAt,
            removalReason: row.itemRemovalReason,
            product: row.itemProductId ? {
              id: row.itemProductId,
              sku: row.productSku || '',
              name: row.productName || '',
              description: row.productDescription,
              brand: row.productBrand,
              category: row.productCategory,
              unit: row.productUnit || '',
              weight: row.productWeight || null,
              dimensions: row.productDimensions || null,
              barcode: row.productBarcode,
              requiresLot: row.productRequiresLot || false,
              requiresExpiry: row.productRequiresExpiry || false,
              minStock: row.productMinStock,
              maxStock: row.productMaxStock,
              isActive: row.productIsActive || false,
              createdAt: row.productCreatedAt,
              updatedAt: row.productUpdatedAt,
              createdBy: row.productCreatedBy || 0,
            } as Product : undefined,
          };
        }

        // Build from position object if position data exists
        if (row.fromPositionId && row.fromPositionCode !== null) {
          fromPosition = {
            id: row.fromPositionId,
            code: row.fromPositionCode!,
            street: row.fromPositionStreet!,
            side: row.fromPositionSide!,
            position: row.fromPositionPosition!,
            level: row.fromPositionLevel!,
            status: row.fromPositionStatus!,
            maxPallets: row.fromPositionMaxPallets!,
            rackType: row.fromPositionRackType,
            corridor: row.fromPositionCorridor,
            restrictions: row.fromPositionRestrictions,
            observations: row.fromPositionObservations,
            hasDivision: row.fromPositionHasDivision!,
            layoutConfig: row.fromPositionLayoutConfig,
            structureId: row.fromPositionStructureId,
            currentPalletId: row.fromPositionCurrentPalletId,
            createdBy: row.fromPositionCreatedBy,
            createdAt: row.fromPositionCreatedAt,
            updatedAt: row.fromPositionUpdatedAt,
          };
        }

        // Build to position object if position data exists
        if (row.toPositionId && row.toPositionCode !== null) {
          toPosition = {
            id: row.toPositionId,
            code: row.toPositionCode!,
            street: row.toPositionStreet!,
            side: row.toPositionSide!,
            position: row.toPositionPosition!,
            level: row.toPositionLevel!,
            status: row.toPositionStatus!,
            maxPallets: row.toPositionMaxPallets!,
            rackType: row.toPositionRackType,
            corridor: row.toPositionCorridor,
            restrictions: row.toPositionRestrictions,
            observations: row.toPositionObservations,
            hasDivision: row.toPositionHasDivision!,
            layoutConfig: row.toPositionLayoutConfig,
            structureId: row.toPositionStructureId,
            currentPalletId: row.toPositionCurrentPalletId,
            createdBy: row.toPositionCreatedBy,
            createdAt: row.toPositionCreatedAt,
            updatedAt: row.toPositionUpdatedAt,
          };
        }

        return {
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
          item,
          fromPosition,
          toPosition,
        } as UcpHistory & { performedByUser?: User; item?: UcpItem & { product?: Product }; fromPosition?: Position; toPosition?: Position };
      });

      return processedHistory;
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
    // Busca pallets que estão disponíveis E não estão sendo usados em UCPs ativas
    const availablePallets = await db
      .select()
      .from(pallets)
      .leftJoin(ucps, and(
        eq(ucps.palletId, pallets.id),
        eq(ucps.status, 'active')
      ))
      .where(and(
        eq(pallets.status, 'disponivel'),
        isNull(ucps.id) // Pallet não deve estar em nenhuma UCP ativa
      ))
      .orderBy(desc(pallets.createdAt));

    return availablePallets.map(row => row.pallets);
  }

  async getNextPalletCode(): Promise<string> {
    // Use PostgreSQL sequence for atomic, concurrent-safe code generation
    // Create sequence if it doesn't exist (idempotent)
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'pallet_code_seq') THEN
          -- Find the highest existing pallet number to start the sequence from
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
            status: 'disponivel',
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
