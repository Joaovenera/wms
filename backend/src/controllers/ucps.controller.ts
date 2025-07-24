import { Request, Response } from "express";
import { storage } from "../storage";
import { insertUcpSchema, insertUcpItemSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";
import { logError, logInfo, logWarn } from "../utils/logger";

export class UcpsController {
  async getUcps(req: Request, res: Response) {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      
      logInfo('Fetching UCPs', { 
        userId: (req as any).user?.id,
        includeArchived 
      });
      
      const ucps = await storage.getUcps(includeArchived);
      res.json(ucps);
    } catch (error) {
      logError("Error fetching UCPs", error as Error);
      res.status(500).json({ message: "Failed to fetch UCPs" });
    }
  }

  async getUcpStats(req: Request, res: Response) {
    try {
      const activeUcps = await storage.getUcps(false);
      const archivedUcps = await storage.getArchivedUcps();
      
      const stats = {
        total: activeUcps.length + archivedUcps.length,
        active: activeUcps.filter(u => u.status === 'active').length,
        empty: activeUcps.filter(u => u.status === 'empty').length,
        archived: archivedUcps.length,
      };
      
      res.json(stats);
    } catch (error) {
      logError("Error fetching UCP stats", error as Error);
      res.status(500).json({ message: "Failed to fetch UCP stats" });
    }
  }

  async getAvailableUcps(req: Request, res: Response) {
    try {
      const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
      const availableUcps = await storage.getAvailableUcpsForProduct(productId);
      res.json(availableUcps);
    } catch (error) {
      logError("Error fetching available UCPs", error as Error);
      res.status(500).json({ message: "Failed to fetch available UCPs" });
    }
  }

  async getAvailableUcpsForTransfer(req: Request, res: Response) {
    try {
      // This endpoint should return all active and empty UCPs that can receive items.
      // The getUcps(false) method already provides this logic.
      const ucps = await storage.getUcps(false);
      res.json(ucps);
    } catch (error) {
      logError("Error fetching available UCPs for transfer", error as Error);
      res.status(500).json({ message: "Failed to fetch available UCPs for transfer" });
    }
  }

  async getUcpById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      logInfo('Fetching UCP by ID', { 
        userId: (req as any).user?.id,
        ucpId: id 
      });
      
      const ucp = await storage.getUcp(id);
      if (!ucp) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json(ucp);
    } catch (error) {
      logError("Error fetching UCP", error as Error);
      res.status(500).json({ message: "Failed to fetch UCP" });
    }
  }

  async getUcpByCode(req: Request, res: Response) {
    try {
      const code = req.params.code;
      
      logInfo('Fetching UCP by code', { 
        userId: (req as any).user?.id,
        ucpCode: code 
      });
      
      const ucp = await storage.getUcpByCode(code);
      if (!ucp) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json(ucp);
    } catch (error) {
      logError("Error fetching UCP by code", error as Error);
      res.status(500).json({ message: "Failed to fetch UCP" });
    }
  }

  async createComprehensiveUcp(req: Request, res: Response) {
    try {
      const { ucp, items } = req.body;
      
      logInfo('Creating comprehensive UCP', {
        userId: (req as any).user?.id,
        ucpData: ucp,
        itemsCount: items?.length || 0
      });
      
      const ucpResult = insertUcpSchema.safeParse({
        ...ucp,
        createdBy: (req as any).user.id,
      });
      
      if (!ucpResult.success) {
        logWarn('UCP validation failed', { error: ucpResult.error });
        const validationError = fromZodError(ucpResult.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Generate UCP code if not provided
      if (!ucpResult.data.code) {
        ucpResult.data.code = await storage.getNextUcpCode();
      }

      // Create UCP with full history tracking
      const newUcp = await storage.createUcpWithHistory(ucpResult.data, (req as any).user.id);
      
      // Add items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          const itemData = {
            ucpId: newUcp.id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            lot: item.lot || null,
            expiryDate: item.expiryDate || null,
            internalCode: item.internalCode || null,
            addedBy: (req as any).user.id,
          };
          
          const itemResult = insertUcpItemSchema.safeParse(itemData);
          
          if (itemResult.success) {
            await storage.addUcpItem(itemResult.data, (req as any).user.id);
          } else {
            logWarn('Item validation failed', { itemData, error: itemResult.error });
          }
        }
      }

      res.status(201).json(newUcp);
    } catch (error) {
      logError("Error creating comprehensive UCP", error as Error);
      // Check if it's a position conflict error
      if (error instanceof Error && error.message.includes('already occupied')) {
        return res.status(409).json({ 
          message: error.message,
          code: 'POSITION_OCCUPIED'
        });
      }
      if (error instanceof Error && error.message.includes('not available')) {
        return res.status(409).json({ 
          message: error.message,
          code: 'POSITION_NOT_AVAILABLE'
        });
      }
      res.status(500).json({ message: "Failed to create UCP" });
    }
  }

  async createUcp(req: Request, res: Response) {
    try {
      const result = insertUcpSchema.safeParse({
        ...req.body,
        createdBy: (req as any).user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      logInfo('Creating UCP', { 
        userId: (req as any).user?.id,
        ucpData: result.data
      });

      const ucp = await storage.createUcp(result.data);
      res.status(201).json(ucp);
    } catch (error) {
      logError("Error creating UCP", error as Error);
      res.status(500).json({ message: "Failed to create UCP" });
    }
  }

  async updateUcp(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = insertUcpSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      // CRITICAL VALIDATION: Log position changes for audit
      if (result.data.positionId !== undefined) {
        logInfo('UCP position change detected', { 
          userId: (req as any).user?.id,
          ucpId: id,
          newPositionId: result.data.positionId,
          action: 'position_update'
        });
      }

      logInfo('Updating UCP', { 
        userId: (req as any).user?.id,
        ucpId: id,
        updatedFields: Object.keys(result.data)
      });

      const ucp = await storage.updateUcp(id, result.data);
      if (!ucp) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json(ucp);
    } catch (error) {
      logError("Error updating UCP", error as Error);
      // Check if it's a position conflict error
      if (error instanceof Error && error.message.includes('already occupied')) {
        return res.status(409).json({ 
          message: error.message,
          code: 'POSITION_OCCUPIED'
        });
      }
      res.status(500).json({ message: "Failed to update UCP" });
    }
  }

  async dismantleUcp(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      
      logInfo('Dismantling UCP', { 
        userId: (req as any).user?.id,
        ucpId: id,
        reason
      });
      
      const success = await storage.dismantleUcp(id, (req as any).user.id, reason);
      if (!success) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json({ message: "UCP dismantled successfully" });
    } catch (error) {
      logError("Error dismantling UCP", error as Error);
      res.status(500).json({ message: "Failed to dismantle UCP" });
    }
  }

  async moveUcp(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { positionId, reason } = req.body;
      
      logInfo('Moving UCP', { 
        userId: (req as any).user?.id,
        ucpId: id,
        positionId,
        reason
      });
      
      const success = await storage.moveUcpToPosition(id, positionId, (req as any).user.id, reason);
      if (!success) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json({ message: "UCP moved successfully" });
    } catch (error) {
      logError("Error moving UCP", error as Error);
      res.status(500).json({ message: "Failed to move UCP" });
    }
  }

  async getUcpHistory(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid UCP ID" });
      }
      
      const history = await storage.getUcpHistory(id);
      res.json(history);
    } catch (error) {
      logError("Error fetching UCP history", error as Error);
      res.status(500).json({ message: "Failed to fetch UCP history" });
    }
  }

  async deleteUcp(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      
      logInfo('Deleting UCP', { 
        userId: (req as any).user?.id,
        ucpId: id
      });
      
      const success = await storage.deleteUcp(id);
      if (!success) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.status(204).send();
    } catch (error) {
      logError("Error deleting UCP", error as Error);
      res.status(500).json({ message: "Failed to delete UCP" });
    }
  }

  async transferUcpItem(req: Request, res: Response) {
    try {
      const { sourceItemId, targetUcpId, quantity, reason } = req.body;
      
      logInfo('Processing UCP item transfer', {
        sourceItemId,
        targetUcpId,
        quantity,
        reason,
        userId: (req as any).user.id,
        userEmail: (req as any).user.email,
        timestamp: new Date().toISOString()
      });

      // Basic input validations
      if (!sourceItemId || !targetUcpId || !quantity || !reason) {
        logWarn('Missing required fields for transfer', { sourceItemId, targetUcpId, quantity, reason });
        return res.status(400).json({ 
          message: "Campos obrigatórios: sourceItemId, targetUcpId, quantity, reason" 
        });
      }

      if (typeof quantity !== 'number' || quantity <= 0) {
        logWarn('Invalid quantity for transfer', { quantity });
        return res.status(400).json({ 
          message: "Quantidade deve ser um número positivo" 
        });
      }

      if (typeof reason !== 'string' || reason.trim().length === 0) {
        logWarn('Invalid reason for transfer', { reason });
        return res.status(400).json({ 
          message: "Motivo da transferência é obrigatório" 
        });
      }

      // Execute transfer through storage layer
      const result = await storage.transferUcpItem({
        sourceItemId: parseInt(sourceItemId),
        targetUcpId: parseInt(targetUcpId),
        quantity: parseInt(quantity.toString()),
        reason: reason.trim(),
        userId: (req as any).user.id
      });

      logInfo('Transfer executed successfully', {
        transferId: result.transferId,
        sourceUcpId: result.sourceUcpId,
        targetUcpId: result.targetUcpId,
        timestamp: result.timestamp
      });

      res.json({ 
        success: true,
        message: "Item transferido com sucesso",
        transfer: {
          id: result.transferId,
          sourceUcpId: result.sourceUcpId,
          targetUcpId: result.targetUcpId,
          sourceUpdated: result.sourceUpdated,
          targetCreated: result.targetCreated,
          timestamp: result.timestamp,
          performedBy: {
            id: (req as any).user.id,
            email: (req as any).user.email,
            name: `${(req as any).user.firstName} ${(req as any).user.lastName}`
          }
        }
      });

    } catch (error: any) {
      logError('Error in UCP item transfer', error as Error);
      
      // Return more specific error based on message
      if (error?.message?.includes('não encontrado')) {
        return res.status(404).json({ message: error.message });
      }
      
      if (error?.message?.includes('inválida') || 
          error?.message?.includes('excede') || 
          error?.message?.includes('deve ser')) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ 
        message: "Erro interno na transferência",
        detail: error?.message || "Erro desconhecido"
      });
    }
  }
}

export const ucpsController = new UcpsController();
