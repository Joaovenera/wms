import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { transferReportsController } from '../../../controllers/transfer-reports.controller.js';
import { db } from '../../../db.js';
import { transferReports, transferRequests, loadingExecutions, loadingItems, products, vehicles, users } from '../../../db/schema.js';
import { AuthenticatedRequest } from '../../../middleware/auth.middleware.js';
import logger from '../../../utils/logger.js';
import { createMockRequest, createMockResponse, generateTransferReportData } from '../../utils/test-helpers.js';

// Mock dependencies
vi.mock('../../../db.js');
vi.mock('../../../utils/logger.js');

const mockDb = vi.mocked(db);
const mockLogger = vi.mocked(logger);

describe('TransferReportsController', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    
    // Setup authenticated user
    mockReq.user = {
      id: 1,
      email: 'admin@warehouse.com',
      role: 'admin'
    };
  });

  describe('getAllReports', () => {
    it('should retrieve all transfer reports successfully', async () => {
      const mockReports = [
        {
          id: 1,
          reportType: 'detailed',
          generatedAt: new Date('2023-12-01'),
          transferRequestId: 1,
          transferRequestCode: 'TR-20231201-1234',
          generatedByName: 'Admin'
        },
        {
          id: 2,
          reportType: 'summary',
          generatedAt: new Date('2023-12-02'),
          transferRequestId: 2,
          transferRequestCode: 'TR-20231202-5678',
          generatedByName: 'Manager'
        }
      ];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockReports)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getAllReports(mockReq as Request, mockRes as Response);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockReports);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved 2 transfer reports',
        { userId: 1 }
      );
    });

    it('should filter reports by transfer request ID', async () => {
      mockReq.query = { transferRequestId: '1' };
      const mockReports = [generateTransferReportData({ transferRequestId: 1 })];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockReports)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getAllReports(mockReq as Request, mockRes as Response);

      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockReports);
    });

    it('should filter reports by report type', async () => {
      mockReq.query = { reportType: 'detailed' };
      const mockReports = [generateTransferReportData({ reportType: 'detailed' })];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockReports)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getAllReports(mockReq as Request, mockRes as Response);

      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockReports);
    });

    it('should handle errors when fetching reports', async () => {
      const error = new Error('Database error');
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferReportsController.getAllReports(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching transfer reports:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('getReportById', () => {
    it('should retrieve report by ID successfully', async () => {
      mockReq.params = { id: '1' };
      
      const mockReport = generateTransferReportData({ id: 1 });

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockReport])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getReportById(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(mockReport);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved transfer report by ID: 1',
        { userId: 1 }
      );
    });

    it('should return 404 when report not found', async () => {
      mockReq.params = { id: '999' };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getReportById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Relatório não encontrado' });
    });

    it('should handle errors when fetching report by ID', async () => {
      mockReq.params = { id: '1' };
      const error = new Error('Database error');
      
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferReportsController.getReportById(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching transfer report by ID:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('generateDetailedReport', () => {
    it('should generate detailed report successfully', async () => {
      mockReq.params = { transferRequestId: '1' };

      const mockTransferRequest = {
        id: 1,
        code: 'TR-20231201-1234',
        status: 'finalizado',
        fromLocation: 'A1',
        toLocation: 'B2',
        totalCubicVolume: '25.5',
        effectiveCapacity: '50.0',
        capacityUsagePercent: '51.0',
        createdAt: new Date('2023-12-01'),
        vehicleName: 'Vehicle 1',
        vehicleCode: 'V001',
        vehicleCubicCapacity: '55.0',
        createdByName: 'Admin'
      };

      const mockLoadingExecution = {
        id: 1,
        status: 'finalizado',
        startedAt: new Date('2023-12-01T08:00:00Z'),
        finishedAt: new Date('2023-12-01T10:00:00Z'),
        observations: 'Loading completed successfully',
        operatorName: 'Operator'
      };

      const mockItemsData = [
        {
          requestedProductId: 1,
          requestedQuantity: '10',
          requestedCubicVolume: '10.0',
          requestedNotes: 'Item 1',
          productName: 'Product 1',
          productSku: 'SKU001',
          loadedQuantity: '10',
          notLoadedQuantity: '0',
          divergenceReason: null,
          divergenceComments: null,
          confirmedAt: new Date('2023-12-01T09:00:00Z')
        },
        {
          requestedProductId: 2,
          requestedQuantity: '5',
          requestedCubicVolume: '15.5',
          requestedNotes: 'Item 2',
          productName: 'Product 2',
          productSku: 'SKU002',
          loadedQuantity: '3',
          notLoadedQuantity: '2',
          divergenceReason: 'item_avariado',
          divergenceComments: 'Items damaged during handling',
          confirmedAt: new Date('2023-12-01T09:30:00Z')
        }
      ];

      const mockSavedReport = {
        id: 1,
        transferRequestId: 1,
        loadingExecutionId: 1,
        reportType: 'detailed',
        generatedBy: 1,
        generatedAt: new Date()
      };

      // Mock queries
      const mockTransferQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTransferRequest])
      };

      const mockLoadingQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockLoadingExecution])
      };

      const mockItemsQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockItemsData)
      };

      mockDb.select.mockReturnValueOnce(mockTransferQuery as any)
                 .mockReturnValueOnce(mockLoadingQuery as any)
                 .mockReturnValueOnce(mockItemsQuery as any);

      // Mock insert
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockSavedReport])
      };

      mockDb.insert.mockReturnValue(mockInsert as any);

      await transferReportsController.generateDetailedReport(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        report: mockSavedReport,
        data: expect.objectContaining({
          transferRequest: mockTransferRequest,
          loadingExecution: mockLoadingExecution,
          items: mockItemsData,
          statistics: expect.objectContaining({
            totalItemsRequested: 2,
            totalItemsLoaded: 1,
            totalItemsNotLoaded: 0,
            totalItemsPartiallyLoaded: 1,
            totalDivergences: 1
          }),
          divergenceAnalysis: {
            'item_avariado': 1
          }
        })
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Detailed report generated for transfer request: ${mockTransferRequest.code}`,
        { userId: 1, transferRequestId: 1, reportId: 1 }
      );
    });

    it('should return 404 when transfer request not found', async () => {
      mockReq.params = { transferRequestId: '999' };

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.generateDetailedReport(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Pedido de transferência não encontrado' });
    });

    it('should handle errors during report generation', async () => {
      mockReq.params = { transferRequestId: '1' };
      const error = new Error('Database error');
      
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferReportsController.generateDetailedReport(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Error generating detailed report:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('getDivergenceAnalysis', () => {
    it('should retrieve divergence analysis successfully', async () => {
      const mockDivergences = [
        {
          transferRequestCode: 'TR-20231201-1234',
          transferRequestId: 1,
          vehicleName: 'Vehicle 1',
          vehicleCode: 'V001',
          fromLocation: 'A1',
          toLocation: 'B2',
          productName: 'Product 1',
          productSku: 'SKU001',
          requestedQuantity: '10',
          loadedQuantity: '8',
          notLoadedQuantity: '2',
          divergenceReason: 'item_avariado',
          divergenceComments: 'Items damaged',
          confirmedAt: new Date('2023-12-01')
        },
        {
          transferRequestCode: 'TR-20231202-5678',
          transferRequestId: 2,
          vehicleName: 'Vehicle 2',
          vehicleCode: 'V002',
          fromLocation: 'C3',
          toLocation: 'D4',
          productName: 'Product 2',
          productSku: 'SKU002',
          requestedQuantity: '15',
          loadedQuantity: '10',
          notLoadedQuantity: '5',
          divergenceReason: 'falta_espaco',
          divergenceComments: 'Insufficient vehicle space',
          confirmedAt: new Date('2023-12-02')
        }
      ];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockDivergences)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getDivergenceAnalysis(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        divergences: mockDivergences,
        statistics: {
          totalDivergences: 2,
          byReason: {
            'item_avariado': 1,
            'falta_espaco': 1
          },
          byVehicle: {
            'Vehicle 1 (V001)': 1,
            'Vehicle 2 (V002)': 1
          },
          byRoute: {
            'A1 → B2': 1,
            'C3 → D4': 1
          }
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved divergence analysis with 2 divergences',
        { userId: 1 }
      );
    });

    it('should filter divergences by date range', async () => {
      mockReq.query = { 
        startDate: '2023-12-01', 
        endDate: '2023-12-02' 
      };

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getDivergenceAnalysis(mockReq as Request, mockRes as Response);

      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        divergences: [],
        statistics: expect.any(Object)
      });
    });

    it('should filter divergences by vehicle ID', async () => {
      mockReq.query = { vehicleId: '1' };

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getDivergenceAnalysis(mockReq as Request, mockRes as Response);

      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        divergences: [],
        statistics: expect.any(Object)
      });
    });

    it('should handle errors during divergence analysis', async () => {
      const error = new Error('Database error');
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferReportsController.getDivergenceAnalysis(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Error generating divergence analysis:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('getEfficiencyMetrics', () => {
    it('should retrieve efficiency metrics successfully', async () => {
      const mockTransfers = [
        {
          id: 1,
          code: 'TR-20231201-1234',
          status: 'finalizado',
          totalCubicVolume: '25.5',
          effectiveCapacity: '50.0',
          capacityUsagePercent: '51.0',
          createdAt: new Date('2023-12-01'),
          vehicleName: 'Vehicle 1',
          loadingStartedAt: new Date('2023-12-01T08:00:00Z'),
          loadingFinishedAt: new Date('2023-12-01T10:00:00Z')
        },
        {
          id: 2,
          code: 'TR-20231202-5678',
          status: 'transito',
          totalCubicVolume: '40.0',
          effectiveCapacity: '45.0',
          capacityUsagePercent: '88.9',
          createdAt: new Date('2023-12-02'),
          vehicleName: 'Vehicle 2',
          loadingStartedAt: new Date('2023-12-02T09:00:00Z'),
          loadingFinishedAt: new Date('2023-12-02T11:30:00Z')
        }
      ];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTransfers)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getEfficiencyMetrics(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        transfers: mockTransfers,
        metrics: expect.objectContaining({
          totalTransfers: 2,
          averageCapacityUsage: 69.95,
          averageLoadingTime: expect.any(Number),
          transfersByStatus: {
            'finalizado': 1,
            'transito': 1
          },
          transfersByVehicle: {
            'Vehicle 1': 1,
            'Vehicle 2': 1
          },
          capacityUtilizationRanges: {
            low: 1,
            medium: 0,
            high: 1
          }
        })
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved efficiency metrics for 2 transfers',
        { userId: 1 }
      );
    });

    it('should filter metrics by date range', async () => {
      mockReq.query = { 
        startDate: '2023-12-01', 
        endDate: '2023-12-02' 
      };

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getEfficiencyMetrics(mockReq as Request, mockRes as Response);

      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        transfers: [],
        metrics: expect.any(Object)
      });
    });

    it('should handle empty metrics data', async () => {
      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getEfficiencyMetrics(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        transfers: [],
        metrics: expect.objectContaining({
          totalTransfers: 0,
          averageCapacityUsage: NaN,
          averageLoadingTime: NaN
        })
      });
    });

    it('should handle errors during efficiency metrics calculation', async () => {
      const error = new Error('Database error');
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferReportsController.getEfficiencyMetrics(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Error generating efficiency metrics:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large datasets efficiently', async () => {
      const mockReports = Array.from({ length: 1000 }, (_, i) => 
        generateTransferReportData({ id: i + 1 })
      );

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockReports)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      const startTime = performance.now();
      await transferReportsController.getAllReports(mockReq as Request, mockRes as Response);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(mockRes.json).toHaveBeenCalledWith(mockReports);
    });

    it('should handle complex divergence analysis with multiple reasons', async () => {
      const reasons = ['item_avariado', 'falta_espaco', 'divergencia_estoque', 'item_nao_localizado'];
      const mockDivergences = reasons.flatMap((reason, index) => 
        Array.from({ length: index + 1 }, (_, i) => ({
          transferRequestCode: `TR-202312${String(index + 1).padStart(2, '0')}-${i + 1}`,
          transferRequestId: index * 10 + i + 1,
          vehicleName: `Vehicle ${index + 1}`,
          vehicleCode: `V00${index + 1}`,
          fromLocation: `A${index + 1}`,
          toLocation: `B${index + 1}`,
          productName: `Product ${i + 1}`,
          productSku: `SKU00${i + 1}`,
          requestedQuantity: '10',
          loadedQuantity: '5',
          notLoadedQuantity: '5',
          divergenceReason: reason,
          divergenceComments: `Comments for ${reason}`,
          confirmedAt: new Date(`2023-12-${String(index + 1).padStart(2, '0')}`)
        }))
      );

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockDivergences)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getDivergenceAnalysis(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        divergences: mockDivergences,
        statistics: expect.objectContaining({
          totalDivergences: 10,
          byReason: {
            'item_avariado': 1,
            'falta_espaco': 2,
            'divergencia_estoque': 3,
            'item_nao_localizado': 4
          }
        })
      });
    });

    it('should calculate capacity utilization ranges correctly', async () => {
      const mockTransfers = [
        // Low utilization (< 70%)
        { capacityUsagePercent: '50.0', status: 'finalizado' },
        { capacityUsagePercent: '65.0', status: 'finalizado' },
        // Medium utilization (70-90%)
        { capacityUsagePercent: '75.0', status: 'finalizado' },
        { capacityUsagePercent: '85.0', status: 'finalizado' },
        // High utilization (>= 90%)
        { capacityUsagePercent: '95.0', status: 'finalizado' },
        { capacityUsagePercent: '100.0', status: 'finalizado' }
      ].map((item, index) => ({
        id: index + 1,
        code: `TR-20231201-${index + 1}`,
        totalCubicVolume: '25.0',
        effectiveCapacity: '50.0',
        createdAt: new Date('2023-12-01'),
        vehicleName: `Vehicle ${index + 1}`,
        loadingStartedAt: null,
        loadingFinishedAt: null,
        ...item
      }));

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTransfers)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferReportsController.getEfficiencyMetrics(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        transfers: mockTransfers,
        metrics: expect.objectContaining({
          capacityUtilizationRanges: {
            low: 2,
            medium: 2,
            high: 2
          }
        })
      });
    });
  });
});