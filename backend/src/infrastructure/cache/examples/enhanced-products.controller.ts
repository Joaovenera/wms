/**
 * Enhanced Products Controller Example
 * 
 * Demonstrates how to integrate intelligent caching into existing controllers
 * to replace manual cache management with automated, intelligent patterns.
 */

import { Request, Response } from 'express';
import { QueryCache, CacheInvalidation, ConditionalCache, MultiLevelCache } from '../query-cache.decorator.js';
import { cacheAsideService } from '../cache-aside.service.js';
import { intelligentCache } from '../intelligent-cache.service.js';
import { logInfo, logError } from '../../../utils/logger.js';

// Simulated storage service for demonstration
class ProductStorage {
  async getProduct(id: number) {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 50));
    return { id, name: `Product ${id}`, stock: Math.floor(Math.random() * 1000) };
  }

  async getProductPhotos(productId: number, options: { page: number; limit: number; onlyPrimary: boolean }) {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 100));
    const photos = Array.from({ length: options.limit }, (_, i) => ({
      id: i + 1,
      productId,
      url: `https://example.com/photo-${i + 1}.jpg`,
      isPrimary: i === 0,
    }));
    
    return {
      photos: options.onlyPrimary ? photos.slice(0, 1) : photos,
      total: options.onlyPrimary ? 1 : 20,
      page: options.page,
      limit: options.limit,
    };
  }

  async addProductPhoto(photoData: any, userId: number) {
    // Simulate database insert
    await new Promise(resolve => setTimeout(resolve, 30));
    return { id: Date.now(), ...photoData, addedBy: userId };
  }

  async updateProduct(id: number, data: any) {
    // Simulate database update
    await new Promise(resolve => setTimeout(resolve, 40));
    return { id, ...data, updatedAt: new Date() };
  }

  async deleteProduct(id: number) {
    // Simulate database delete
    await new Promise(resolve => setTimeout(resolve, 20));
    return { id, deleted: true };
  }
}

const storage = new ProductStorage();

@CacheInvalidation('products')
export class EnhancedProductsController {
  
