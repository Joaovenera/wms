import { Request, Response } from "express";
import { storage } from "../storage";
import { logError, logInfo } from "../utils/logger";
import { setCache, getCache, deleteCache } from "../config/redis";

interface StockLevel {
  productId: number;
  sku: string;
  name: string;
  currentStock: number;
  availableStock: number;
  reservedStock: number;
  inTransitStock: number;
  minStock: number;
  maxStock: number;
  status: 'ok' | 'low' | 'critical' | 'overstock';
  lastMovement: string;
  location: string;
}

interface StockMovement {
  id: number;
  productId: number;
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reference: string;
  reason: string;
  performedBy: number;
  timestamp: string;
}

interface InventoryAdjustment {
  productId: number;
  currentQuantity: number;
  adjustedQuantity: number;
  difference: number;
  reason: string;
  location: string;
  notes?: string;
}

export class InventoryController {
  // Get stock levels with filtering and pagination
  async getStockLevels(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const location = req.query.location as string;
      const search = req.query.search as string;
      const lowStockOnly = req.query.lowStock === 'true';
      
      logInfo('Fetching stock levels', { 
        userId: (req as any).user?.id,
        page,
        limit,
        status,
        location,
        search,
        lowStockOnly
      });

      // Create cache key
      const cacheKey = `inventory:stock-levels:${page}:${limit}:${status || 'all'}:${location || 'all'}:${search || 'all'}:${lowStockOnly}`;
      
      // Try to get from cache first (cache for 2 minutes as stock changes frequently)
      let result = await getCache<any>(cacheKey);
      
      if (!result) {
        // Calculate stock levels from UCPs and movements
        result = await this.calculateStockLevels({
          page,
          limit,
          status,
          location,
          search,
          lowStockOnly
        });
        
        // Cache for 2 minutes
        await setCache(cacheKey, result, 120);
      }
      
      res.json(result);
    } catch (error) {
      logError("Error fetching stock levels", error as Error);
      res.status(500).json({ message: "Failed to fetch stock levels" });
    }
  }

  // Get stock balance for specific product
  async getProductStockBalance(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const includeMovements = req.query.movements === 'true';
      
      logInfo('Fetching product stock balance', { 
        userId: (req as any).user?.id,
        productId,
        includeMovements
      });

      // Get current stock from UCPs
      const ucpStock = await storage.getProductStockFromUCPs(productId);
      
      // Get reserved stock from pending transfers
      const reservedStock = await storage.getReservedStock(productId);
      
      // Get in-transit stock from active transfers
      const inTransitStock = await storage.getInTransitStock(productId);
      
      const balance = {
        productId,
        currentStock: ucpStock.totalQuantity,
        availableStock: ucpStock.totalQuantity - reservedStock,
        reservedStock,
        inTransitStock,
        locations: ucpStock.locations,
        lastUpdated: new Date().toISOString()
      };

      if (includeMovements) {
        const movements = await storage.getStockMovements(productId, { limit: 50 });
        (balance as any).recentMovements = movements;
      }

      res.json(balance);
    } catch (error) {
      logError("Error fetching product stock balance", error as Error);
      res.status(500).json({ message: "Failed to fetch stock balance" });
    }
  }

  // Create inventory adjustment
  async createInventoryAdjustment(req: Request, res: Response) {
    try {
      const adjustmentData: InventoryAdjustment = {
        ...req.body,
        performedBy: (req as any).user.id
      };
      
      logInfo('Creating inventory adjustment', { 
        userId: (req as any).user?.id,
        productId: adjustmentData.productId,
        difference: adjustmentData.difference,
        reason: adjustmentData.reason
      });

      // Start transaction for inventory adjustment
      const result = await storage.createInventoryAdjustment(adjustmentData);
      
      // Invalidate stock level caches
      await this.invalidateStockCaches();
      
      // Create stock movement record
      await storage.createStockMovement({
        productId: adjustmentData.productId,
        type: 'adjustment',
        quantity: adjustmentData.difference,
        toLocation: adjustmentData.location,
        reference: `ADJ-${Date.now()}`,
        reason: adjustmentData.reason,
        performedBy: (req as any).user.id,
        notes: adjustmentData.notes
      });

      res.status(201).json({
        success: true,
        message: "Inventory adjustment created successfully",
        adjustment: result
      });
    } catch (error) {
      logError("Error creating inventory adjustment", error as Error);
      res.status(500).json({ message: "Failed to create inventory adjustment" });
    }
  }

  // Get stock movements with filtering
  async getStockMovements(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
      const type = req.query.type as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      
      logInfo('Fetching stock movements', { 
        userId: (req as any).user?.id,
        page,
        limit,
        productId,
        type,
        dateFrom,
        dateTo
      });

      const movements = await storage.getStockMovements(productId, {
        page,
        limit,
        type,
        dateFrom,
        dateTo
      });
      
      res.json(movements);
    } catch (error) {
      logError("Error fetching stock movements", error as Error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  }

  // Get low stock alerts
  async getLowStockAlerts(req: Request, res: Response) {
    try {
      const severity = req.query.severity as 'low' | 'critical' | 'all';
      
      logInfo('Fetching low stock alerts', { 
        userId: (req as any).user?.id,
        severity
      });

      const alerts = await this.calculateLowStockAlerts(severity);
      
      res.json(alerts);
    } catch (error) {
      logError("Error fetching low stock alerts", error as Error);
      res.status(500).json({ message: "Failed to fetch low stock alerts" });
    }
  }

  // Get inventory aging report
  async getInventoryAging(req: Request, res: Response) {
    try {
      const location = req.query.location as string;
      const agingDays = req.query.days ? parseInt(req.query.days as string) : 30;
      
      logInfo('Fetching inventory aging report', { 
        userId: (req as any).user?.id,
        location,
        agingDays
      });

      const aging = await storage.getInventoryAging({
        location,
        agingDays
      });
      
      res.json(aging);
    } catch (error) {
      logError("Error fetching inventory aging", error as Error);
      res.status(500).json({ message: "Failed to fetch inventory aging" });
    }
  }

  // Bulk stock update (for mass adjustments)
  async bulkStockUpdate(req: Request, res: Response) {
    try {
      const updates: InventoryAdjustment[] = req.body.updates;
      const reason = req.body.reason || 'Bulk adjustment';
      
      logInfo('Processing bulk stock update', { 
        userId: (req as any).user?.id,
        updateCount: updates.length,
        reason
      });

      const results = [];
      
      // Process each update in transaction
      for (const update of updates) {
        try {
          const result = await storage.createInventoryAdjustment({
            ...update,
            reason,
            performedBy: (req as any).user.id
          });
          
          // Create movement record
          await storage.createStockMovement({
            productId: update.productId,
            type: 'adjustment',
            quantity: update.difference,
            toLocation: update.location,
            reference: `BULK-ADJ-${Date.now()}`,
            reason,
            performedBy: (req as any).user.id
          });
          
          results.push({ success: true, productId: update.productId, result });
        } catch (error) {
          results.push({ success: false, productId: update.productId, error: (error as Error).message });
        }
      }
      
      // Invalidate caches
      await this.invalidateStockCaches();
      
      res.json({
        success: true,
        message: `Processed ${results.filter(r => r.success).length} of ${updates.length} updates`,
        results
      });
    } catch (error) {
      logError("Error processing bulk stock update", error as Error);
      res.status(500).json({ message: "Failed to process bulk stock update" });
    }
  }

  // Private helper methods
  private async calculateStockLevels(filters: any): Promise<any> {
    // This would calculate stock levels from UCPs, movements, and transfers
    // Implementation depends on storage layer methods
    const stockLevels = await storage.calculateStockLevels(filters);
    return stockLevels;
  }

  private async calculateLowStockAlerts(severity: 'low' | 'critical' | 'all'): Promise<any> {
    // Calculate which products are below min stock levels
    const alerts = await storage.getLowStockAlerts(severity);
    return alerts;
  }

  private async invalidateStockCaches() {
    try {
      // Invalidate all stock-related caches
      const patterns = [
        'inventory:stock-levels:*',
        'inventory:alerts:*',
        'inventory:movements:*'
      ];
      
      for (const pattern of patterns) {
        await deleteCache(pattern);
      }
      
      logInfo('Stock caches invalidated');
    } catch (error) {
      logError('Error invalidating stock caches', error as Error);
    }
  }
}

export const inventoryController = new InventoryController();