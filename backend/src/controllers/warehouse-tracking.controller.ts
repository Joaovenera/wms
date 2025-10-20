import { Request, Response } from "express";
import { storage } from "../storage";
import { logError, logInfo } from "../utils/logger";
import { setCache, getCache, deleteCache } from "../config/redis";
import { broadcastUpdate } from "../services/websocket.service";

interface WarehouseMetrics {
  totalPositions: number;
  occupiedPositions: number;
  availablePositions: number;
  occupancyRate: number;
  totalUCPs: number;
  totalProducts: number;
  criticalAlerts: number;
  activeMovements: number;
}

interface PositionStatus {
  id: number;
  code: string;
  street: string;
  side: string;
  position: number;
  level: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'manutencao' | 'bloqueada';
  ucpId?: number;
  ucpCode?: string;
  productCount?: number;
  lastActivity?: string;
  alertLevel?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  temperature?: number;
  humidity?: number;
}

interface LiveMovement {
  id: number;
  type: 'reception' | 'shipment' | 'transfer' | 'adjustment';
  ucpId?: number;
  ucpCode?: string;
  fromPosition?: string;
  toPosition?: string;
  productName?: string;
  quantity?: number;
  operator?: string;
  startTime: string;
  estimatedCompletion?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress?: number;
}

interface WarehouseZone {
  id: string;
  name: string;
  type: 'receiving' | 'storage' | 'shipping' | 'staging' | 'returns';
  positions: PositionStatus[];
  occupancyRate: number;
  temperature?: number;
  humidity?: number;
  alertCount: number;
  activeMovements: number;
}

export class WarehouseTrackingController {
  // Get real-time warehouse overview metrics
  async getWarehouseMetrics(req: Request, res: Response) {
    try {
      logInfo('Fetching warehouse metrics', { 
        userId: (req as any).user?.id 
      });

      const cacheKey = 'warehouse:metrics';
      
      // Try cache first (1 minute cache for real-time feel)
      let metrics = await getCache<WarehouseMetrics>(cacheKey);
      
      if (!metrics) {
        // Calculate metrics from database
        const positionStats = await storage.getPositionStatistics();
        const ucpStats = await storage.getUCPStatistics();
        const alertStats = await storage.getCriticalAlerts();
        const movementStats = await storage.getActiveMovements();
        
        metrics = {
          totalPositions: positionStats.total,
          occupiedPositions: positionStats.occupied,
          availablePositions: positionStats.available,
          occupancyRate: Math.round((positionStats.occupied / positionStats.total) * 100),
          totalUCPs: ucpStats.total,
          totalProducts: ucpStats.uniqueProducts,
          criticalAlerts: alertStats.critical,
          activeMovements: movementStats.inProgress
        };
        
        // Cache for 1 minute
        await setCache(cacheKey, metrics, 60);
      }
      
      res.json(metrics);
    } catch (error) {
      logError("Error fetching warehouse metrics", error as Error);
      res.status(500).json({ message: "Failed to fetch warehouse metrics" });
    }
  }

  // Get live position status map
  async getLivePositionMap(req: Request, res: Response) {
    try {
      const zone = req.query.zone as string;
      const street = req.query.street as string;
      const includeEmpty = req.query.includeEmpty !== 'false';
      
      logInfo('Fetching live position map', { 
        userId: (req as any).user?.id,
        zone,
        street,
        includeEmpty
      });

      const cacheKey = `warehouse:positions:${zone || 'all'}:${street || 'all'}:${includeEmpty}`;
      
      // Try cache first (30 second cache for real-time updates)
      let positions = await getCache<PositionStatus[]>(cacheKey);
      
      if (!positions) {
        positions = await this.calculatePositionStatuses({
          zone,
          street,
          includeEmpty
        });
        
        // Cache for 30 seconds
        await setCache(cacheKey, positions, 30);
      }
      
      res.json({ positions, lastUpdated: new Date().toISOString() });
    } catch (error) {
      logError("Error fetching position map", error as Error);
      res.status(500).json({ message: "Failed to fetch position map" });
    }
  }

  // Get warehouse zones overview
  async getWarehouseZones(req: Request, res: Response) {
    try {
      logInfo('Fetching warehouse zones', { 
        userId: (req as any).user?.id 
      });

      const cacheKey = 'warehouse:zones';
      
      // Try cache first (2 minute cache)
      let zones = await getCache<WarehouseZone[]>(cacheKey);
      
      if (!zones) {
        zones = await this.calculateZoneStatuses();
        
        // Cache for 2 minutes
        await setCache(cacheKey, zones, 120);
      }
      
      res.json({ zones, lastUpdated: new Date().toISOString() });
    } catch (error) {
      logError("Error fetching warehouse zones", error as Error);
      res.status(500).json({ message: "Failed to fetch warehouse zones" });
    }
  }

