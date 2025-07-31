import { Request, Response } from 'express';
import { db } from '../db.js';
import { 
  transferRequests, 
  transferRequestItems,
  vehicles,
  products,
  users,
  insertTransferRequestSchema,
  insertTransferRequestItemSchema
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import logger from '../utils/logger.js';

// Função para gerar código único do pedido de transferência
function generateTransferRequestCode(): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = today.getTime().toString().slice(-4);
  return `TR-${dateStr}-${timeStr}`;
}

// Função para calcular cubagem baseada nas dimensões do produto
function calculateCubicVolume(dimensions: any, quantity: number): number {
  if (!dimensions || !dimensions.length || !dimensions.width || !dimensions.height) {
    return 0;
  }
  
  // Converter cm para metros e calcular m³
  const volumeM3 = (dimensions.length / 100) * (dimensions.width / 100) * (dimensions.height / 100);
  return volumeM3 * quantity;
}

export const transferRequestsController = {
  // GET /api/transfer-requests - Listar pedidos de transferência
  async getAllTransferRequests(req: Request, res: Response) {
    try {
      const { status, vehicleId } = req.query;
      
      // Build WHERE conditions
      const conditions = [];
      if (status) {
        conditions.push(eq(transferRequests.status, status as string));
      }
      if (vehicleId) {
        conditions.push(eq(transferRequests.vehicleId, parseInt(vehicleId as string)));
      }
      
      const query = db.select({
        id: transferRequests.id,
        code: transferRequests.code,
        status: transferRequests.status,
        fromLocation: transferRequests.fromLocation,
        toLocation: transferRequests.toLocation,
        totalCubicVolume: transferRequests.totalCubicVolume,
        effectiveCapacity: transferRequests.effectiveCapacity,
        capacityUsagePercent: transferRequests.capacityUsagePercent,
        createdAt: transferRequests.createdAt,
        updatedAt: transferRequests.updatedAt,
        vehicleName: vehicles.name,
        vehicleCode: vehicles.code,
        createdByName: users.firstName
      })
      .from(transferRequests)
      .leftJoin(vehicles, eq(transferRequests.vehicleId, vehicles.id))
      .leftJoin(users, eq(transferRequests.createdBy, users.id));
      
      const baseQuery = conditions.length > 0 
        ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : query;
      
      const requests = await baseQuery.orderBy(desc(transferRequests.createdAt));
      
      logger.info(`Retrieved ${requests.length} transfer requests`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(requests);
    } catch (error) {
      logger.error('Error fetching transfer requests:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/transfer-requests/:id - Buscar pedido por ID com itens
  async getTransferRequestById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Buscar o pedido principal
      const [request] = await db.select({
        id: transferRequests.id,
        code: transferRequests.code,
        status: transferRequests.status,
        fromLocation: transferRequests.fromLocation,
        toLocation: transferRequests.toLocation,
        totalCubicVolume: transferRequests.totalCubicVolume,
        effectiveCapacity: transferRequests.effectiveCapacity,
        capacityUsagePercent: transferRequests.capacityUsagePercent,
        notes: transferRequests.notes,
        createdAt: transferRequests.createdAt,
        updatedAt: transferRequests.updatedAt,
        vehicleId: transferRequests.vehicleId,
        vehicleName: vehicles.name,
        vehicleCode: vehicles.code,
        vehicleCubicCapacity: vehicles.cubicCapacity,
        createdByName: users.firstName
      })
      .from(transferRequests)
      .leftJoin(vehicles, eq(transferRequests.vehicleId, vehicles.id))
      .leftJoin(users, eq(transferRequests.createdBy, users.id))
      .where(eq(transferRequests.id, parseInt(id)))
      .limit(1);
      
      if (!request) {
        return res.status(404).json({ error: 'Pedido de transferência não encontrado' });
      }
      
      // Buscar os itens do pedido
      const items = await db.select({
        id: transferRequestItems.id,
        productId: transferRequestItems.productId,
        quantity: transferRequestItems.quantity,
        unitCubicVolume: transferRequestItems.unitCubicVolume,
        totalCubicVolume: transferRequestItems.totalCubicVolume,
        notes: transferRequestItems.notes,
        addedAt: transferRequestItems.addedAt,
        productName: products.name,
        productSku: products.sku,
        productDimensions: products.dimensions
      })
      .from(transferRequestItems)
      .leftJoin(products, eq(transferRequestItems.productId, products.id))
      .where(eq(transferRequestItems.transferRequestId, parseInt(id)))
      .orderBy(transferRequestItems.addedAt);
      
      const result = {
        ...request,
        items
      };
      
      logger.info(`Retrieved transfer request by ID: ${id}`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Error fetching transfer request by ID:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/transfer-requests - Criar novo pedido de transferência
  async createTransferRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { vehicleId, fromLocation, toLocation, notes } = req.body;
      
      // Buscar dados do veículo para calcular capacidade efetiva
      const vehicle = await db.select()
        .from(vehicles)
        .where(eq(vehicles.id, vehicleId))
        .limit(1);
      
      if (vehicle.length === 0) {
        return res.status(400).json({ error: 'Veículo não encontrado' });
      }
      
      // Calcular capacidade efetiva (90% da capacidade total)
      const effectiveCapacity = parseFloat(vehicle[0].cubicCapacity) * 0.9;
      
      const transferData = {
        code: generateTransferRequestCode(),
        vehicleId,
        fromLocation,
        toLocation,
        effectiveCapacity: effectiveCapacity.toString(),
        notes,
        createdBy: req.user!.id
      };
      
      const validatedData = insertTransferRequestSchema.parse(transferData);
      
      const [newRequest] = await db.insert(transferRequests)
        .values(validatedData)
        .returning();
      
      logger.info(`Transfer request created: ${newRequest.code}`, { 
        userId: req.user!.id,
        transferRequestId: newRequest.id 
      });
      
      res.status(201).json(newRequest);
    } catch (error) {
      logger.error('Error creating transfer request:', error);
      
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: 'Dados inválidos', details: error });
      }
      
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/transfer-requests/:id/items - Adicionar item ao pedido
  async addItemToRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { productId, quantity, notes } = req.body;
      
      // Verificar se o pedido existe e está em status de planejamento
      const [request] = await db.select()
        .from(transferRequests)
        .where(eq(transferRequests.id, parseInt(id)))
        .limit(1);
      
      if (!request) {
        return res.status(404).json({ error: 'Pedido de transferência não encontrado' });
      }
      
      if (request.status !== 'planejamento') {
        return res.status(400).json({ error: 'Só é possível adicionar itens em pedidos em planejamento' });
      }
      
      // Buscar dados do produto para calcular cubagem
      const [product] = await db.select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      
      if (!product) {
        return res.status(400).json({ error: 'Produto não encontrado' });
      }
      
      // Calcular cubagem do item
      const quantityNum = parseFloat(quantity);
      const unitCubicVolume = calculateCubicVolume(product.dimensions, 1);
      const totalCubicVolume = calculateCubicVolume(product.dimensions, quantityNum);
      
      const itemData = {
        transferRequestId: parseInt(id),
        productId,
        quantity,
        unitCubicVolume: unitCubicVolume.toString(),
        totalCubicVolume: totalCubicVolume.toString(),
        notes,
        addedBy: req.user!.id
      };
      
      const validatedData = insertTransferRequestItemSchema.parse(itemData);
      
      const [newItem] = await db.insert(transferRequestItems)
        .values(validatedData)
        .returning();
      
      // Recalcular cubagem total do pedido
      await transferRequestsController.recalculateRequestTotals(parseInt(id));
      
      logger.info(`Item added to transfer request: ${request.code}`, { 
        userId: req.user!.id,
        transferRequestId: parseInt(id),
        productId 
      });
      
      res.status(201).json(newItem);
    } catch (error) {
      logger.error('Error adding item to transfer request:', error);
      
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: 'Dados inválidos', details: error });
      }
      
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // DELETE /api/transfer-requests/:id/items/:itemId - Remover item do pedido
  async removeItemFromRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      
      // Verificar se o pedido está em planejamento
      const [request] = await db.select()
        .from(transferRequests)
        .where(eq(transferRequests.id, parseInt(id)))
        .limit(1);
      
      if (!request) {
        return res.status(404).json({ error: 'Pedido de transferência não encontrado' });
      }
      
      if (request.status !== 'planejamento') {
        return res.status(400).json({ error: 'Só é possível remover itens de pedidos em planejamento' });
      }
      
      // Remover o item
      const deletedItems = await db.delete(transferRequestItems)
        .where(and(
          eq(transferRequestItems.id, parseInt(itemId)),
          eq(transferRequestItems.transferRequestId, parseInt(id))
        ))
        .returning();
      
      if (deletedItems.length === 0) {
        return res.status(404).json({ error: 'Item não encontrado no pedido' });
      }
      
      // Recalcular cubagem total do pedido
      await transferRequestsController.recalculateRequestTotals(parseInt(id));
      
      logger.info(`Item removed from transfer request: ${request.code}`, { 
        userId: req.user!.id,
        transferRequestId: parseInt(id),
        itemId: parseInt(itemId)
      });
      
      res.json({ message: 'Item removido com sucesso' });
    } catch (error) {
      logger.error('Error removing item from transfer request:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/transfer-requests/:id/status - Atualizar status do pedido
  async updateRequestStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      const validStatuses = ['planejamento', 'aprovado', 'carregamento', 'transito', 'finalizado', 'cancelado'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      
      const updateData: any = { 
        status, 
        updatedAt: new Date() 
      };
      
      if (notes) {
        updateData.notes = notes;
      }
      
      // Se aprovando, definir quem aprovou
      if (status === 'aprovado') {
        updateData.approvedBy = req.user!.id;
        updateData.approvedAt = new Date();
      }
      
      const [updatedRequest] = await db.update(transferRequests)
        .set(updateData)
        .where(eq(transferRequests.id, parseInt(id)))
        .returning();
      
      if (!updatedRequest) {
        return res.status(404).json({ error: 'Pedido de transferência não encontrado' });
      }
      
      logger.info(`Transfer request status updated: ${updatedRequest.code} -> ${status}`, { 
        userId: req.user!.id,
        transferRequestId: parseInt(id)
      });
      
      res.json(updatedRequest);
    } catch (error) {
      logger.error('Error updating transfer request status:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // Função auxiliar para recalcular totais do pedido
  async recalculateRequestTotals(requestId: number) {
    try {
      // Somar cubagem total de todos os itens
      const items = await db.select()
        .from(transferRequestItems)
        .where(eq(transferRequestItems.transferRequestId, requestId));
      
      const totalCubicVolume = items.reduce((sum, item) => {
        return sum + parseFloat(item.totalCubicVolume || '0');
      }, 0);
      
      // Buscar capacidade efetiva do pedido
      const [request] = await db.select()
        .from(transferRequests)
        .where(eq(transferRequests.id, requestId))
        .limit(1);
      
      if (request) {
        const effectiveCapacity = parseFloat(request.effectiveCapacity || '0');
        const capacityUsagePercent = effectiveCapacity > 0 ? (totalCubicVolume / effectiveCapacity) * 100 : 0;
        
        await db.update(transferRequests)
          .set({
            totalCubicVolume: totalCubicVolume.toString(),
            capacityUsagePercent: capacityUsagePercent.toString(),
            updatedAt: new Date()
          })
          .where(eq(transferRequests.id, requestId));
      }
    } catch (error) {
      logger.error('Error recalculating request totals:', error);
    }
  }
};