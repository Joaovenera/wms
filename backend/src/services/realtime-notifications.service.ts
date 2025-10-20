import { broadcastUpdate } from "./websocket.service";
import { logInfo, logError } from "../utils/logger";
import { setCache, getCache } from "../config/redis";

interface NotificationConfig {
  enabled: boolean;
  channels: string[];
  filters: {
    criticality: 'all' | 'high' | 'critical';
    types: string[];
    locations: string[];
  };
  throttling: {
    enabled: boolean;
    maxPerMinute: number;
    windowMinutes: number;
  };
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: 'threshold' | 'pattern' | 'anomaly';
  conditions: any[];
  actions: AlertAction[];
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AlertAction {
  type: 'notification' | 'email' | 'sms' | 'webhook';
  target: string;
  template: string;
  enabled: boolean;
}

interface StockAlert {
  id: string;
  productId: number;
  sku: string;
  name: string;
  alertType: 'low_stock' | 'critical_stock' | 'overstock' | 'no_movement';
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentStock: number;
  threshold: number;
  message: string;
  location?: string;
  timestamp: string;
}

interface PositionAlert {
  id: string;
  positionId: number;
  positionCode: string;
  alertType: 'malfunction' | 'temperature' | 'access_denied' | 'maintenance_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: any;
  timestamp: string;
}

interface MovementAlert {
  id: string;
  movementId: number;
  alertType: 'delay' | 'error' | 'completion' | 'exception';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  ucpCode?: string;
  operator?: string;
  timestamp: string;
}

export class RealtimeNotificationsService {
  private config: NotificationConfig;
  private alertRules: Map<string, AlertRule>;
  private activeAlerts: Map<string, any>;
  
  constructor() {
    this.config = {
      enabled: true,
      channels: ['stock', 'positions', 'movements', 'system'],
      filters: {
        criticality: 'high',
        types: ['stock', 'position', 'movement'],
        locations: []
      },
      throttling: {
        enabled: true,
        maxPerMinute: 10,
        windowMinutes: 1
      }
    };
    
    this.alertRules = new Map();
    this.activeAlerts = new Map();
    this.initializeDefaultRules();
  }

  // Stock alert notifications
  async notifyStockAlert(alert: StockAlert): Promise<void> {
    try {
      if (!this.shouldSendAlert('stock', alert.severity)) {
        return;
      }

      const notification = {
        id: `stock_${alert.id}_${Date.now()}`,
        type: 'stock_alert',
        severity: alert.severity,
        title: `Stock Alert: ${alert.name}`,
        message: alert.message,
        data: {
          productId: alert.productId,
          sku: alert.sku,
          currentStock: alert.currentStock,
          threshold: alert.threshold,
          location: alert.location
        },
        timestamp: alert.timestamp,
        actions: [
          {
            label: 'View Product',
            action: 'navigate',
            target: `/inventory/products/${alert.productId}`
          },
          {
            label: 'Create Adjustment',
            action: 'dialog',
            target: 'inventory-adjustment'
          }
        ]
      };

      // Send real-time notification
      broadcastUpdate('stock-alert', notification);
      
      // Store notification for history
      await this.storeNotification(notification);
      
      // Apply throttling
      await this.updateThrottleCount('stock');
      
      logInfo('Stock alert notification sent', { 
        alertId: alert.id, 
        productId: alert.productId,
        severity: alert.severity 
      });

    } catch (error) {
      logError('Error sending stock alert notification', error as Error);
    }
  }