  // Get live movements feed
  async getLiveMovements(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const type = req.query.type as string;
      
      logInfo('Fetching live movements', { 
        userId: (req as any).user?.id,
        limit,
        status,
        type
      });

      const cacheKey = `warehouse:movements:${status || 'all'}:${type || 'all'}:${limit}`;
      
      // Try cache first (15 second cache for real-time feel)
      let movements = await getCache<LiveMovement[]>(cacheKey);
      
      if (!movements) {
        movements = await this.calculateLiveMovements({
          limit,
          status,
          type
        });
        
        // Cache for 15 seconds
        await setCache(cacheKey, movements, 15);
      }
      
      res.json({ movements, lastUpdated: new Date().toISOString() });
    } catch (error) {
      logError("Error fetching live movements", error as Error);
      res.status(500).json({ message: "Failed to fetch live movements" });
    }
  }

  // Get position details with history
  async getPositionDetails(req: Request, res: Response) {
    try {
      const positionId = parseInt(req.params.id);
      const includeHistory = req.query.history === 'true';
      
      logInfo('Fetching position details', { 
        userId: (req as any).user?.id,
        positionId,
        includeHistory
      });

      const position = await storage.getPositionWithDetails(positionId);
      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }

      let history = null;
      if (includeHistory) {
        history = await storage.getPositionHistory(positionId, { limit: 100 });
      }

      // Get current UCP details if occupied
      let ucpDetails = null;
      if (position.currentPalletId) {
        ucpDetails = await storage.getUCPDetailsByPosition(positionId);
      }

      // Calculate environmental data (mock for now)
      const environmental = await this.getEnvironmentalData(positionId);

      res.json({
        position,
        ucpDetails,
        environmental,
        history,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      logError("Error fetching position details", error as Error);
      res.status(500).json({ message: "Failed to fetch position details" });
    }
  }

  // Update position status (manual override)
  async updatePositionStatus(req: Request, res: Response) {
    try {
      const positionId = parseInt(req.params.id);
      const { status, reason, notes } = req.body;
      
      logInfo('Updating position status', { 
        userId: (req as any).user?.id,
        positionId,
        status,
        reason
      });

      const result = await storage.updatePositionStatus(positionId, {
        status,
        reason,
        notes,
        updatedBy: (req as any).user.id
      });

      if (!result) {
        return res.status(404).json({ message: "Position not found" });
      }

      // Invalidate relevant caches
      await this.invalidatePositionCaches();
      
      // Broadcast update to connected clients
      broadcastUpdate('position-status', {
        positionId,
        status,
        updatedBy: (req as any).user.id,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: "Position status updated successfully",
        position: result
      });
    } catch (error) {
      logError("Error updating position status", error as Error);
      res.status(500).json({ message: "Failed to update position status" });
    }
  }

  // Get warehouse heatmap data
  async getWarehouseHeatmap(req: Request, res: Response) {
    try {
      const metric = req.query.metric as 'occupancy' | 'activity' | 'alerts' | 'temperature';
      const timeframe = req.query.timeframe as '1h' | '24h' | '7d' || '24h';
      
      logInfo('Fetching warehouse heatmap', { 
        userId: (req as any).user?.id,
        metric,
        timeframe
      });

      const cacheKey = `warehouse:heatmap:${metric}:${timeframe}`;
      
      // Try cache first (5 minute cache)
      let heatmapData = await getCache<any>(cacheKey);
      
      if (!heatmapData) {
        heatmapData = await this.calculateHeatmapData(metric, timeframe);
        
        // Cache for 5 minutes
        await setCache(cacheKey, heatmapData, 300);
      }
      
      res.json(heatmapData);
    } catch (error) {
      logError("Error fetching warehouse heatmap", error as Error);
      res.status(500).json({ message: "Failed to fetch warehouse heatmap" });
    }
  }

  // Trigger real-time update
  async triggerRealTimeUpdate(req: Request, res: Response) {
    try {
      const { type, data } = req.body;
      
      logInfo('Triggering real-time update', { 
        userId: (req as any).user?.id,
        type
      });

      // Invalidate relevant caches
      await this.invalidateRealtimeCaches();
      
      // Broadcast update to all connected clients
      broadcastUpdate(type, {
        ...data,
        timestamp: new Date().toISOString(),
        triggeredBy: (req as any).user.id
      });

      res.json({
        success: true,
        message: "Real-time update triggered"
      });
    } catch (error) {
      logError("Error triggering real-time update", error as Error);
      res.status(500).json({ message: "Failed to trigger real-time update" });
    }
  }

  // Private helper methods
  private async calculatePositionStatuses(filters: any): Promise<PositionStatus[]> {
    // This would calculate position statuses from the database
    const positions = await storage.getPositionsWithStatus(filters);
    
    return positions.map((pos: any) => ({
      id: pos.id,
      code: pos.code,
      street: pos.street,
      side: pos.side,
      position: pos.position,
      level: pos.level,
      status: pos.status,
      ucpId: pos.ucpId,
      ucpCode: pos.ucpCode,
      productCount: pos.productCount || 0,
      lastActivity: pos.lastActivity,
      alertLevel: this.calculateAlertLevel(pos),
      temperature: pos.temperature || this.getRandomTemperature(),
      humidity: pos.humidity || this.getRandomHumidity()
    }));
  }

  private async calculateZoneStatuses(): Promise<WarehouseZone[]> {
    // This would calculate zone statistics
    const zones = await storage.getWarehouseZones();
    
    return zones.map((zone: any) => ({
      id: zone.id,
      name: zone.name,
      type: zone.type,
      positions: zone.positions,
      occupancyRate: Math.round((zone.occupiedPositions / zone.totalPositions) * 100),
      temperature: zone.avgTemperature || this.getRandomTemperature(),
      humidity: zone.avgHumidity || this.getRandomHumidity(),
      alertCount: zone.alertCount || 0,
      activeMovements: zone.activeMovements || 0
    }));
  }

  private async calculateLiveMovements(filters: any): Promise<LiveMovement[]> {
    // This would get live movements from the database
    const movements = await storage.getLiveMovements(filters);
    
    return movements.map((mov: any) => ({
      id: mov.id,
      type: mov.type,
      ucpId: mov.ucpId,
      ucpCode: mov.ucpCode,
      fromPosition: mov.fromPosition,
      toPosition: mov.toPosition,
      productName: mov.productName,
      quantity: mov.quantity,
      operator: mov.operatorName,
      startTime: mov.startTime,
      estimatedCompletion: mov.estimatedCompletion,
      status: mov.status,
      progress: mov.progress || this.calculateMovementProgress(mov)
    }));
  }

  private async calculateHeatmapData(metric: string, timeframe: string): Promise<any> {
    // This would calculate heatmap data based on the metric and timeframe
    const data = await storage.getHeatmapData(metric, timeframe);
    return data;
  }

  private calculateAlertLevel(position: any): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (position.status === 'bloqueada' || position.criticalIssues > 0) return 'critical';
    if (position.status === 'manutencao' || position.warnings > 0) return 'high';
    if (position.lowPriorityIssues > 0) return 'medium';
    if (position.minorIssues > 0) return 'low';
    return 'none';
  }

  private calculateMovementProgress(movement: any): number {
    if (movement.status === 'completed') return 100;
    if (movement.status === 'pending') return 0;
    
    // Calculate based on time elapsed vs estimated duration
    const startTime = new Date(movement.startTime);
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    const estimated = movement.estimatedDuration || 1800000; // 30 minutes default
    
    return Math.min(95, Math.round((elapsed / estimated) * 100));
  }

  private async getEnvironmentalData(positionId: number): Promise<any> {
    // Mock environmental data - would integrate with IoT sensors
    return {
      temperature: this.getRandomTemperature(),
      humidity: this.getRandomHumidity(),
      lastUpdate: new Date().toISOString(),
      sensorStatus: 'active'
    };
  }

  private getRandomTemperature(): number {
    return Math.round((18 + Math.random() * 8) * 10) / 10; // 18-26°C
  }

  private getRandomHumidity(): number {
    return Math.round((45 + Math.random() * 20)); // 45-65%
  }

  private async invalidatePositionCaches(): Promise<void> {
    try {
      const patterns = [
        'warehouse:positions:*',
        'warehouse:zones',
        'warehouse:metrics'
      ];
      
      for (const pattern of patterns) {
        await deleteCache(pattern);
      }
      
      logInfo('Position caches invalidated');
    } catch (error) {
      logError('Error invalidating position caches', error as Error);
    }
  }

  private async invalidateRealtimeCaches(): Promise<void> {
    try {
      const patterns = [
        'warehouse:*',
        'inventory:*'
      ];
      
      for (const pattern of patterns) {
        await deleteCache(pattern);
      }
      
      logInfo('Real-time caches invalidated');
    } catch (error) {
      logError('Error invalidating real-time caches', error as Error);
    }
  }
}

export const warehouseTrackingController = new WarehouseTrackingController();