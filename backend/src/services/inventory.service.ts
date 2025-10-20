import { storage } from "../storage";
import { logError, logInfo } from "../utils/logger";
import { setCache, getCache } from "../config/redis";

interface StockCalculationOptions {
  includeReserved?: boolean;
  includeInTransit?: boolean;
  locationFilter?: string;
  asOfDate?: string;
}

interface StockMovementData {
  productId: number;
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reference: string;
  reason: string;
  performedBy: number;
  notes?: string;
  ucpId?: number;
  lotNumber?: string;
  expiryDate?: string;
}

interface InventoryAlert {
  productId: number;
  sku: string;
  name: string;
  currentStock: number;
  minStock: number;
  maxStock?: number;
  alertType: 'low_stock' | 'critical_stock' | 'overstock' | 'no_movement';
  severity: 'low' | 'medium' | 'high' | 'critical';
  daysUntilStockout?: number;
  location: string;
  lastMovement?: string;
}

interface StockLevelCalculation {
  productId: number;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  inTransitQuantity: number;
  locations: Array<{
    location: string;
    quantity: number;
    ucpCount: number;
    lastUpdated: string;
  }>;
  movements: Array<{
    date: string;
    type: string;
    quantity: number;
    balance: number;
  }>;
}

export class InventoryService {
  // Calculate comprehensive stock levels for a product
  async calculateProductStockLevel(productId: number, options: StockCalculationOptions = {}): Promise<StockLevelCalculation> {
    try {
      const cacheKey = `inventory:stock-level:${productId}:${JSON.stringify(options)}`;
      
      // Try cache first (2 minute cache)
      let result = await getCache<StockLevelCalculation>(cacheKey);
      
      if (!result) {
        // Get current stock from UCPs
        const ucpStock = await storage.getProductStockFromUCPs(productId, {
          locationFilter: options.locationFilter,
          asOfDate: options.asOfDate
        });
        
        // Get reserved stock from pending transfers/orders
        const reservedStock = options.includeReserved ? 
          await storage.getReservedStock(productId, options.locationFilter) : 0;
        
        // Get in-transit stock from active shipments
        const inTransitStock = options.includeInTransit ?
          await storage.getInTransitStock(productId, options.locationFilter) : 0;
        
        // Get recent stock movements for trend analysis
        const movements = await storage.getStockMovements(productId, {
          limit: 100,
          dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Last 30 days
        });
        
        result = {
          productId,
          totalQuantity: ucpStock.totalQuantity,
          availableQuantity: ucpStock.totalQuantity - reservedStock,
          reservedQuantity: reservedStock,
          inTransitQuantity: inTransitStock,
          locations: ucpStock.locations,
          movements: this.processMovementsForTrend(movements)
        };
        
        // Cache for 2 minutes
        await setCache(cacheKey, result, 120);
      }
      
      return result;
    } catch (error) {
      logError('Error calculating product stock level', error as Error);
      throw error;
    }
  }