  // Position alert notifications
  async notifyPositionAlert(alert: PositionAlert): Promise<void> {
    try {
      if (!this.shouldSendAlert('position', alert.severity)) {
        return;
      }

      const notification = {
        id: `position_${alert.id}_${Date.now()}`,
        type: 'position_alert',
        severity: alert.severity,
        title: `Position Alert: ${alert.positionCode}`,
        message: alert.message,
        data: {
          positionId: alert.positionId,
          positionCode: alert.positionCode,
          alertType: alert.alertType,
          metadata: alert.metadata
        },
        timestamp: alert.timestamp,
        actions: [
          {
            label: 'View Position',
            action: 'navigate',
            target: `/warehouse-tracking/positions/${alert.positionId}`
          },
          {
            label: 'Update Status',
            action: 'dialog',
            target: 'position-status'
          }
        ]
      };

      broadcastUpdate('position-alert', notification);
      await this.storeNotification(notification);
      await this.updateThrottleCount('position');
      
      logInfo('Position alert notification sent', { 
        alertId: alert.id, 
        positionId: alert.positionId,
        severity: alert.severity 
      });

    } catch (error) {
      logError('Error sending position alert notification', error as Error);
    }
  }

  // Movement alert notifications
  async notifyMovementAlert(alert: MovementAlert): Promise<void> {
    try {
      if (!this.shouldSendAlert('movement', alert.severity)) {
        return;
      }

      const notification = {
        id: `movement_${alert.id}_${Date.now()}`,
        type: 'movement_alert',
        severity: alert.severity,
        title: `Movement Alert: ${alert.ucpCode || 'Unknown'}`,
        message: alert.message,
        data: {
          movementId: alert.movementId,
          alertType: alert.alertType,
          ucpCode: alert.ucpCode,
          operator: alert.operator
        },
        timestamp: alert.timestamp,
        actions: [
          {
            label: 'View Movement',
            action: 'navigate',
            target: `/warehouse-tracking/movements/${alert.movementId}`
          }
        ]
      };

      broadcastUpdate('movement-alert', notification);
      await this.storeNotification(notification);
      await this.updateThrottleCount('movement');
      
      logInfo('Movement alert notification sent', { 
        alertId: alert.id, 
        movementId: alert.movementId,
        severity: alert.severity 
      });

    } catch (error) {
      logError('Error sending movement alert notification', error as Error);
    }
  }

  // System status notifications
  async notifySystemStatus(status: {
    type: 'maintenance' | 'error' | 'recovery' | 'update';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    affectedSystems?: string[];
    estimatedDuration?: number;
  }): Promise<void> {
    try {
      const notification = {
        id: `system_${Date.now()}`,
        type: 'system_status',
        severity: status.severity,
        title: `System ${status.type.charAt(0).toUpperCase() + status.type.slice(1)}`,
        message: status.message,
        data: {
          statusType: status.type,
          affectedSystems: status.affectedSystems,
          estimatedDuration: status.estimatedDuration
        },
        timestamp: new Date().toISOString(),
        persistent: status.severity === 'critical' || status.type === 'maintenance'
      };

      broadcastUpdate('system-status', notification);
      await this.storeNotification(notification);
      
      logInfo('System status notification sent', { 
        type: status.type,
        severity: status.severity 
      });

    } catch (error) {
      logError('Error sending system status notification', error as Error);
    }
  }

  // Batch notifications for multiple alerts
  async notifyBatchAlerts(alerts: {
    type: 'daily_summary' | 'shift_report' | 'critical_batch';
    title: string;
    summary: string;
    alerts: Array<StockAlert | PositionAlert | MovementAlert>;
    metrics?: any;
  }): Promise<void> {
    try {
      const notification = {
        id: `batch_${Date.now()}`,
        type: 'batch_alert',
        severity: 'medium' as const,
        title: alerts.title,
        message: alerts.summary,
        data: {
          batchType: alerts.type,
          alertCount: alerts.alerts.length,
          breakdown: this.categorizeAlerts(alerts.alerts),
          metrics: alerts.metrics
        },
        timestamp: new Date().toISOString(),
        actions: [
          {
            label: 'View Details',
            action: 'navigate',
            target: '/notifications/batch'
          }
        ]
      };

      broadcastUpdate('batch-alert', notification);
      await this.storeNotification(notification);
      
      logInfo('Batch alert notification sent', { 
        type: alerts.type,
        alertCount: alerts.alerts.length 
      });

    } catch (error) {
      logError('Error sending batch alert notification', error as Error);
    }
  }

