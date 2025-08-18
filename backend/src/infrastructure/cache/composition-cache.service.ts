import { CacheService } from './cache.service';
import { CompositionRequest, CompositionResult } from '../../services/packaging-composition.service';

/**
 * Cache service specifically for packaging composition operations
 * Implements intelligent caching with composition-specific keys and TTL
 */
export class CompositionCacheService {
  private cacheService: CacheService;
  private readonly defaultTTL = 3600; // 1 hour
  private readonly complexCalculationTTL = 7200; // 2 hours for complex calculations

  constructor() {
    this.cacheService = new CacheService();
  }

  /**
   * Generate cache key for composition request
   */
  private generateCompositionKey(request: CompositionRequest): string {
    const productKey = request.products
      .map(p => `${p.productId}:${p.quantity}:${p.packagingTypeId || 'default'}`)
      .sort()
      .join('|');
    
    const palletKey = request.palletId || 'auto';
    const constraintKey = request.constraints ? 
      `w:${request.constraints.maxWeight || 'none'}|h:${request.constraints.maxHeight || 'none'}|v:${request.constraints.maxVolume || 'none'}` : 
      'none';
    
    return `composition:${Buffer.from(`${productKey}:${palletKey}:${constraintKey}`).toString('base64')}`;
  }

  /**
   * Generate cache key for composition validation
   */
  private generateValidationKey(request: CompositionRequest): string {
    return `validation:${this.generateCompositionKey(request)}`;
  }

  /**
   * Generate cache key for product details
   */
  private generateProductDetailsKey(productIds: number[]): string {
    return `product_details:${productIds.sort().join(',')}`;
  }

  /**
   * Cache composition calculation result
   */
  async cacheCompositionResult(request: CompositionRequest, result: CompositionResult): Promise<void> {
    const key = this.generateCompositionKey(request);
    const ttl = this.determineCompositionTTL(request);
    
    await this.cacheService.set(key, result, { ttl });
  }

  /**
   * Get cached composition result
   */
  async getCachedCompositionResult(request: CompositionRequest): Promise<CompositionResult | null> {
    const key = this.generateCompositionKey(request);
    return await this.cacheService.get<CompositionResult>(key);
  }

  /**
   * Cache validation result
   */
  async cacheValidationResult(request: CompositionRequest, result: any): Promise<void> {
    const key = this.generateValidationKey(request);
    await this.cacheService.set(key, result, { ttl: this.defaultTTL });
  }

  /**
   * Get cached validation result
   */
  async getCachedValidationResult(request: CompositionRequest): Promise<any | null> {
    const key = this.generateValidationKey(request);
    return await this.cacheService.get(key);
  }

  /**
   * Cache product details
   */
  async cacheProductDetails(productIds: number[], details: any[]): Promise<void> {
    const key = this.generateProductDetailsKey(productIds);
    await this.cacheService.set(key, details, { ttl: this.defaultTTL * 2 }); // Product details change less frequently
  }

  /**
   * Get cached product details
   */
  async getCachedProductDetails(productIds: number[]): Promise<any[] | null> {
    const key = this.generateProductDetailsKey(productIds);
    return await this.cacheService.get<any[]>(key);
  }

  /**
   * Invalidate cache for specific product
   */
  async invalidateProductCache(productId: number): Promise<void> {
    // Not supported in basic cache service; noop
  }

  /**
   * Invalidate cache for specific pallet
   */
  async invalidatePalletCache(palletId: number): Promise<void> {
    // Not supported in basic cache service; noop
  }

  /**
   * Pre-warm cache with common compositions
   */
  async preWarmCache(commonRequests: CompositionRequest[]): Promise<void> {
    // This would be called during system startup or scheduled maintenance
    for (const request of commonRequests) {
      const existing = await this.getCachedCompositionResult(request);
      if (!existing) {
        // Pre-calculate and cache common compositions
        // This would integrate with the actual composition service
        console.log(`Pre-warming cache for composition with ${request.products.length} products`);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    compositionKeys: number;
    validationKeys: number;
    productDetailsKeys: number;
    hitRate: number;
  }> {
    const allKeys = [] as string[]; // getAllKeys not implemented; return empty for now
    
    return {
      totalKeys: allKeys.length,
      compositionKeys: allKeys.filter(k => k.startsWith('composition:')).length,
      validationKeys: allKeys.filter(k => k.startsWith('validation:')).length,
      productDetailsKeys: allKeys.filter(k => k.startsWith('product_details:')).length,
      hitRate: 0
    };
  }

  /**
   * Determine TTL based on composition complexity
   */
  private determineCompositionTTL(request: CompositionRequest): number {
    const productCount = request.products.length;
    const totalQuantity = request.products.reduce((sum, p) => sum + p.quantity, 0);
    
    // More complex compositions get longer cache time
    if (productCount > 20 || totalQuantity > 500) {
      return this.complexCalculationTTL;
    }
    
    if (productCount > 10 || totalQuantity > 100) {
      return this.defaultTTL * 1.5;
    }
    
    return this.defaultTTL;
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredEntries(): Promise<number> {
    return 0;
  }

  /**
   * Clear all composition-related cache
   */
  async clearAllCompositionCache(): Promise<void> {
    const patterns = ['composition:*', 'validation:*', 'product_details:*'];
    
    // Patterns not supported in basic cache service; no-op
  }
}

export const compositionCacheService = new CompositionCacheService();