  // Generate stock alerts based on min/max levels and movement patterns
  async generateStockAlerts(locationFilter?: string): Promise<InventoryAlert[]> {
    try {
      const cacheKey = `inventory:alerts:${locationFilter || 'all'}`;
      
      // Try cache first (5 minute cache)
      let alerts = await getCache<InventoryAlert[]>(cacheKey);
      
      if (!alerts) {
        // Get all products with stock levels
        const products = await storage.getProductsWithStockLevels(locationFilter);
        alerts = [];
        
        for (const product of products) {
          const stockLevel = await this.calculateProductStockLevel(product.id, { 
            locationFilter 
          });
          
          // Check for low stock
          if (stockLevel.availableQuantity <= product.minStock) {
            const alertType = stockLevel.availableQuantity === 0 ? 'critical_stock' : 'low_stock';
            const severity = stockLevel.availableQuantity === 0 ? 'critical' : 
                           stockLevel.availableQuantity < product.minStock * 0.5 ? 'high' : 'medium';
            
            // Calculate days until stockout based on average daily consumption
            const avgDailyConsumption = this.calculateAverageDailyConsumption(stockLevel.movements);
            const daysUntilStockout = avgDailyConsumption > 0 ? 
              Math.floor(stockLevel.availableQuantity / avgDailyConsumption) : undefined;
            
            alerts.push({
              productId: product.id,
              sku: product.sku,
              name: product.name,
              currentStock: stockLevel.availableQuantity,
              minStock: product.minStock,
              maxStock: product.maxStock,
              alertType,
              severity,
              daysUntilStockout,
              location: locationFilter || 'All locations',
              lastMovement: stockLevel.movements[0]?.date
            });
          }
          
          // Check for overstock
          if (product.maxStock && stockLevel.totalQuantity > product.maxStock) {
            alerts.push({
              productId: product.id,
              sku: product.sku,
              name: product.name,
              currentStock: stockLevel.totalQuantity,
              minStock: product.minStock,
              maxStock: product.maxStock,
              alertType: 'overstock',
              severity: 'low',
              location: locationFilter || 'All locations',
              lastMovement: stockLevel.movements[0]?.date
            });
          }
          
          // Check for no movement (stale inventory)
          const lastMovement = stockLevel.movements[0]?.date;
          if (lastMovement) {
            const daysSinceMovement = Math.floor(
              (Date.now() - new Date(lastMovement).getTime()) / (1000 * 60 * 60 * 24)
            );
            
            if (daysSinceMovement > 90) { // No movement for 90+ days
              alerts.push({
                productId: product.id,
                sku: product.sku,
                name: product.name,
                currentStock: stockLevel.totalQuantity,
                minStock: product.minStock,
                maxStock: product.maxStock,
                alertType: 'no_movement',
                severity: 'low',
                location: locationFilter || 'All locations',
                lastMovement
              });
            }
          }
        }
        
        // Sort alerts by severity and stock level
        alerts.sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[b.severity] - severityOrder[a.severity];
          }
          return a.currentStock - b.currentStock;
        });
        
