import { eq, desc, like, and, or, gte, lte, count, inArray, sql, isNull } from 'drizzle-orm';
import { products } from '../schemas/products.schema.js';
import { ucpItems } from '../schemas/ucps.schema.js';
import { ucps } from '../schemas/ucps.schema.js';
import { pallets } from '../schemas/pallets.schema.js';
import { positions } from '../schemas/positions.schema.js';
import { db } from '../database.js';
import { ProductRepository, ProductQueryFilters } from '../../../core/domain/interfaces/product.repository.js';
import { ProductEntity, CreateProductData, UpdateProductData, ProductWithStock, Product } from '../../../core/domain/entities/product.entity.js';
import { StockInfo } from '../../../core/shared/types/index.js';
import { NotFoundError, ConflictError } from '../../../utils/exceptions/index.js';
import { logInfo, logError } from '../../../utils/logger.js';

export class ProductRepositoryImpl implements ProductRepository {
  async findById(id: number): Promise<ProductEntity | null> {
    try {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1);

      return product || null;
    } catch (error) {
      logError('Error finding product by ID', { error, id });
      throw error;
    }
  }

  async findBySku(sku: string): Promise<ProductEntity | null> {
    try {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.sku, sku.toUpperCase()))
        .limit(1);

      return product || null;
    } catch (error) {
      logError('Error finding product by SKU', { error, sku });
      throw error;
    }
  }

  async findByBarcode(barcode: string): Promise<ProductEntity | null> {
    try {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.barcode, barcode))
        .limit(1);

      return product || null;
    } catch (error) {
      logError('Error finding product by barcode', { error, barcode });
      throw error;
    }
  }

  async findAll(filters?: ProductQueryFilters): Promise<ProductEntity[]> {
    try {
      let query = db.select().from(products);

      if (filters) {
        const conditions = [];

        if (filters.sku) {
          conditions.push(like(products.sku, `%${filters.sku.toUpperCase()}%`));
        }

        if (filters.name) {
          conditions.push(like(products.name, `%${filters.name}%`));
        }

        if (filters.category) {
          conditions.push(eq(products.category, filters.category));
        }

        if (filters.brand) {
          conditions.push(eq(products.brand, filters.brand));
        }

        if (filters.unit) {
          conditions.push(eq(products.unit, filters.unit));
        }

        if (filters.barcode) {
          conditions.push(like(products.barcode, `%${filters.barcode}%`));
        }

        if (filters.isActive !== undefined) {
          conditions.push(eq(products.isActive, filters.isActive));
        }

        if (filters.requiresLot !== undefined) {
          conditions.push(eq(products.requiresLot, filters.requiresLot));
        }

        if (filters.requiresExpiry !== undefined) {
          conditions.push(eq(products.requiresExpiry, filters.requiresExpiry));
        }

        if (filters.minWeight) {
          conditions.push(gte(products.weight, filters.minWeight.toString()));
        }

        if (filters.maxWeight) {
          conditions.push(lte(products.weight, filters.maxWeight.toString()));
        }

        if (filters.createdFrom) {
          conditions.push(gte(products.createdAt, filters.createdFrom));
        }

        if (filters.createdTo) {
          conditions.push(lte(products.createdAt, filters.createdTo));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const result = await query.orderBy(products.name);
      
      logInfo('Products retrieved successfully', { 
        count: result.length,
        filters: filters ? Object.keys(filters) : [],
      });

      return result;
    } catch (error) {
      logError('Error finding all products', { error, filters });
      throw error;
    }
  }

  async create(data: CreateProductData & { createdBy: number }): Promise<ProductEntity> {
    try {
      // Check if SKU already exists
      const existingProduct = await this.findBySku(data.sku);
      if (existingProduct) {
        throw new ConflictError(`Product with SKU '${data.sku}' already exists`);
      }

      // Check if barcode already exists (if provided)
      if (data.barcode) {
        const existingByBarcode = await this.findByBarcode(data.barcode);
        if (existingByBarcode) {
          throw new ConflictError(`Product with barcode '${data.barcode}' already exists`);
        }
      }

      const productData = Product.create(data);
      const [newProduct] = await db
        .insert(products)
        .values(productData)
        .returning();

      logInfo('Product created successfully', {
        productId: newProduct.id,
        sku: newProduct.sku,
        name: newProduct.name,
      });

      return newProduct;
    } catch (error) {
      logError('Error creating product', { error, sku: data.sku });
      throw error;
    }
  }

  async update(id: number, data: UpdateProductData): Promise<ProductEntity | null> {
    try {
      const currentProduct = await this.findById(id);
      if (!currentProduct) {
        throw new NotFoundError('Product', id);
      }

      // Check barcode uniqueness if barcode is being updated
      if (data.barcode && data.barcode !== currentProduct.barcode) {
        const existingProduct = await this.findByBarcode(data.barcode);
        if (existingProduct && existingProduct.id !== id) {
          throw new ConflictError(`Product with barcode '${data.barcode}' already exists`);
        }
      }

      const updateData = Product.update(currentProduct, data);
      
      if (Object.keys(updateData).length === 0) {
        return currentProduct; // No changes needed
      }

      const [updatedProduct] = await db
        .update(products)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      logInfo('Product updated successfully', {
        productId: updatedProduct.id,
        sku: updatedProduct.sku,
        updatedFields: Object.keys(updateData),
      });

      return updatedProduct;
    } catch (error) {
      logError('Error updating product', { error, id });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      // Soft delete - mark as inactive
      const [updatedProduct] = await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      const deleted = !!updatedProduct;
      
      if (deleted) {
        logInfo('Product soft deleted successfully', { productId: id });
      }

      return deleted;
    } catch (error) {
      logError('Error deleting product', { error, id });
      throw error;
    }
  }

  async findByCategory(category: string): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(and(eq(products.category, category), eq(products.isActive, true)))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding products by category', { error, category });
      throw error;
    }
  }

  async findByBrand(brand: string): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(and(eq(products.brand, brand), eq(products.isActive, true)))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding products by brand', { error, brand });
      throw error;
    }
  }

  async findWithStock(id?: number): Promise<ProductWithStock[]> {
    try {
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
        stockLocations: (row.ucp_stock || []).map((stock: any) => ({
          quantity: stock.quantity,
          unit: row.unit,
          lot: stock.lot,
          expiryDate: stock.expiry_date,
          location: {
            ucpCode: stock.ucp_code,
            positionCode: stock.position_code,
          },
        })),
      }));
    } catch (error) {
      logError('Error finding products with stock', { error, id });
      throw error;
    }
  }

  async getStockInfo(productId: number): Promise<StockInfo[]> {
    try {
      const result = await db
        .select({
          quantity: ucpItems.quantity,
          lot: ucpItems.lot,
          expiryDate: ucpItems.expiryDate,
          ucpCode: ucps.code,
          positionCode: positions.code,
          unit: products.unit,
        })
        .from(ucpItems)
        .innerJoin(products, eq(ucpItems.productId, products.id))
        .innerJoin(ucps, eq(ucpItems.ucpId, ucps.id))
        .leftJoin(positions, eq(ucps.positionId, positions.id))
        .where(and(
          eq(ucpItems.productId, productId),
          eq(ucpItems.isActive, true)
        ));

      return result.map(row => ({
        quantity: Number(row.quantity),
        unit: row.unit,
        lot: row.lot,
        expiryDate: row.expiryDate,
        location: {
          ucpCode: row.ucpCode,
          positionCode: row.positionCode,
        },
      }));
    } catch (error) {
      logError('Error getting product stock info', { error, productId });
      throw error;
    }
  }

  async getTotalStock(productId: number): Promise<number> {
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
      logError('Error getting total stock', { error, productId });
      throw error;
    }
  }

  async findActive(): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding active products', { error });
      throw error;
    }
  }

  async findInactive(): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(eq(products.isActive, false))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding inactive products', { error });
      throw error;
    }
  }

  async activate(id: number): Promise<ProductEntity | null> {
    try {
      const [activated] = await db
        .update(products)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      if (activated) {
        logInfo('Product activated successfully', { productId: id });
      }

      return activated || null;
    } catch (error) {
      logError('Error activating product', { error, id });
      throw error;
    }
  }

  async deactivate(id: number): Promise<ProductEntity | null> {
    try {
      const [deactivated] = await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      if (deactivated) {
        logInfo('Product deactivated successfully', { productId: id });
      }

      return deactivated || null;
    } catch (error) {
      logError('Error deactivating product', { error, id });
      throw error;
    }
  }

  async findRequiringLot(): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(and(eq(products.requiresLot, true), eq(products.isActive, true)))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding products requiring lot', { error });
      throw error;
    }
  }

  async findRequiringExpiry(): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(and(eq(products.requiresExpiry, true), eq(products.isActive, true)))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding products requiring expiry', { error });
      throw error;
    }
  }

  async findWithSpecialHandling(): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(and(
          or(eq(products.requiresLot, true), eq(products.requiresExpiry, true)),
          eq(products.isActive, true)
        ))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding products with special handling', { error });
      throw error;
    }
  }

  async findLowStock(): Promise<{ product: ProductEntity; currentStock: number; minStock: number }[]> {
    try {
      const query = sql`
        SELECT 
          p.*,
          COALESCE(SUM(CAST(ui.quantity AS NUMERIC)), 0) as current_stock
        FROM products p
        LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
        WHERE p.is_active = true
        GROUP BY p.id, p.sku, p.name, p.description, p.category, p.brand, p.unit, p.weight, 
                 p.dimensions, p.barcode, p.requires_lot, p.requires_expiry, p.min_stock, 
                 p.max_stock, p.is_active, p.created_by, p.created_at, p.updated_at
        HAVING COALESCE(SUM(CAST(ui.quantity AS NUMERIC)), 0) <= p.min_stock
        ORDER BY p.name
      `;

      const result = await db.execute(query);
      return result.rows.map((row: any) => ({
        product: row,
        currentStock: Number(row.current_stock),
        minStock: row.min_stock,
      }));
    } catch (error) {
      logError('Error finding low stock products', { error });
      throw error;
    }
  }

  async findOverStock(): Promise<{ product: ProductEntity; currentStock: number; maxStock: number }[]> {
    try {
      const query = sql`
        SELECT 
          p.*,
          COALESCE(SUM(CAST(ui.quantity AS NUMERIC)), 0) as current_stock
        FROM products p
        LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
        WHERE p.is_active = true AND p.max_stock IS NOT NULL
        GROUP BY p.id, p.sku, p.name, p.description, p.category, p.brand, p.unit, p.weight, 
                 p.dimensions, p.barcode, p.requires_lot, p.requires_expiry, p.min_stock, 
                 p.max_stock, p.is_active, p.created_by, p.created_at, p.updated_at
        HAVING COALESCE(SUM(CAST(ui.quantity AS NUMERIC)), 0) >= p.max_stock
        ORDER BY p.name
      `;

      const result = await db.execute(query);
      return result.rows.map((row: any) => ({
        product: row,
        currentStock: Number(row.current_stock),
        maxStock: row.max_stock,
      }));
    } catch (error) {
      logError('Error finding over stock products', { error });
      throw error;
    }
  }

  async findOutOfStock(): Promise<ProductEntity[]> {
    try {
      const query = sql`
        SELECT p.*
        FROM products p
        LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
        WHERE p.is_active = true
        GROUP BY p.id, p.sku, p.name, p.description, p.category, p.brand, p.unit, p.weight, 
                 p.dimensions, p.barcode, p.requires_lot, p.requires_expiry, p.min_stock, 
                 p.max_stock, p.is_active, p.created_by, p.created_at, p.updated_at
        HAVING COALESCE(SUM(CAST(ui.quantity AS NUMERIC)), 0) = 0
        ORDER BY p.name
      `;

      const result = await db.execute(query);
      return result.rows as ProductEntity[];
    } catch (error) {
      logError('Error finding out of stock products', { error });
      throw error;
    }
  }

  async search(query: string): Promise<ProductEntity[]> {
    try {
      const searchTerm = `%${query}%`;
      
      const result = await db
        .select()
        .from(products)
        .where(and(
          or(
            like(products.name, searchTerm),
            like(products.sku, searchTerm.toUpperCase()),
            like(products.description, searchTerm),
            like(products.barcode, searchTerm)
          ),
          eq(products.isActive, true)
        ))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error searching products', { error, query });
      throw error;
    }
  }

  async findByName(name: string): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(and(
          like(products.name, `%${name}%`),
          eq(products.isActive, true)
        ))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding products by name', { error, name });
      throw error;
    }
  }

  async findByDescription(description: string): Promise<ProductEntity[]> {
    try {
      const result = await db
        .select()
        .from(products)
        .where(and(
          like(products.description, `%${description}%`),
          eq(products.isActive, true)
        ))
        .orderBy(products.name);

      return result;
    } catch (error) {
      logError('Error finding products by description', { error, description });
      throw error;
    }
  }

  async skuExists(sku: string, excludeId?: number): Promise<boolean> {
    try {
      let query = db
        .select({ count: count() })
        .from(products)
        .where(eq(products.sku, sku.toUpperCase()));

      if (excludeId) {
        query = query.where(and(
          eq(products.sku, sku.toUpperCase()),
          ne(products.id, excludeId)
        ));
      }

      const [result] = await query;
      return result.count > 0;
    } catch (error) {
      logError('Error checking if SKU exists', { error, sku, excludeId });
      throw error;
    }
  }

  async barcodeExists(barcode: string, excludeId?: number): Promise<boolean> {
    try {
      let query = db
        .select({ count: count() })
        .from(products)
        .where(eq(products.barcode, barcode));

      if (excludeId) {
        query = query.where(and(
          eq(products.barcode, barcode),
          ne(products.id, excludeId)
        ));
      }

      const [result] = await query;
      return result.count > 0;
    } catch (error) {
      logError('Error checking if barcode exists', { error, barcode, excludeId });
      throw error;
    }
  }

  // Continue with remaining methods...
  async countByCategory(): Promise<{ category: string; count: number }[]> {
    try {
      const result = await db
        .select({
          category: sql<string>`COALESCE(category, 'Uncategorized')`,
          count: count(),
        })
        .from(products)
        .where(eq(products.isActive, true))
        .groupBy(products.category);

      return result.map(row => ({
        category: row.category,
        count: Number(row.count),
      }));
    } catch (error) {
      logError('Error counting products by category', { error });
      throw error;
    }
  }

  async countByBrand(): Promise<{ brand: string; count: number }[]> {
    try {
      const result = await db
        .select({
          brand: sql<string>`COALESCE(brand, 'No Brand')`,
          count: count(),
        })
        .from(products)
        .where(eq(products.isActive, true))
        .groupBy(products.brand);

      return result.map(row => ({
        brand: row.brand,
        count: Number(row.count),
      }));
    } catch (error) {
      logError('Error counting products by brand', { error });
      throw error;
    }
  }

  async countByUnit(): Promise<{ unit: string; count: number }[]> {
    try {
      const result = await db
        .select({
          unit: products.unit,
          count: count(),
        })
        .from(products)
        .where(eq(products.isActive, true))
        .groupBy(products.unit);

      return result.map(row => ({
        unit: row.unit,
        count: Number(row.count),
      }));
    } catch (error) {
      logError('Error counting products by unit', { error });
      throw error;
    }
  }

  async createMany(productsData: (CreateProductData & { createdBy: number })[]): Promise<ProductEntity[]> {
    try {
      // Validate unique SKUs
      const skus = productsData.map(p => p.sku.toUpperCase());
      const uniqueSkus = [...new Set(skus)];
      
      if (skus.length !== uniqueSkus.length) {
        throw new ConflictError('Duplicate SKUs found in batch');
      }

      // Check existing SKUs
      const existingProducts = await db
        .select()
        .from(products)
        .where(inArray(products.sku, skus));

      if (existingProducts.length > 0) {
        const existingSkus = existingProducts.map(p => p.sku);
        throw new ConflictError(`Products already exist with SKUs: ${existingSkus.join(', ')}`);
      }

      const productData = productsData.map(data => Product.create(data));
      const newProducts = await db
        .insert(products)
        .values(productData)
        .returning();

      logInfo('Batch products created successfully', { count: newProducts.length });
      return newProducts;
    } catch (error) {
      logError('Error creating batch products', { error, count: productsData.length });
      throw error;
    }
  }

  async updateMany(updates: { id: number; data: UpdateProductData }[]): Promise<ProductEntity[]> {
    try {
      const updatedProducts: ProductEntity[] = [];

      for (const update of updates) {
        const updatedProduct = await this.update(update.id, update.data);
        if (updatedProduct) {
          updatedProducts.push(updatedProduct);
        }
      }

      logInfo('Batch products updated successfully', { 
        requested: updates.length,
        updated: updatedProducts.length,
      });

      return updatedProducts;
    } catch (error) {
      logError('Error updating batch products', { error, count: updates.length });
      throw error;
    }
  }

  async activateMany(ids: number[]): Promise<number> {
    try {
      const result = await db
        .update(products)
        .set({ isActive: true, updatedAt: new Date() })
        .where(inArray(products.id, ids));

      const activated = result.rowCount || 0;
      logInfo('Bulk products activated', { activated });
      return activated;
    } catch (error) {
      logError('Error activating products in bulk', { error, ids });
      throw error;
    }
  }

  async deactivateMany(ids: number[]): Promise<number> {
    try {
      const result = await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(products.id, ids));

      const deactivated = result.rowCount || 0;
      logInfo('Bulk products deactivated', { deactivated });
      return deactivated;
    } catch (error) {
      logError('Error deactivating products in bulk', { error, ids });
      throw error;
    }
  }

  async count(filters?: ProductQueryFilters): Promise<number> {
    try {
      let query = db.select({ count: count() }).from(products);

      if (filters) {
        const conditions = [];

        if (filters.isActive !== undefined) {
          conditions.push(eq(products.isActive, filters.isActive));
        }

        if (filters.category) {
          conditions.push(eq(products.category, filters.category));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
      }

      const [result] = await query;
      return result.count;
    } catch (error) {
      logError('Error counting products', { error, filters });
      throw error;
    }
  }

  async getWeightStats(): Promise<{ avgWeight: number; totalWeight: number; minWeight: number; maxWeight: number }> {
    try {
      const [result] = await db
        .select({
          avgWeight: sql<number>`AVG(CAST(weight AS NUMERIC))`,
          totalWeight: sql<number>`SUM(CAST(weight AS NUMERIC))`,
          minWeight: sql<number>`MIN(CAST(weight AS NUMERIC))`,
          maxWeight: sql<number>`MAX(CAST(weight AS NUMERIC))`,
        })
        .from(products)
        .where(and(eq(products.isActive, true), isNotNull(products.weight)));

      return {
        avgWeight: Number(result.avgWeight) || 0,
        totalWeight: Number(result.totalWeight) || 0,
        minWeight: Number(result.minWeight) || 0,
        maxWeight: Number(result.maxWeight) || 0,
      };
    } catch (error) {
      logError('Error getting weight stats', { error });
      throw error;
    }
  }

  async getDimensionStats(): Promise<{ avgVolume: number; totalVolume: number; minVolume: number; maxVolume: number }> {
    try {
      const [result] = await db
        .select({
          avgVolume: sql<number>`AVG(CAST(dimensions->>'width' AS NUMERIC) * CAST(dimensions->>'length' AS NUMERIC) * CAST(dimensions->>'height' AS NUMERIC))`,
          totalVolume: sql<number>`SUM(CAST(dimensions->>'width' AS NUMERIC) * CAST(dimensions->>'length' AS NUMERIC) * CAST(dimensions->>'height' AS NUMERIC))`,
          minVolume: sql<number>`MIN(CAST(dimensions->>'width' AS NUMERIC) * CAST(dimensions->>'length' AS NUMERIC) * CAST(dimensions->>'height' AS NUMERIC))`,
          maxVolume: sql<number>`MAX(CAST(dimensions->>'width' AS NUMERIC) * CAST(dimensions->>'length' AS NUMERIC) * CAST(dimensions->>'height' AS NUMERIC))`,
        })
        .from(products)
        .where(and(eq(products.isActive, true), isNotNull(products.dimensions)));

      return {
        avgVolume: Number(result.avgVolume) || 0,
        totalVolume: Number(result.totalVolume) || 0,
        minVolume: Number(result.minVolume) || 0,
        maxVolume: Number(result.maxVolume) || 0,
      };
    } catch (error) {
      logError('Error getting dimension stats', { error });
      throw error;
    }
  }

  async updatePhotoUrl(id: number, photoUrl: string): Promise<ProductEntity | null> {
    try {
      const [updated] = await db
        .update(products)
        .set({ updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      return updated || null;
    } catch (error) {
      logError('Error updating product photo URL', { error, id, photoUrl });
      throw error;
    }
  }

  async removePhotoUrl(id: number): Promise<ProductEntity | null> {
    try {
      const [updated] = await db
        .update(products)
        .set({ updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      return updated || null;
    } catch (error) {
      logError('Error removing product photo URL', { error, id });
      throw error;
    }
  }
}