  /**
   * Get product photos with intelligent multi-level caching
   * Replaces the manual cache key management seen in the original controller
   */
  @MultiLevelCache({
    // High-frequency access (mobile apps, dashboard)
    highFrequency: {
      key: 'product.photos.high.{0}.{1}.{2}.{3}',
      volatility: 'medium',
      dependencies: ['products', 'photos'],
      useL1Cache: true,
      condition: (productId: number, page: number, limit: number) => limit <= 20 && page <= 5,
    },
    // Admin or bulk access
    bulkAccess: {
      key: 'product.photos.bulk.{0}.{1}.{2}.{3}',
      volatility: 'medium',
      dependencies: ['products', 'photos'],
      useL1Cache: false, // Don't fill L1 with bulk data
      condition: (productId: number, page: number, limit: number) => limit > 20 || page > 5,
    },
    // Primary photo only (very frequent)
    primaryOnly: {
      key: 'product.photos.primary.{0}',
      volatility: 'low',
      dependencies: ['products', 'photos'],
      useL1Cache: true,
      condition: (productId: number, page: number, limit: number, onlyPrimary: boolean) => onlyPrimary,
    },
  })
  async getProductPhotos(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.productId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const onlyPrimary = req.query.onlyPrimary === 'true';
      const fullResolution = req.query.fullResolution === 'true';

      // The decorator handles all caching logic automatically
      const result = await storage.getProductPhotos(productId, { page, limit, onlyPrimary });

      // Transform photos based on resolution (this logic is cached too)
      const transformedPhotos = result.photos.map(photo => ({
        ...photo,
        url: fullResolution ? photo.url : photo.url.replace('.jpg', '_thumb.jpg'),
      }));

      res.json({
        success: true,
        data: {
          ...result,
          photos: transformedPhotos,
          cached: true,
          cacheStrategy: onlyPrimary ? 'primaryOnly' : (limit > 20 ? 'bulkAccess' : 'highFrequency'),
        },
      });
    } catch (error) {
      logError('Error getting product photos', {
        productId: req.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get product photos',
      });
    }
  }

  /**
   * Get primary photo with intelligent caching and background refresh
   */
  async getPrimaryPhoto(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.productId);
      const fullResolution = req.query.fullResolution === 'true';

      // Use cache-aside pattern with background refresh
      const result = await cacheAsideService.get(
        `product:${productId}:photo:primary`,
        async () => {
          return await storage.getProductPhotos(productId, {
            page: 1,
            limit: 1,
            onlyPrimary: true,
          });
        },
        {
          ttl: 600, // 10 minutes
          dependencies: ['products', 'photos'],
          volatility: 'low',
          refreshPolicy: {
            enabled: true,
            refreshThreshold: 0.8, // Refresh when 80% of TTL passed
            priority: 'high', // Primary photos are important
          },
        }
      );

      if (result.photos.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Primary photo not found',
        });
        return;
      }

      const photo = result.photos[0];
      const transformedPhoto = {
        ...photo,
        url: fullResolution ? photo.url : photo.url.replace('.jpg', '_thumb.jpg'),
      };

      res.json({
        success: true,
        data: transformedPhoto,
        cached: true,
        backgroundRefresh: true,
      });
    } catch (error) {
      logError('Error getting primary photo', {
        productId: req.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get primary photo',
      });
    }
  }

  /**
   * Add product photo with intelligent cache invalidation
   * Replaces manual cache invalidation with dependency-based invalidation
   */
  async addProductPhoto(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.productId);
      const photoData = {
        productId,
        ...req.body,
      };

      const photo = await storage.addProductPhoto(photoData, (req as any).user.id);
      
      // Intelligent cache invalidation - automatically invalidates all related cache entries
      await intelligentCache.invalidateByDependency('photos');
      await intelligentCache.invalidateByDependency('products');
      
      logInfo('Product photo added with intelligent cache invalidation', {
        productId,
        photoId: photo.id,
      });
      
      res.status(201).json({
        success: true,
        data: photo,
        cacheInvalidated: true,
      });
    } catch (error) {
      logError('Error adding product photo', {
        productId: req.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to add product photo',
      });
    }
  }

  /**
   * Get product with conditional caching based on user role
   */
  @ConditionalCache(
    (req: Request) => {
      const user = (req as any).user;
      // Don't cache for admin users (they need real-time data)
      // Cache for regular users
      return user?.role !== 'admin';
    },
    {
      key: 'product.details.{0}',
      volatility: 'medium',
      dependencies: ['products'],
      useL1Cache: true,
    }
  )
  async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.productId);
      const user = (req as any).user;
      
      const product = await storage.getProduct(productId);
      
      res.json({
        success: true,
        data: product,
        cached: user?.role !== 'admin',
        userRole: user?.role,
      });
    } catch (error) {
      logError('Error getting product', {
        productId: req.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get product',
      });
    }
  }

  /**
   * Update product with intelligent cache invalidation
   */
  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.productId);
      const updateData = req.body;
      
      const updatedProduct = await storage.updateProduct(productId, updateData);
      
      // Use the @CacheInvalidation decorator's automatic invalidation
      await (this as any).invalidateCache();
      
      logInfo('Product updated with cache invalidation', { productId });
      
      res.json({
        success: true,
        data: updatedProduct,
        cacheInvalidated: true,
      });
    } catch (error) {
      logError('Error updating product', {
        productId: req.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to update product',
      });
    }
  }

  /**
   * Delete product with comprehensive cache cleanup
   */
  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const productId = parseInt(req.params.productId);
      
      const result = await storage.deleteProduct(productId);
      
      // Invalidate multiple dependencies for comprehensive cleanup
      await Promise.all([
        intelligentCache.invalidateByDependency('products'),
        intelligentCache.invalidateByDependency('photos'),
        intelligentCache.invalidateByDependency('inventory'),
        intelligentCache.invalidateByDependency('search'),
      ]);
      
      logInfo('Product deleted with comprehensive cache cleanup', { productId });
      
      res.json({
        success: true,
        data: result,
        cacheInvalidated: true,
      });
    } catch (error) {
      logError('Error deleting product', {
        productId: req.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete product',
      });
    }
  }

  /**
   * Bulk operations with intelligent cache warming
   */
  async bulkGetProducts(req: Request, res: Response): Promise<void> {
    try {
      const { productIds } = req.body;
      
      if (!Array.isArray(productIds)) {
        res.status(400).json({
          success: false,
          error: 'productIds must be an array',
        });
        return;
      }

      // Use cache-aside for bulk operations
      const products = await Promise.all(
        productIds.map(async (id: number) => {
          return await cacheAsideService.get(
            `product:${id}:details`,
            async () => await storage.getProduct(id),
            {
              ttl: 300,
              dependencies: ['products'],
              volatility: 'medium',
              refreshPolicy: {
                enabled: true,
                refreshThreshold: 0.7,
                priority: 'medium',
              },
            }
          );
        })
      );

      res.json({
        success: true,
        data: products,
        cached: true,
        bulkOperation: true,
      });
    } catch (error) {
      logError('Error in bulk get products', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get products',
      });
    }
  }
}

export const enhancedProductsController = new EnhancedProductsController();