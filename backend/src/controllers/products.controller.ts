import { Request, Response } from "express";
import { storage } from "../storage";
import { insertProductSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";
import { logError, logInfo } from "../utils/logger";
import { setCache, getCache, deleteCache } from "../config/redis";

export class ProductsController {
  // Helper method to invalidate all photo caches for a product
  private async invalidatePhotoCache(productId: number) {
    try {
      // Invalidate primary photo cache
      await deleteCache(`product:${productId}:photo:primary`);
      
      // Invalidate paginated photo caches (we don't know all pages, so we'll invalidate common ones)
      for (let page = 1; page <= 20; page++) {
        for (const limit of [20, 50, 100]) {
          for (const onlyPrimary of [true, false]) {
            await deleteCache(`product:${productId}:photos:${page}:${limit}:${onlyPrimary}`);
          }
        }
      }
      
      logInfo('Photo cache invalidated', { productId });
    } catch (error) {
      logError('Error invalidating photo cache', error as Error);
    }
  }
  async getProducts(req: Request, res: Response) {
    try {
      const includeStock = req.query.includeStock === 'true';
      const id = req.query.id ? parseInt(req.query.id as string) : undefined;
      
      logInfo('Fetching products', { 
        userId: (req as any).user?.id,
        includeStock,
        id
      });
      
      if (includeStock) {
        const products = await storage.getProductsWithStock(id);
        res.json(products);
      } else {
        const products = await storage.getProducts();
        res.json(products);
      }
    } catch (error) {
      logError("Error fetching products", error as Error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  }

  async getProductById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const includeStock = req.query.includeStock === 'true';
      
      logInfo('Fetching product by ID', { 
        userId: (req as any).user?.id,
        productId: id,
        includeStock
      });
      
      if (includeStock) {
        const products = await storage.getProductsWithStock(id);
        if (!products || products.length === 0) {
          return res.status(404).json({ message: "Product not found" });
        }
        res.json(products[0]);
      } else {
        const product = await storage.getProduct(id);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
      }
    } catch (error) {
      logError("Error fetching product", error as Error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  }

  async getProductBySku(req: Request, res: Response) {
    try {
      const sku = req.params.sku;
      
      logInfo('Fetching product by SKU', { 
        userId: (req as any).user?.id,
        sku 
      });
      
      const product = await storage.getProductBySku(sku);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      logError("Error fetching product by SKU", error as Error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  }

  async createProduct(req: Request, res: Response) {
    try {
      const result = insertProductSchema.safeParse({
        ...req.body,
        createdBy: (req as any).user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      logInfo('Creating product', { 
        userId: (req as any).user?.id,
        productSku: result.data.sku,
        productName: result.data.name
      });

      const product = await storage.createProduct(result.data);
      res.status(201).json(product);
    } catch (error) {
      logError("Error creating product", error as Error);
      res.status(500).json({ message: "Failed to create product" });
    }
  }

  async updateProduct(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = insertProductSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      logInfo('Updating product', { 
        userId: (req as any).user?.id,
        productId: id,
        updatedFields: Object.keys(result.data)
      });

      const product = await storage.updateProduct(id, result.data);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      logError("Error updating product", error as Error);
      res.status(500).json({ message: "Failed to update product" });
    }
  }

  async deleteProduct(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      logInfo('Deleting product', { 
        userId: (req as any).user?.id,
        productId: id
      });
      
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      logError("Error deleting product", error as Error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  }

  // Product Photos methods with pagination
  async getProductPhotos(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const fullResolution = req.query.full === 'true';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const onlyPrimary = req.query.primary === 'true';
      const legacyFormat = req.query.legacy === 'true';
      
      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ 
          error: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100' 
        });
      }
      
      logInfo('Fetching product photos', { 
        userId: (req as any).user?.id,
        productId,
        page,
        limit,
        total: 0 // Will be updated after query
      });

      // Create cache key
      const cacheKey = `product:${productId}:photos:${page}:${limit}:${onlyPrimary}`;
      
      // Try to get from cache first
      let result = await getCache<any>(cacheKey);
      
      if (!result) {
        // If not in cache, fetch from database
        result = await storage.getProductPhotos(productId, {
          page,
          limit,
          onlyPrimary
        });
        
        // Cache for 5 minutes (photos don't change frequently)
        await setCache(cacheKey, result, 300);
      }
      
      // Transform photos based on resolution requested
      const transformedPhotos = result.photos.map((photo: any) => {
        if (fullResolution) {
          // Return original resolution
          return photo;
        } else {
          // Return thumbnail resolution, fallback to original if no thumbnail
          return {
            ...photo,
            url: photo.thumbnailUrl || photo.url
          };
        }
      });
      
      // Support legacy format for backward compatibility
      if (legacyFormat) {
        res.json(transformedPhotos);
      } else {
        res.json({
          photos: transformedPhotos,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            hasMore: result.hasMore,
            totalPages: Math.ceil(result.total / result.limit)
          }
        });
      }
    } catch (error) {
      logError("Error fetching product photos", error as Error);
      res.status(500).json({ message: "Failed to fetch product photos" });
    }
  }

  // Get only primary photo (faster for large collections)
  async getPrimaryPhoto(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const fullResolution = req.query.full === 'true';
      
      logInfo('Fetching primary product photo', { 
        userId: (req as any).user?.id,
        productId,
        fullResolution
      });

      // Create cache key for primary photo
      const cacheKey = `product:${productId}:photo:primary`;
      
      // Try to get from cache first
      let result = await getCache<any>(cacheKey);
      
      if (!result) {
        // If not in cache, fetch from database
        result = await storage.getProductPhotos(productId, {
          page: 1,
          limit: 1,
          onlyPrimary: true
        });
        
        // Cache for 10 minutes (primary photos change even less frequently)
        await setCache(cacheKey, result, 600);
        logInfo('Primary photo cached', { productId, cacheKey });
      } else {
        logInfo('Primary photo served from cache', { productId, cacheKey });
      }
      
      if (result.photos.length === 0) {
        return res.status(404).json({ message: "No primary photo found" });
      }
      
      const photo = result.photos[0];
      const transformedPhoto = fullResolution ? photo : {
        ...photo,
        url: photo.thumbnailUrl || photo.url
      };
      
      res.json(transformedPhoto);
    } catch (error) {
      logError("Error fetching primary photo", error as Error);
      res.status(500).json({ message: "Failed to fetch primary photo" });
    }
  }

  async addProductPhoto(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const photoData = {
        ...req.body,
        productId,
        uploadedBy: (req as any).user.id,
      };

      logInfo('Adding product photo', {
        productId,
        filename: photoData.filename,
        userId: (req as any).user.id,
        isPrimary: photoData.isPrimary || false
      });

      const photo = await storage.addProductPhoto(photoData, (req as any).user.id);
      
      // Invalidate cache for this product's photos
      await this.invalidatePhotoCache(productId);
      
      res.status(201).json({
        success: true,
        message: "Photo uploaded successfully",
        photo
      });
    } catch (error: any) {
      logError("Error adding product photo", error as Error);
      res.status(500).json({ 
        message: "Failed to add product photo",
        detail: error?.message || "Unknown error"
      });
    }
  }

  async getProductPhotoHistory(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const history = await storage.getProductPhotoHistory(productId);
      res.json(history);
    } catch (error) {
      logError("Error fetching product photo history", error as Error);
      res.status(500).json({ message: "Failed to fetch photo history" });
    }
  }
}

export const productsController = new ProductsController();
