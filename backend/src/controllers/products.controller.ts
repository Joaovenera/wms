import { Request, Response } from "express";
import { storage } from "../storage";
import { insertProductSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";
import { logError, logInfo } from "../utils/logger";

export class ProductsController {
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

  // Product Photos methods
  async getProductPhotos(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const fullResolution = req.query.full === 'true';
      
      logInfo('Fetching product photos', { 
        userId: (req as any).user?.id,
        productId,
        fullResolution 
      });
      
      const photos = await storage.getProductPhotos(productId);
      
      // Transform photos based on resolution requested
      const transformedPhotos = photos.map(photo => {
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
      
      res.json(transformedPhotos);
    } catch (error) {
      logError("Error fetching product photos", error as Error);
      res.status(500).json({ message: "Failed to fetch product photos" });
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
