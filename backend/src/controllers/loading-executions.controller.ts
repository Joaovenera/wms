import { Request, Response } from 'express';
import { db } from '../db.js';
import { 
  loadingExecutions,
  loadingItems,
  transferRequests,
  transferRequestItems,
  products,
  users,
  insertLoadingExecutionSchema,
  insertLoadingItemSchema
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import logger from '../utils/logger.js';

export const loadingExecutionsController = {
  // GET /api/loading-executions - Listar execuções de carregamento
  async getAllLoadingExecutions(req: Request, res: Response) {
    try {
      const { status, transferRequestId } = req.query;
      
      let query = db.select({
        id: loadingExecutions.id,
        status: loadingExecutions.status,
        startedAt: loadingExecutions.startedAt,
        finishedAt: loadingExecutions.finishedAt,
        observations: loadingExecutions.observations,
        transferRequestId: loadingExecutions.transferRequestId,
        transferRequestCode: transferRequests.code,
        operatorName: users.firstName
      })
      .from(loadingExecutions)
      .leftJoin(transferRequests, eq(loadingExecutions.transferRequestId, transferRequests.id))
      .leftJoin(users, eq(loadingExecutions.operatorId, users.id));
      
      if (status) {
        query = query.where(eq(loadingExecutions.status, status as string));
      }
      
      if (transferRequestId) {
        query = query.where(eq(loadingExecutions.transferRequestId, parseInt(transferRequestId as string)));
      }
      
      const executions = await query.orderBy(desc(loadingExecutions.startedAt));
      
      logger.info(`Retrieved ${executions.length} loading executions`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(executions);
    } catch (error) {
      logger.error('Error fetching loading executions:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/loading-executions/:id - Buscar execução por ID com itens
  async getLoadingExecutionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Buscar a execução principal
      const [execution] = await db.select({
        id: loadingExecutions.id,
        status: loadingExecutions.status,
        startedAt: loadingExecutions.startedAt,
        finishedAt: loadingExecutions.finishedAt,
        observations: loadingExecutions.observations,
        transferRequestId: loadingExecutions.transferRequestId,
        transferRequestCode: transferRequests.code,
        operatorId: loadingExecutions.operatorId,
        operatorName: users.firstName
      })
      .from(loadingExecutions)
      .leftJoin(transferRequests, eq(loadingExecutions.transferRequestId, transferRequests.id))
      .leftJoin(users, eq(loadingExecutions.operatorId, users.id))
      .where(eq(loadingExecutions.id, parseInt(id)))
      .limit(1);
      
      if (!execution) {
        return res.status(404).json({ error: 'Execução de carregamento não encontrada' });
      }
      
      // Buscar os itens da execução
      const items = await db.select({
        id: loadingItems.id,
        transferRequestItemId: loadingItems.transferRequestItemId,
        productId: loadingItems.productId,
        requestedQuantity: loadingItems.requestedQuantity,
        loadedQuantity: loadingItems.loadedQuantity,
        notLoadedQuantity: loadingItems.notLoadedQuantity,
        divergenceReason: loadingItems.divergenceReason,
        divergenceComments: loadingItems.divergenceComments,
        scannedAt: loadingItems.scannedAt,
        confirmedAt: loadingItems.confirmedAt,
        productName: products.name,
        productSku: products.sku
      })
      .from(loadingItems)
      .leftJoin(products, eq(loadingItems.productId, products.id))
      .where(eq(loadingItems.loadingExecutionId, parseInt(id)))
      .orderBy(loadingItems.scannedAt);
      
      const result = {
        ...execution,
        items
      };
      
      logger.info(`Retrieved loading execution by ID: ${id}`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Error fetching loading execution by ID:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/loading-executions - Iniciar nova execução de carregamento
  async startLoadingExecution(req: AuthenticatedRequest, res: Response) {
    try {
      const { transferRequestId, observations } = req.body;
      
      // Verificar se o pedido existe e está aprovado
      const [transferRequest] = await db.select()
        .from(transferRequests)
        .where(eq(transferRequests.id, transferRequestId))
        .limit(1);
      
      if (!transferRequest) {
        return res.status(400).json({ error: 'Pedido de transferência não encontrado' });
      }
      
      if (transferRequest.status !== 'aprovado') {
        return res.status(400).json({ error: 'Só é possível carregar pedidos aprovados' });
      }
      
      // Verificar se já existe execução para este pedido
      const [existingExecution] = await db.select()
        .from(loadingExecutions)
        .where(eq(loadingExecutions.transferRequestId, transferRequestId))
        .limit(1);
      
      if (existingExecution) {
        return res.status(400).json({ error: 'Já existe uma execução de carregamento para este pedido' });
      }
      
      const executionData = {
        transferRequestId,
        operatorId: req.user!.id,
        observations
      };
      
      const validatedData = insertLoadingExecutionSchema.parse(executionData);
      
      const [newExecution] = await db.insert(loadingExecutions)
        .values(validatedData)
        .returning();
      
      // Atualizar status do pedido para "carregamento"
      await db.update(transferRequests)
        .set({ 
          status: 'carregamento',
          updatedAt: new Date()
        })
        .where(eq(transferRequests.id, transferRequestId));
      
      // Criar registros de itens a serem carregados
      const requestItems = await db.select()
        .from(transferRequestItems)
        .where(eq(transferRequestItems.transferRequestId, transferRequestId));
      
      for (const item of requestItems) {
        await db.insert(loadingItems).values({
          loadingExecutionId: newExecution.id,
          transferRequestItemId: item.id,
          productId: item.productId,
          requestedQuantity: item.quantity,
          loadedQuantity: '0',
          notLoadedQuantity: item.quantity
        });
      }
      
      logger.info(`Loading execution started for transfer request: ${transferRequest.code}`, { 
        userId: req.user!.id,
        loadingExecutionId: newExecution.id,
        transferRequestId
      });
      
      res.status(201).json(newExecution);
    } catch (error) {
      logger.error('Error starting loading execution:', error);
      
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ error: 'Dados inválidos', details: error });
      }
      
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/loading-executions/:id/scan-item - Confirmar item carregado via scanner
  async scanAndConfirmItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { productId, quantity, scannedCode } = req.body;
      
      // Verificar se a execução existe e está em andamento
      const [execution] = await db.select()
        .from(loadingExecutions)
        .where(eq(loadingExecutions.id, parseInt(id)))
        .limit(1);
      
      if (!execution) {
        return res.status(404).json({ error: 'Execução de carregamento não encontrada' });
      }
      
      if (execution.status !== 'em_andamento') {
        return res.status(400).json({ error: 'Execução não está em andamento' });
      }
      
      // Buscar o item a ser carregado
      const [loadingItem] = await db.select()
        .from(loadingItems)
        .where(and(
          eq(loadingItems.loadingExecutionId, parseInt(id)),
          eq(loadingItems.productId, productId)
        ))
        .limit(1);
      
      if (!loadingItem) {
        return res.status(400).json({ error: 'Item não encontrado na lista de carregamento' });
      }
      
      const quantityNum = parseFloat(quantity);
      const currentLoaded = parseFloat(loadingItem.loadedQuantity);
      const requested = parseFloat(loadingItem.requestedQuantity);
      
      // Verificar se não excede a quantidade solicitada
      if (currentLoaded + quantityNum > requested) {
        return res.status(400).json({ 
          error: 'Quantidade excede o solicitado',
          requested,
          currentLoaded,
          attempting: quantityNum
        });
      }
      
      const newLoadedQuantity = currentLoaded + quantityNum;
      const newNotLoadedQuantity = requested - newLoadedQuantity;
      
      // Atualizar o item
      const [updatedItem] = await db.update(loadingItems)
        .set({
          loadedQuantity: newLoadedQuantity.toString(),
          notLoadedQuantity: newNotLoadedQuantity.toString(),
          scannedAt: new Date(),
          confirmedBy: req.user!.id,
          confirmedAt: new Date()
        })
        .where(eq(loadingItems.id, loadingItem.id))
        .returning();
      
      logger.info(`Item scanned and confirmed in loading execution`, { 
        userId: req.user!.id,
        loadingExecutionId: parseInt(id),
        productId,
        quantity: quantityNum,
        scannedCode
      });
      
      res.json(updatedItem);
    } catch (error) {
      logger.error('Error scanning and confirming item:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/loading-executions/:id/items/:itemId/divergence - Registrar divergência
  async registerDivergence(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      const { divergenceReason, divergenceComments } = req.body;
      
      const validReasons = ['falta_espaco', 'item_avariado', 'divergencia_estoque', 'item_nao_localizado'];
      
      if (!validReasons.includes(divergenceReason)) {
        return res.status(400).json({ error: 'Motivo de divergência inválido' });
      }
      
      const [updatedItem] = await db.update(loadingItems)
        .set({
          divergenceReason,
          divergenceComments,
          confirmedBy: req.user!.id,
          confirmedAt: new Date()
        })
        .where(and(
          eq(loadingItems.id, parseInt(itemId)),
          eq(loadingItems.loadingExecutionId, parseInt(id))
        ))
        .returning();
      
      if (!updatedItem) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }
      
      logger.info(`Divergence registered for loading item`, { 
        userId: req.user!.id,
        loadingExecutionId: parseInt(id),
        itemId: parseInt(itemId),
        divergenceReason,
        divergenceComments
      });
      
      res.json(updatedItem);
    } catch (error) {
      logger.error('Error registering divergence:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/loading-executions/:id/finish - Finalizar execução de carregamento
  async finishLoadingExecution(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { observations } = req.body;
      
      // Verificar se todos os itens foram processados (carregados ou justificados)
      const pendingItems = await db.select()
        .from(loadingItems)
        .where(and(
          eq(loadingItems.loadingExecutionId, parseInt(id)),
          eq(loadingItems.confirmedAt, null)
        ));
      
      if (pendingItems.length > 0) {
        return res.status(400).json({ 
          error: 'Existem itens pendentes de confirmação',
          pendingCount: pendingItems.length
        });
      }
      
      const [finishedExecution] = await db.update(loadingExecutions)
        .set({
          status: 'finalizado',
          finishedAt: new Date(),
          observations
        })
        .where(eq(loadingExecutions.id, parseInt(id)))
        .returning();
      
      if (!finishedExecution) {
        return res.status(404).json({ error: 'Execução não encontrada' });
      }
      
      // Atualizar status do pedido de transferência para "transito"
      await db.update(transferRequests)
        .set({ 
          status: 'transito',
          updatedAt: new Date()
        })
        .where(eq(transferRequests.id, finishedExecution.transferRequestId));
      
      logger.info('Loading execution finished', { 
        userId: req.user!.id,
        loadingExecutionId: parseInt(id)
      });
      
      res.json(finishedExecution);
    } catch (error) {
      logger.error('Error finishing loading execution:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/loading-executions/pending - Listar execuções pendentes
  async getPendingExecutions(req: Request, res: Response) {
    try {
      const pendingExecutions = await db.select({
        id: loadingExecutions.id,
        status: loadingExecutions.status,
        startedAt: loadingExecutions.startedAt,
        transferRequestId: loadingExecutions.transferRequestId,
        transferRequestCode: transferRequests.code,
        operatorName: users.firstName
      })
      .from(loadingExecutions)
      .leftJoin(transferRequests, eq(loadingExecutions.transferRequestId, transferRequests.id))
      .leftJoin(users, eq(loadingExecutions.operatorId, users.id))
      .where(eq(loadingExecutions.status, 'em_andamento'))
      .orderBy(loadingExecutions.startedAt);
      
      logger.info(`Retrieved ${pendingExecutions.length} pending loading executions`, { 
        userId: (req as AuthenticatedRequest).user?.id 
      });
      
      res.json(pendingExecutions);
    } catch (error) {
      logger.error('Error fetching pending loading executions:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};