        // Cache for 5 minutes
        await setCache(cacheKey, alerts, 300);
      }
      
      return alerts;
    } catch (error) {
      logError('Error generating stock alerts', error as Error);
      throw error;
    }
  }

  // Process inventory adjustment with full audit trail
  async processInventoryAdjustment(adjustmentData: {
    productId: number;
    locationId: number;
    currentQuantity: number;
    adjustedQuantity: number;
    reason: string;
    notes?: string;
    performedBy: number;
  }): Promise<any> {
    try {
      const difference = adjustmentData.adjustedQuantity - adjustmentData.currentQuantity;
      
      logInfo('Processing inventory adjustment', {
        productId: adjustmentData.productId,
        difference,
        reason: adjustmentData.reason,
        performedBy: adjustmentData.performedBy
      });
      
      // Start transaction
      const adjustment = await storage.createInventoryAdjustment({
        ...adjustmentData,
        difference,
        timestamp: new Date().toISOString()
      });
      
      // Create stock movement record
      await this.createStockMovement({
        productId: adjustmentData.productId,
        type: 'adjustment',
        quantity: Math.abs(difference),
        toLocation: difference > 0 ? `Location-${adjustmentData.locationId}` : undefined,
        fromLocation: difference < 0 ? `Location-${adjustmentData.locationId}` : undefined,
        reference: `ADJ-${adjustment.id}`,
        reason: adjustmentData.reason,
        notes: adjustmentData.notes,
        performedBy: adjustmentData.performedBy
      });
      
      // If adjustment creates/removes stock, update UCP accordingly
      if (difference !== 0) {
        await this.updateUCPForAdjustment(adjustmentData, difference);
      }
      
      // Invalidate relevant caches
      await this.invalidateProductCaches(adjustmentData.productId);
      
      return adjustment;
    } catch (error) {
      logError('Error processing inventory adjustment', error as Error);
      throw error;
    }
  }

  // Create comprehensive stock movement record
  async createStockMovement(movementData: StockMovementData): Promise<any> {
    try {
      const movement = await storage.createStockMovement({
        ...movementData,
        timestamp: new Date().toISOString()
      });
      
      // Invalidate related caches
      await this.invalidateProductCaches(movementData.productId);
      
      return movement;
    } catch (error) {
      logError('Error creating stock movement', error as Error);
      throw error;
    }
  }

  // Calculate ABC analysis for inventory management
  async performABCAnalysis(locationFilter?: string): Promise<any> {
    try {
      const cacheKey = `inventory:abc-analysis:${locationFilter || 'all'}`;
      
      // Try cache first (daily cache)
      let analysis = await getCache<any>(cacheKey);
      
      if (!analysis) {
        // Get products with movement data for last 12 months
        const products = await storage.getProductMovementData({
          locationFilter,
          dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          includeValue: true
        });
        
        // Calculate total movement value
        const totalValue = products.reduce((sum, p) => sum + p.totalMovementValue, 0);
        
        // Sort by movement value descending
        products.sort((a, b) => b.totalMovementValue - a.totalMovementValue);
        
        let cumulativeValue = 0;
        const classifiedProducts = products.map((product, index) => {
          cumulativeValue += product.totalMovementValue;
          const cumulativePercentage = (cumulativeValue / totalValue) * 100;
          
          let classification = 'C';
          if (cumulativePercentage <= 80) {
            classification = 'A';
          } else if (cumulativePercentage <= 95) {
            classification = 'B';
          }
          
          return {
            ...product,
            rank: index + 1,
            classification,
            cumulativePercentage: Math.round(cumulativePercentage * 100) / 100
          };
        });
        
        // Calculate summary statistics
        const aProducts = classifiedProducts.filter(p => p.classification === 'A');
        const bProducts = classifiedProducts.filter(p => p.classification === 'B');
        const cProducts = classifiedProducts.filter(p => p.classification === 'C');
        
        analysis = {
          summary: {
            totalProducts: products.length,
            totalValue,
            classA: {
              count: aProducts.length,
              percentage: Math.round((aProducts.length / products.length) * 100),
              valuePercentage: Math.round((aProducts.reduce((s, p) => s + p.totalMovementValue, 0) / totalValue) * 100)
            },
            classB: {
              count: bProducts.length,
              percentage: Math.round((bProducts.length / products.length) * 100),
              valuePercentage: Math.round((bProducts.reduce((s, p) => s + p.totalMovementValue, 0) / totalValue) * 100)
            },
            classC: {
              count: cProducts.length,
              percentage: Math.round((cProducts.length / products.length) * 100),
              valuePercentage: Math.round((cProducts.reduce((s, p) => s + p.totalMovementValue, 0) / totalValue) * 100)
            }
          },
          products: classifiedProducts
        };
        
        // Cache for 24 hours
        await setCache(cacheKey, analysis, 24 * 60 * 60);
      }
      
      return analysis;
    } catch (error) {
      logError('Error performing ABC analysis', error as Error);
      throw error;
    }
  }

  // Private helper methods
  private processMovementsForTrend(movements: any[]): Array<{ date: string; type: string; quantity: number; balance: number }> {
    let runningBalance = 0;
    return movements.reverse().map(movement => {
      const adjustedQuantity = movement.type === 'in' || movement.type === 'adjustment' && movement.quantity > 0
        ? movement.quantity
        : -movement.quantity;
      runningBalance += adjustedQuantity;
      
      return {
        date: movement.createdAt,
        type: movement.type,
        quantity: movement.quantity,
        balance: runningBalance
      };
    }).reverse();
  }

  private calculateAverageDailyConsumption(movements: any[]): number {
    const outMovements = movements.filter(m => m.type === 'out' || (m.type === 'adjustment' && m.quantity < 0));
    if (outMovements.length === 0) return 0;
    
    const totalConsumption = outMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const daysCovered = outMovements.length > 0 ? 
      Math.max(1, Math.floor((Date.now() - new Date(outMovements[outMovements.length - 1].date).getTime()) / (1000 * 60 * 60 * 24))) : 1;
    
    return totalConsumption / daysCovered;
  }

  private async updateUCPForAdjustment(adjustmentData: any, difference: number): Promise<void> {
    // Implementation depends on how adjustments affect UCPs
    // This might involve creating/updating UCP items or creating new UCPs
    logInfo('Updating UCP for inventory adjustment', { 
      productId: adjustmentData.productId, 
      difference 
    });
  }

  private async invalidateProductCaches(productId: number): Promise<void> {
    try {
      // Invalidate all caches related to this product
      const patterns = [
        `inventory:stock-level:${productId}:*`,
        `inventory:alerts:*`,
        `inventory:abc-analysis:*`
      ];
      
      // Note: This would need to be implemented based on Redis client capabilities
      logInfo('Invalidating product inventory caches', { productId });
    } catch (error) {
      logError('Error invalidating product caches', error as Error);
    }
  }
}

export const inventoryService = new InventoryService();