  // Notification management
  async getNotificationHistory(filters: {
    type?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const cacheKey = `notifications:history:${JSON.stringify(filters)}`;
      
      let notifications = await getCache<any[]>(cacheKey);
      if (!notifications) {
        // This would fetch from database in real implementation
        notifications = [];
        await setCache(cacheKey, notifications, 300); // 5 minute cache
      }
      
      return notifications;
    } catch (error) {
      logError('Error getting notification history', error as Error);
      return [];
    }
  }

  async markNotificationRead(notificationId: string, userId: number): Promise<boolean> {
    try {
      // Implementation would mark notification as read in database
      logInfo('Notification marked as read', { notificationId, userId });
      return true;
    } catch (error) {
      logError('Error marking notification as read', error as Error);
      return false;
    }
  }

  async updateNotificationConfig(newConfig: Partial<NotificationConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...newConfig };
      await setCache('notifications:config', this.config, 3600); // 1 hour cache
      
      broadcastUpdate('config-updated', { 
        type: 'notifications',
        config: this.config 
      });
      
      logInfo('Notification config updated', { config: this.config });
    } catch (error) {
      logError('Error updating notification config', error as Error);
    }
  }

  // Private helper methods
  private async shouldSendAlert(channel: string, severity: string): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (!this.config.channels.includes(channel)) return false;
    
    // Check criticality filter
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const minLevel = severityLevels[this.config.filters.criticality];
    const alertLevel = severityLevels[severity as keyof typeof severityLevels];
    
    if (alertLevel < minLevel) return false;
    
    // Check throttling
    if (this.config.throttling.enabled) {
      const throttleKey = `throttle:${channel}`;
      const currentCount = await getCache<number>(throttleKey) || 0;
      
      if (currentCount >= this.config.throttling.maxPerMinute) {
        return false;
      }
    }
    
    return true;
  }

  private async storeNotification(notification: any): Promise<void> {
    try {
      const historyKey = `notifications:history:${new Date().toISOString().split('T')[0]}`;
      const history = await getCache<any[]>(historyKey) || [];
      
      history.push(notification);
      
      // Keep only last 1000 notifications per day
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
      
      await setCache(historyKey, history, 24 * 60 * 60); // 24 hour cache
    } catch (error) {
      logError('Error storing notification', error as Error);
    }
  }

  private async updateThrottleCount(channel: string): Promise<void> {
    if (!this.config.throttling.enabled) return;
    
    try {
      const throttleKey = `throttle:${channel}`;
      const currentCount = await getCache<number>(throttleKey) || 0;
      const ttl = this.config.throttling.windowMinutes * 60;
      
      await setCache(throttleKey, currentCount + 1, ttl);
    } catch (error) {
      logError('Error updating throttle count', error as Error);
    }
  }

  private categorizeAlerts(alerts: Array<StockAlert | PositionAlert | MovementAlert>): any {
    const breakdown = {
      stock: { count: 0, critical: 0 },
      position: { count: 0, critical: 0 },
      movement: { count: 0, critical: 0 }
    };
    
    alerts.forEach(alert => {
      if ('productId' in alert) {
        breakdown.stock.count++;
        if (alert.severity === 'critical') breakdown.stock.critical++;
      } else if ('positionId' in alert) {
        breakdown.position.count++;
        if (alert.severity === 'critical') breakdown.position.critical++;
      } else if ('movementId' in alert) {
        breakdown.movement.count++;
        if (alert.severity === 'critical') breakdown.movement.critical++;
      }
    });
    
    return breakdown;
  }

  private initializeDefaultRules(): void {
    // Default alert rules would be initialized here
    const defaultRules: AlertRule[] = [
      {
        id: 'critical_stock',
        name: 'Critical Stock Level',
        description: 'Alert when stock reaches zero',
        type: 'threshold',
        conditions: [{ field: 'currentStock', operator: 'lte', value: 0 }],
        actions: [
          { type: 'notification', target: 'all', template: 'critical_stock', enabled: true }
        ],
        enabled: true,
        priority: 'critical'
      }
      // More default rules would be added here
    ];
    
    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }
}

export const realtimeNotificationsService = new RealtimeNotificationsService();