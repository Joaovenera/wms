import { Request, Response } from 'express';
import { db } from '../db.js';
import { vehicles, insertVehicleSchema } from '../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import logger from '../utils/logger.js';

export const vehiclesController = {
  // GET /api/vehicles - Listar todos os veículos
  async getAllVehicles(req: Request, res: Response) {
    try {
      const { status, includeInactive } = req.query;
      
      // Build WHERE conditions
      const conditions = [];
      
      if (status) {
        conditions.push(eq(vehicles.status, status as string));
      } else if (!includeInactive) {
        conditions.push(eq(vehicles.isActive, true));
      }
      
      const query = db.select().from(vehicles);
      
      const baseQuery = conditions.length > 0 
        ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : query;
      
      const vehiclesList = await baseQuery.orderBy(vehicles.createdAt);
      
      logger.info(`Retrieved ${vehiclesList.length} vehicles`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(vehiclesList);
    } catch (error) {
      logger.error('Error fetching vehicles:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/vehicles/:id - Buscar veículo por ID
  async getVehicleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const vehicle = await db.select()
        .from(vehicles)
        .where(eq(vehicles.id, parseInt(id)))
        .limit(1);
      
      if (vehicle.length === 0) {
        return res.status(404).json({ error: 'Veículo não encontrado' });
      }
      
      logger.info(`Retrieved vehicle by ID: ${id}`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(vehicle[0]);
    } catch (error) {
      logger.error('Error fetching vehicle by ID:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/vehicles - Criar novo veículo
  async createVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      // Calcular cubicCapacity automaticamente a partir das dimensões
      const { cargoAreaLength, cargoAreaWidth, cargoAreaHeight } = req.body;
      const lengthNum = Number(cargoAreaLength);
      const widthNum = Number(cargoAreaWidth);
      const heightNum = Number(cargoAreaHeight);
      const calculatedCubicCapacity = Number.isFinite(lengthNum) && Number.isFinite(widthNum) && Number.isFinite(heightNum)
        ? (lengthNum * widthNum * heightNum).toString()
        : '0';

      const validatedData = insertVehicleSchema.parse({
        ...req.body,
        cubicCapacity: calculatedCubicCapacity,
        createdBy: req.user!.id
      });
      
      // Verificar se já existe veículo com esse código
      const existingVehicle = await db.select()
        .from(vehicles)
        .where(eq(vehicles.code, validatedData.code))
        .limit(1);
      
      if (existingVehicle.length > 0) {
        return res.status(400).json({ error: 'Já existe um veículo com este código' });
      }

      // Verificar se já existe veículo com essa placa
      const existingLicensePlate = await db.select()
        .from(vehicles)
        .where(eq(vehicles.licensePlate, validatedData.licensePlate))
        .limit(1);
      
      if (existingLicensePlate.length > 0) {
        return res.status(400).json({ error: 'Já existe um veículo com esta placa' });
      }
      
      const [newVehicle] = await db.insert(vehicles)
        .values({
          ...validatedData,
          cargoAreaLength: String(validatedData.cargoAreaLength),
          cargoAreaWidth: String(validatedData.cargoAreaWidth),
          cargoAreaHeight: String(validatedData.cargoAreaHeight),
        })
        .returning();
      
      logger.info(`Vehicle created: ${newVehicle.code}`, { 
        userId: req.user!.id,
        vehicleId: newVehicle.id 
      });
      
      res.status(201).json(newVehicle);
    } catch (error) {
      logger.error('Error creating vehicle:', error);
      
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: 'Dados inválidos', details: error });
      }
      
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/vehicles/:id - Atualizar veículo
  async updateVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const vehicleId = parseInt(id);
      
      // Verificar se o veículo existe
      const existingVehicle = await db.select()
        .from(vehicles)
        .where(eq(vehicles.id, vehicleId))
        .limit(1);
      
      if (existingVehicle.length === 0) {
        return res.status(404).json({ error: 'Veículo não encontrado' });
      }
      
      // Verificar se outro veículo já usa este código (se foi alterado)
      if (req.body.code && req.body.code !== existingVehicle[0].code) {
        const codeCheck = await db.select()
          .from(vehicles)
          .where(and(
            eq(vehicles.code, req.body.code),
            ne(vehicles.id, vehicleId)
          ))
          .limit(1);
        
        if (codeCheck.length > 0) {
          return res.status(400).json({ error: 'Já existe outro veículo com este código' });
        }
      }

      // Verificar se outro veículo já usa esta placa (se foi alterada)
      if (req.body.licensePlate && req.body.licensePlate !== existingVehicle[0].licensePlate) {
        const plateCheck = await db.select()
          .from(vehicles)
          .where(and(
            eq(vehicles.licensePlate, req.body.licensePlate),
            ne(vehicles.id, vehicleId)
          ))
          .limit(1);
        
        if (plateCheck.length > 0) {
          return res.status(400).json({ error: 'Já existe outro veículo com esta placa' });
        }
      }

      // Calcular cubicCapacity se as dimensões foram fornecidas
      let calculatedCubicCapacity = existingVehicle[0].cubicCapacity;
      const { cargoAreaLength, cargoAreaWidth, cargoAreaHeight } = req.body;
      
      if (cargoAreaLength || cargoAreaWidth || cargoAreaHeight) {
        const length = cargoAreaLength || existingVehicle[0].cargoAreaLength;
        const width = cargoAreaWidth || existingVehicle[0].cargoAreaWidth;
        const height = cargoAreaHeight || existingVehicle[0].cargoAreaHeight;
        
        calculatedCubicCapacity = (parseFloat(length) * parseFloat(width) * parseFloat(height)).toString();
      }
      
      const updateData = {
        ...req.body,
        cubicCapacity: calculatedCubicCapacity,
        updatedAt: new Date()
      };
      
      const [updatedVehicle] = await db.update(vehicles)
        .set(updateData)
        .where(eq(vehicles.id, vehicleId))
        .returning();
      
      logger.info(`Vehicle updated: ${updatedVehicle.code}`, { 
        userId: req.user!.id,
        vehicleId: updatedVehicle.id 
      });
      
      res.json(updatedVehicle);
    } catch (error) {
      logger.error('Error updating vehicle:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // DELETE /api/vehicles/:id - Desativar veículo (soft delete)
  async deactivateVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const vehicleId = parseInt(id);
      
      const [deactivatedVehicle] = await db.update(vehicles)
        .set({ 
          isActive: false, 
          status: 'inativo',
          updatedAt: new Date() 
        })
        .where(eq(vehicles.id, vehicleId))
        .returning();
      
      if (!deactivatedVehicle) {
        return res.status(404).json({ error: 'Veículo não encontrado' });
      }
      
      logger.info(`Vehicle deactivated: ${deactivatedVehicle.code}`, { 
        userId: req.user!.id,
        vehicleId: deactivatedVehicle.id 
      });
      
      res.json({ message: 'Veículo desativado com sucesso', vehicle: deactivatedVehicle });
    } catch (error) {
      logger.error('Error deactivating vehicle:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/vehicles/available - Listar veículos disponíveis para transferência
  async getAvailableVehicles(req: Request, res: Response) {
    try {
      const availableVehicles = await db.select()
        .from(vehicles)
        .where(and(
          eq(vehicles.isActive, true),
          eq(vehicles.status, 'disponivel')
        ))
        .orderBy(vehicles.name);
      
      logger.info(`Retrieved ${availableVehicles.length} available vehicles`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(availableVehicles);
    } catch (error) {
      logger.error('Error fetching available vehicles:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};