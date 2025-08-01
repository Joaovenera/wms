import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { VehiclesController } from '../../../controllers/vehicles.controller';
import { createMockRequest, createMockResponse } from '../../utils/test-helpers';

// Mock dependencies
vi.mock('../../../storage');
vi.mock('../../../utils/logger');
vi.mock('../../../config/redis');

describe('VehiclesController Unit Tests', () => {
  let controller: VehiclesController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  const mockStorage = {
    getVehicles: vi.fn(),
    getVehicle: vi.fn(),
    createVehicle: vi.fn(),
    updateVehicle: vi.fn(),
    deleteVehicle: vi.fn(),
    getVehicleHistory: vi.fn(),
    assignVehicleToRoute: vi.fn(),
    getAvailableVehicles: vi.fn(),
    getVehicleMetrics: vi.fn(),
  };

  const generateMockVehicle = (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000) + 1,
    code: `VEH${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    type: 'forklift',
    model: 'Toyota 8FBE15U',
    manufacturer: 'Toyota',
    year: 2022,
    capacity: 1500, // kg
    status: 'available',
    location: 'A-01-01',
    batteryLevel: 85,
    maintenanceStatus: 'ok',
    lastMaintenanceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    operatingHours: 1250,
    assignedOperatorId: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 1,
    ...overrides,
  });

  beforeEach(() => {
    controller = new VehiclesController();
    
    // Setup response mocks
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson, send: vi.fn() });
    
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockResponse.json = mockJson;
    mockResponse.status = mockStatus;

    // Mock storage methods
    Object.keys(mockStorage).forEach(key => {
      vi.doMock('../../../storage', () => ({
        [key]: mockStorage[key as keyof typeof mockStorage],
      }));
    });
    
    vi.clearAllMocks();
  });

  describe('getVehicles', () => {
    it('should return all vehicles when no filters applied', async () => {
      const mockVehicles = [
        generateMockVehicle(),
        generateMockVehicle({ type: 'reach_truck' }),
        generateMockVehicle({ type: 'order_picker' }),
      ];
      
      mockStorage.getVehicles.mockResolvedValue(mockVehicles);
      
      await controller.getVehicles(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getVehicles).toHaveBeenCalledWith({});
      expect(mockJson).toHaveBeenCalledWith(mockVehicles);
    });

    it('should filter vehicles by type', async () => {
      const forklifts = [
        generateMockVehicle({ type: 'forklift' }),
        generateMockVehicle({ type: 'forklift' }),
      ];
      
      mockStorage.getVehicles.mockResolvedValue(forklifts);
      mockRequest.query = { type: 'forklift' };
      
      await controller.getVehicles(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getVehicles).toHaveBeenCalledWith({ type: 'forklift' });
      expect(mockJson).toHaveBeenCalledWith(forklifts);
    });

    it('should filter vehicles by status', async () => {
      const availableVehicles = [
        generateMockVehicle({ status: 'available' }),
        generateMockVehicle({ status: 'available' }),
      ];
      
      mockStorage.getVehicles.mockResolvedValue(availableVehicles);
      mockRequest.query = { status: 'available' };
      
      await controller.getVehicles(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getVehicles).toHaveBeenCalledWith({ status: 'available' });
      expect(mockJson).toHaveBeenCalledWith(availableVehicles);
    });

    it('should filter vehicles by maintenance status', async () => {
      const maintenanceNeeded = [
        generateMockVehicle({ maintenanceStatus: 'due' }),
        generateMockVehicle({ maintenanceStatus: 'overdue' }),
      ];
      
      mockStorage.getVehicles.mockResolvedValue(maintenanceNeeded);
      mockRequest.query = { maintenanceStatus: 'due,overdue' };
      
      await controller.getVehicles(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getVehicles).toHaveBeenCalledWith({ 
        maintenanceStatus: ['due', 'overdue'] 
      });
    });

    it('should include metrics when requested', async () => {
      const vehiclesWithMetrics = [
        {
          ...generateMockVehicle(),
          metrics: {
            totalOperatingHours: 1250,
            averageUtilization: 0.75,
            totalTrips: 150,
            maintenanceCost: 2500.00,
          }
        }
      ];
      
      mockStorage.getVehicles.mockResolvedValue(vehiclesWithMetrics);
      mockRequest.query = { includeMetrics: 'true' };
      
      await controller.getVehicles(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getVehicles).toHaveBeenCalledWith({ includeMetrics: true });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      mockStorage.getVehicles.mockRejectedValue(error);
      
      await controller.getVehicles(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ 
        message: 'Failed to fetch vehicles',
        error: 'Database connection failed'
      });
    });
  });

  describe('getVehicleById', () => {
    it('should return vehicle by valid ID', async () => {
      const mockVehicle = generateMockVehicle({ id: 123 });
      
      mockStorage.getVehicle.mockResolvedValue(mockVehicle);
      mockRequest.params = { id: '123' };
      
      await controller.getVehicleById(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getVehicle).toHaveBeenCalledWith(123);
      expect(mockJson).toHaveBeenCalledWith(mockVehicle);
    });

    it('should return 404 when vehicle not found', async () => {
      mockStorage.getVehicle.mockResolvedValue(null);
      mockRequest.params = { id: '999' };
      
      await controller.getVehicleById(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Vehicle not found' });
    });

    it('should handle invalid ID parameter', async () => {
      mockRequest.params = { id: 'invalid' };
      
      await controller.getVehicleById(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Invalid vehicle ID' });
    });
  });

  describe('createVehicle', () => {
    it('should create vehicle with valid data', async () => {
      const vehicleData = {
        code: 'VEH001',
        type: 'forklift',
        model: 'Toyota 8FBE15U',
        manufacturer: 'Toyota',
        year: 2022,
        capacity: 1500,
        status: 'available',
      };
      
      const createdVehicle = { id: 1, ...vehicleData, createdBy: 1 };
      
      mockStorage.createVehicle.mockResolvedValue(createdVehicle);
      mockRequest.body = vehicleData;
      
      await controller.createVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.createVehicle).toHaveBeenCalledWith({
        ...vehicleData,
        createdBy: 1,
      });
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(createdVehicle);
    });

    it('should auto-generate code if not provided', async () => {
      const vehicleData = {
        type: 'forklift',
        model: 'Toyota 8FBE15U',
        manufacturer: 'Toyota',
        year: 2022,
        capacity: 1500,
      };
      
      const createdVehicle = { 
        id: 1, 
        ...vehicleData, 
        code: 'VEH0001',
        createdBy: 1 
      };
      
      mockStorage.createVehicle.mockResolvedValue(createdVehicle);
      mockRequest.body = vehicleData;
      
      await controller.createVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(createdVehicle.code).toMatch(/^VEH\d{4}$/);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing type, model, manufacturer
        capacity: 1500,
      };
      
      mockRequest.body = invalidData;
      
      await controller.createVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.createVehicle).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'type' }),
          expect.objectContaining({ field: 'model' }),
          expect.objectContaining({ field: 'manufacturer' }),
        ])
      });
    });

    it('should validate vehicle type', async () => {
      const invalidData = {
        type: 'invalid_type',
        model: 'Test Model',
        manufacturer: 'Test Manufacturer',
        capacity: 1500,
      };
      
      mockRequest.body = invalidData;
      
      await controller.createVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid vehicle type',
        validTypes: ['forklift', 'reach_truck', 'order_picker', 'pallet_jack', 'tugger']
      });
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle with valid data', async () => {
      const updateData = {
        status: 'maintenance',
        location: 'MAINTENANCE',
        batteryLevel: 0,
        maintenanceStatus: 'in_progress',
      };
      
      const updatedVehicle = { 
        id: 123, 
        ...generateMockVehicle(), 
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      
      mockStorage.updateVehicle.mockResolvedValue(updatedVehicle);
      mockRequest.params = { id: '123' };
      mockRequest.body = updateData;
      
      await controller.updateVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.updateVehicle).toHaveBeenCalledWith(123, updateData);
      expect(mockJson).toHaveBeenCalledWith(updatedVehicle);
    });

    it('should return 404 when vehicle not found', async () => {
      mockStorage.updateVehicle.mockResolvedValue(null);
      mockRequest.params = { id: '999' };
      mockRequest.body = { status: 'maintenance' };
      
      await controller.updateVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Vehicle not found' });
    });

    it('should validate status transitions', async () => {
      const invalidTransition = { status: 'available' }; // From maintenance to available without maintenance completion
      
      mockRequest.params = { id: '123' };
      mockRequest.body = invalidTransition;
      
      // Mock current vehicle status
      const currentVehicle = generateMockVehicle({ 
        status: 'maintenance',
        maintenanceStatus: 'in_progress'
      });
      mockStorage.getVehicle.mockResolvedValue(currentVehicle);
      
      await controller.updateVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid status transition',
        reason: 'Vehicle cannot be set to available while maintenance is in progress',
        current: 'maintenance',
        requested: 'available'
      });
    });
  });

  describe('Vehicle Assignment and Routing', () => {
    describe('assignVehicleToRoute', () => {
      it('should assign available vehicle to route', async () => {
        const assignmentData = {
          routeId: 'ROUTE123',
          operatorId: 1,
          estimatedDuration: 120, // minutes
          priority: 'high',
        };
        
        const assignment = {
          id: 1,
          vehicleId: 123,
          ...assignmentData,
          status: 'assigned',
          assignedAt: new Date().toISOString(),
        };
        
        mockStorage.assignVehicleToRoute.mockResolvedValue(assignment);
        mockRequest.params = { id: '123' };
        mockRequest.body = assignmentData;
        
        await controller.assignVehicleToRoute(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.assignVehicleToRoute).toHaveBeenCalledWith(123, assignmentData);
        expect(mockStatus).toHaveBeenCalledWith(201);
        expect(mockJson).toHaveBeenCalledWith(assignment);
      });

      it('should prevent assignment of unavailable vehicle', async () => {
        const assignmentData = {
          routeId: 'ROUTE123',
          operatorId: 1,
        };
        
        // Mock vehicle that's not available
        const busyVehicle = generateMockVehicle({ status: 'in_use' });
        mockStorage.getVehicle.mockResolvedValue(busyVehicle);
        
        mockRequest.params = { id: '123' };
        mockRequest.body = assignmentData;
        
        await controller.assignVehicleToRoute(mockRequest as Request, mockResponse as Response);
        
        expect(mockStatus).toHaveBeenCalledWith(409);
        expect(mockJson).toHaveBeenCalledWith({
          message: 'Vehicle is not available for assignment',
          currentStatus: 'in_use'
        });
      });
    });

    describe('getAvailableVehicles', () => {
      it('should return vehicles available for assignment', async () => {
        const availableVehicles = [
          generateMockVehicle({ status: 'available', batteryLevel: 80 }),
          generateMockVehicle({ status: 'available', batteryLevel: 90 }),
        ];
        
        mockStorage.getAvailableVehicles.mockResolvedValue(availableVehicles);
        mockRequest.query = { minBattery: '70' };
        
        await controller.getAvailableVehicles(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getAvailableVehicles).toHaveBeenCalledWith({
          minBattery: 70,
        });
        expect(mockJson).toHaveBeenCalledWith(availableVehicles);
      });

      it('should filter by capacity requirements', async () => {
        const suitableVehicles = [
          generateMockVehicle({ capacity: 2000 }),
          generateMockVehicle({ capacity: 1500 }),
        ];
        
        mockStorage.getAvailableVehicles.mockResolvedValue(suitableVehicles);
        mockRequest.query = { minCapacity: '1500' };
        
        await controller.getAvailableVehicles(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getAvailableVehicles).toHaveBeenCalledWith({
          minCapacity: 1500,
        });
      });
    });
  });

  describe('Vehicle Metrics and Analytics', () => {
    describe('getVehicleMetrics', () => {
      it('should return comprehensive vehicle metrics', async () => {
        const mockMetrics = {
          operationalMetrics: {
            totalOperatingHours: 1250,
            averageUtilization: 0.75,
            totalTrips: 150,
            averageTripDuration: 45, // minutes
          },
          maintenanceMetrics: {
            totalMaintenanceCost: 2500.00,
            averageDowntime: 8, // hours per maintenance
            maintenanceFrequency: 30, // days between maintenance
            nextMaintenanceIn: 15, // days
          },
          performanceMetrics: {
            fuelEfficiency: 8.5, // km per liter or kWh per hour
            averageSpeed: 12, // km/h
            productivityScore: 0.85,
          },
          batteryMetrics: {
            averageBatteryLife: 8, // hours
            chargeCycles: 125,
            batteryHealth: 0.92,
          }
        };
        
        mockStorage.getVehicleMetrics.mockResolvedValue(mockMetrics);
        mockRequest.params = { id: '123' };
        mockRequest.query = { period: '30d' };
        
        await controller.getVehicleMetrics(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getVehicleMetrics).toHaveBeenCalledWith(123, { period: '30d' });
        expect(mockJson).toHaveBeenCalledWith(mockMetrics);
      });

      it('should handle different time periods', async () => {
        const mockMetrics = { totalHours: 40 };
        
        mockStorage.getVehicleMetrics.mockResolvedValue(mockMetrics);
        mockRequest.params = { id: '123' };
        mockRequest.query = { period: '7d' };
        
        await controller.getVehicleMetrics(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getVehicleMetrics).toHaveBeenCalledWith(123, { period: '7d' });
      });
    });

    describe('getVehicleHistory', () => {
      it('should return paginated vehicle history', async () => {
        const mockHistory = {
          events: [
            { 
              id: 1, 
              vehicleId: 123, 
              event: 'maintenance_started', 
              timestamp: new Date().toISOString(),
              details: { reason: 'Scheduled maintenance' }
            },
            { 
              id: 2, 
              vehicleId: 123, 
              event: 'route_assigned', 
              timestamp: new Date().toISOString(),
              details: { routeId: 'ROUTE123', operatorId: 1 }
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
          }
        };
        
        mockStorage.getVehicleHistory.mockResolvedValue(mockHistory);
        mockRequest.params = { id: '123' };
        
        await controller.getVehicleHistory(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getVehicleHistory).toHaveBeenCalledWith(123, {
          page: 1,
          limit: 20,
        });
        expect(mockJson).toHaveBeenCalledWith(mockHistory);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle low battery warnings', async () => {
      const lowBatteryVehicle = generateMockVehicle({ batteryLevel: 15 });
      
      mockStorage.getVehicle.mockResolvedValue(lowBatteryVehicle);
      mockRequest.params = { id: '123' };
      
      await controller.getVehicleById(mockRequest as Request, mockResponse as Response);
      
      expect(mockJson).toHaveBeenCalledWith({
        ...lowBatteryVehicle,
        warnings: ['Low battery level - charging recommended']
      });
    });

    it('should handle overdue maintenance', async () => {
      const overdueVehicle = generateMockVehicle({ 
        nextMaintenanceDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        maintenanceStatus: 'overdue'
      });
      
      mockStorage.getVehicle.mockResolvedValue(overdueVehicle);
      mockRequest.params = { id: '123' };
      
      await controller.getVehicleById(mockRequest as Request, mockResponse as Response);
      
      expect(mockJson).toHaveBeenCalledWith({
        ...overdueVehicle,
        warnings: ['Maintenance overdue - immediate attention required']
      });
    });

    it('should handle concurrent vehicle assignments', async () => {
      const concurrencyError = new Error('Vehicle already assigned');
      concurrencyError.name = 'ConcurrencyError';
      
      mockStorage.assignVehicleToRoute.mockRejectedValue(concurrencyError);
      mockRequest.params = { id: '123' };
      mockRequest.body = { routeId: 'ROUTE123', operatorId: 1 };
      
      await controller.assignVehicleToRoute(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith({ 
        message: 'Vehicle was assigned by another user. Please refresh and try again.' 
      });
    });

    it('should handle invalid capacity values', async () => {
      const invalidData = {
        type: 'forklift',
        model: 'Test',
        manufacturer: 'Test',
        capacity: -100, // Invalid negative capacity
      };
      
      mockRequest.body = invalidData;
      
      await controller.createVehicle(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'capacity',
            message: 'Capacity must be a positive number'
          })
        ])
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle fleet status checks efficiently', async () => {
      const largeFleet = Array.from({ length: 100 }, () => generateMockVehicle());
      
      mockStorage.getVehicles.mockResolvedValue(largeFleet);
      
      const start = performance.now();
      await controller.getVehicles(mockRequest as Request, mockResponse as Response);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(mockJson).toHaveBeenCalledWith(largeFleet);
    });

    it('should handle real-time status updates', async () => {
      const statusUpdates = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        status: ['available', 'in_use', 'maintenance'][i % 3],
        batteryLevel: Math.floor(Math.random() * 100),
        location: `A-${String(Math.floor(i / 10) + 1).padStart(2, '0')}-${String((i % 10) + 1).padStart(2, '0')}`,
      }));
      
      for (const update of statusUpdates) {
        mockStorage.updateVehicle.mockResolvedValue({ 
          ...generateMockVehicle(), 
          ...update 
        });
        
        mockRequest.params = { id: update.id.toString() };
        mockRequest.body = update;
        
        await controller.updateVehicle(mockRequest as Request, mockResponse as Response);
      }
      
      expect(mockStorage.updateVehicle).toHaveBeenCalledTimes(50);
    });
  });
});