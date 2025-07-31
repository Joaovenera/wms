import { Request, Response } from 'express';
import { db } from '../db.js';
import { 
  transferReports,
  transferRequests,
  loadingExecutions,
  loadingItems,
  transferRequestItems,
  products,
  vehicles,
  users,
  insertTransferReportSchema
} from '../db/schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import logger from '../utils/logger.js';

export const transferReportsController = {
  // GET /api/transfer-reports - Listar relatórios gerados
  async getAllReports(req: Request, res: Response) {
    try {
      const { transferRequestId, reportType } = req.query;
      
      // Build WHERE conditions
      const conditions = [];
      if (transferRequestId) {
        conditions.push(eq(transferReports.transferRequestId, parseInt(transferRequestId as string)));
      }
      if (reportType) {
        conditions.push(eq(transferReports.reportType, reportType as string));
      }
      
      const query = db.select({
        id: transferReports.id,
        reportType: transferReports.reportType,
        generatedAt: transferReports.generatedAt,
        transferRequestId: transferReports.transferRequestId,
        transferRequestCode: transferRequests.code,
        generatedByName: users.firstName
      })
      .from(transferReports)
      .leftJoin(transferRequests, eq(transferReports.transferRequestId, transferRequests.id))
      .leftJoin(users, eq(transferReports.generatedBy, users.id));
      
      const baseQuery = conditions.length > 0 
        ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : query;
      
      const reports = await baseQuery.orderBy(desc(transferReports.generatedAt));
      
      logger.info(`Retrieved ${reports.length} transfer reports`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(reports);
    } catch (error) {
      logger.error('Error fetching transfer reports:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/transfer-reports/:id - Buscar relatório por ID
  async getReportById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const [report] = await db.select()
        .from(transferReports)
        .where(eq(transferReports.id, parseInt(id)))
        .limit(1);
      
      if (!report) {
        return res.status(404).json({ error: 'Relatório não encontrado' });
      }
      
      logger.info(`Retrieved transfer report by ID: ${id}`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(report);
    } catch (error) {
      logger.error('Error fetching transfer report by ID:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/transfer-reports/generate/:transferRequestId - Gerar relatório detalhado
  async generateDetailedReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { transferRequestId } = req.params;
      const requestId = parseInt(transferRequestId);
      
      // Buscar dados da transferência
      const [transferRequest] = await db.select({
        id: transferRequests.id,
        code: transferRequests.code,
        status: transferRequests.status,
        fromLocation: transferRequests.fromLocation,
        toLocation: transferRequests.toLocation,
        totalCubicVolume: transferRequests.totalCubicVolume,
        effectiveCapacity: transferRequests.effectiveCapacity,
        capacityUsagePercent: transferRequests.capacityUsagePercent,
        createdAt: transferRequests.createdAt,
        vehicleName: vehicles.name,
        vehicleCode: vehicles.code,
        vehicleCubicCapacity: vehicles.cubicCapacity,
        createdByName: users.firstName
      })
      .from(transferRequests)
      .leftJoin(vehicles, eq(transferRequests.vehicleId, vehicles.id))
      .leftJoin(users, eq(transferRequests.createdBy, users.id))
      .where(eq(transferRequests.id, requestId))
      .limit(1);
      
      if (!transferRequest) {
        return res.status(404).json({ error: 'Pedido de transferência não encontrado' });
      }
      
      // Buscar execução de carregamento
      const [loadingExecution] = await db.select({
        id: loadingExecutions.id,
        status: loadingExecutions.status,
        startedAt: loadingExecutions.startedAt,
        finishedAt: loadingExecutions.finishedAt,
        observations: loadingExecutions.observations,
        operatorName: users.firstName
      })
      .from(loadingExecutions)
      .leftJoin(users, eq(loadingExecutions.operatorId, users.id))
      .where(eq(loadingExecutions.transferRequestId, requestId))
      .limit(1);
      
      // Buscar itens detalhados
      const itemsData = await db.select({
        // Dados do item solicitado
        requestedProductId: transferRequestItems.productId,
        requestedQuantity: transferRequestItems.quantity,
        requestedCubicVolume: transferRequestItems.totalCubicVolume,
        requestedNotes: transferRequestItems.notes,
        
        // Dados do produto
        productName: products.name,
        productSku: products.sku,
        
        // Dados do carregamento (se existir)
        loadedQuantity: loadingItems.loadedQuantity,
        notLoadedQuantity: loadingItems.notLoadedQuantity,
        divergenceReason: loadingItems.divergenceReason,
        divergenceComments: loadingItems.divergenceComments,
        confirmedAt: loadingItems.confirmedAt
      })
      .from(transferRequestItems)
      .leftJoin(products, eq(transferRequestItems.productId, products.id))
      .leftJoin(loadingItems, eq(transferRequestItems.id, loadingItems.transferRequestItemId))
      .where(eq(transferRequestItems.transferRequestId, requestId))
      .orderBy(products.name);
      
      // Calcular estatísticas
      const stats = {
        totalItemsRequested: itemsData.length,
        totalItemsLoaded: itemsData.filter(item => 
          item.confirmedAt && parseFloat(item.loadedQuantity || '0') > 0
        ).length,
        totalItemsNotLoaded: itemsData.filter(item => 
          item.confirmedAt && parseFloat(item.loadedQuantity || '0') === 0
        ).length,
        totalItemsPartiallyLoaded: itemsData.filter(item => {
          const loaded = parseFloat(item.loadedQuantity || '0');
          const requested = parseFloat(item.requestedQuantity || '0');
          return item.confirmedAt && loaded > 0 && loaded < requested;
        }).length,
        totalDivergences: itemsData.filter(item => item.divergenceReason).length
      };
      
      // Agrupar divergências por motivo
      const divergencesByReason = itemsData.reduce((acc, item) => {
        if (item.divergenceReason) {
          acc[item.divergenceReason] = (acc[item.divergenceReason] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      // Montar dados do relatório
      const reportData = {
        transferRequest,
        loadingExecution,
        items: itemsData,
        statistics: stats,
        divergenceAnalysis: divergencesByReason,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user!.id
      };
      
      // Salvar relatório
      const [savedReport] = await db.insert(transferReports)
        .values({
          transferRequestId: requestId,
          loadingExecutionId: loadingExecution?.id,
          reportType: 'detailed',
          reportData: reportData,
          generatedBy: req.user!.id
        })
        .returning();
      
      logger.info(`Detailed report generated for transfer request: ${transferRequest.code}`, { 
        userId: req.user!.id,
        transferRequestId: requestId,
        reportId: savedReport.id
      });
      
      res.json({
        report: savedReport,
        data: reportData
      });
    } catch (error) {
      logger.error('Error generating detailed report:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/transfer-reports/divergence-analysis - Análise de divergências
  async getDivergenceAnalysis(req: Request, res: Response) {
    try {
      const { startDate, endDate, vehicleId } = req.query;
      
      // Query base para buscar divergências
      const query = db.select({
        transferRequestCode: transferRequests.code,
        transferRequestId: transferRequests.id,
        vehicleName: vehicles.name,
        vehicleCode: vehicles.code,
        fromLocation: transferRequests.fromLocation,
        toLocation: transferRequests.toLocation,
        productName: products.name,
        productSku: products.sku,
        requestedQuantity: loadingItems.requestedQuantity,
        loadedQuantity: loadingItems.loadedQuantity,
        notLoadedQuantity: loadingItems.notLoadedQuantity,
        divergenceReason: loadingItems.divergenceReason,
        divergenceComments: loadingItems.divergenceComments,
        confirmedAt: loadingItems.confirmedAt
      })
      .from(loadingItems)
      .leftJoin(transferRequestItems, eq(loadingItems.transferRequestItemId, transferRequestItems.id))
      .leftJoin(transferRequests, eq(transferRequestItems.transferRequestId, transferRequests.id))
      .leftJoin(vehicles, eq(transferRequests.vehicleId, vehicles.id))
      .leftJoin(products, eq(loadingItems.productId, products.id))
      
      // Build WHERE conditions
      const conditions = [sql`${loadingItems.divergenceReason} IS NOT NULL`];
      
      if (startDate) {
        conditions.push(gte(loadingItems.confirmedAt, new Date(startDate as string)));
      }
      
      if (endDate) {
        conditions.push(lte(loadingItems.confirmedAt, new Date(endDate as string)));
      }
      
      if (vehicleId) {
        conditions.push(eq(transferRequests.vehicleId, parseInt(vehicleId as string)));
      }
      
      const baseQuery = query.where(and(...conditions));
      
      const divergences = await baseQuery.orderBy(desc(loadingItems.confirmedAt));
      
      // Estatísticas de divergências
      const divergenceStats = {
        totalDivergences: divergences.length,
        byReason: divergences.reduce((acc, item) => {
          const reason = item.divergenceReason!;
          acc[reason] = (acc[reason] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byVehicle: divergences.reduce((acc, item) => {
          const vehicle = `${item.vehicleName} (${item.vehicleCode})`;
          acc[vehicle] = (acc[vehicle] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byRoute: divergences.reduce((acc, item) => {
          const route = `${item.fromLocation} → ${item.toLocation}`;
          acc[route] = (acc[route] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      
      logger.info(`Retrieved divergence analysis with ${divergences.length} divergences`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json({
        divergences,
        statistics: divergenceStats
      });
    } catch (error) {
      logger.error('Error generating divergence analysis:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/transfer-reports/efficiency-metrics - Métricas de eficiência
  async getEfficiencyMetrics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      // Query para buscar todas as transferências no período
      let query = db.select({
        id: transferRequests.id,
        code: transferRequests.code,
        status: transferRequests.status,
        totalCubicVolume: transferRequests.totalCubicVolume,
        effectiveCapacity: transferRequests.effectiveCapacity,
        capacityUsagePercent: transferRequests.capacityUsagePercent,
        createdAt: transferRequests.createdAt,
        vehicleName: vehicles.name,
        loadingStartedAt: loadingExecutions.startedAt,
        loadingFinishedAt: loadingExecutions.finishedAt
      })
      .from(transferRequests)
      .leftJoin(vehicles, eq(transferRequests.vehicleId, vehicles.id))
      .leftJoin(loadingExecutions, eq(transferRequests.id, loadingExecutions.transferRequestId))
      
      // Build WHERE conditions
      const conditions = [sql`${transferRequests.status} IN ('finalizado', 'transito')`];
      
      if (startDate) {
        conditions.push(gte(transferRequests.createdAt, new Date(startDate as string)));
      }
      
      if (endDate) {
        conditions.push(lte(transferRequests.createdAt, new Date(endDate as string)));
      }
      
      const queryWithConditions = query.where(and(...conditions));
      
      const transfers = await queryWithConditions.orderBy(desc(transferRequests.createdAt));
      
      // Calcular métricas
      const metrics = {
        totalTransfers: transfers.length,
        averageCapacityUsage: transfers.reduce((sum, t) => 
          sum + parseFloat(t.capacityUsagePercent || '0'), 0
        ) / transfers.length,
        averageLoadingTime: transfers
          .filter(t => t.loadingStartedAt && t.loadingFinishedAt)
          .reduce((sum, t) => {
            const start = new Date(t.loadingStartedAt!).getTime();
            const end = new Date(t.loadingFinishedAt!).getTime();
            return sum + (end - start);
          }, 0) / transfers.filter(t => t.loadingStartedAt && t.loadingFinishedAt).length,
        transfersByStatus: transfers.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        transfersByVehicle: transfers.reduce((acc, t) => {
          const vehicle = t.vehicleName || 'Desconhecido';
          acc[vehicle] = (acc[vehicle] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        capacityUtilizationRanges: {
          low: transfers.filter(t => parseFloat(t.capacityUsagePercent || '0') < 70).length,
          medium: transfers.filter(t => {
            const usage = parseFloat(t.capacityUsagePercent || '0');
            return usage >= 70 && usage < 90;
          }).length,
          high: transfers.filter(t => parseFloat(t.capacityUsagePercent || '0') >= 90).length
        }
      };
      
      logger.info(`Retrieved efficiency metrics for ${transfers.length} transfers`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json({
        transfers,
        metrics
      });
    } catch (error) {
      logger.error('Error generating efficiency metrics:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};