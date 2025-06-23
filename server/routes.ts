import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}
import {
  insertPalletSchema,
  insertPositionSchema,
  insertProductSchema,
  insertUcpSchema,
  insertUcpItemSchema,
  insertMovementSchema,
  insertUserSchema,
  insertPalletStructureSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUserById(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Pallet routes
  app.get('/api/pallets', isAuthenticated, async (req, res) => {
    try {
      const pallets = await storage.getPallets();
      res.json(pallets);
    } catch (error) {
      console.error("Error fetching pallets:", error);
      res.status(500).json({ message: "Failed to fetch pallets" });
    }
  });

  app.get('/api/pallets/next-code', isAuthenticated, async (req, res) => {
    try {
      const nextCode = await storage.getNextPalletCode();
      res.json({ code: nextCode });
    } catch (error) {
      console.error('Error generating next pallet code:', error);
      res.status(500).json({ message: 'Failed to generate next pallet code' });
    }
  });

  app.get('/api/pallets/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pallet = await storage.getPallet(id);
      if (!pallet) {
        return res.status(404).json({ message: "Pallet not found" });
      }
      res.json(pallet);
    } catch (error) {
      console.error("Error fetching pallet:", error);
      res.status(500).json({ message: "Failed to fetch pallet" });
    }
  });

  app.get('/api/pallets/code/:code', isAuthenticated, async (req, res) => {
    try {
      const pallet = await storage.getPalletByCode(req.params.code);
      if (!pallet) {
        return res.status(404).json({ message: "Pallet not found" });
      }
      res.json(pallet);
    } catch (error) {
      console.error("Error fetching pallet:", error);
      res.status(500).json({ message: "Failed to fetch pallet" });
    }
  });

  app.post('/api/pallets', isAuthenticated, async (req: any, res) => {
    try {
      const result = insertPalletSchema.safeParse({
        ...req.body,
        createdBy: req.user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const pallet = await storage.createPallet(result.data);
      res.status(201).json(pallet);
    } catch (error) {
      console.error("Error creating pallet:", error);
      res.status(500).json({ message: "Failed to create pallet" });
    }
  });

  app.put('/api/pallets/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPalletSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const pallet = await storage.updatePallet(id, result.data);
      if (!pallet) {
        return res.status(404).json({ message: "Pallet not found" });
      }
      res.json(pallet);
    } catch (error) {
      console.error("Error updating pallet:", error);
      res.status(500).json({ message: "Failed to update pallet" });
    }
  });

  app.delete('/api/pallets/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePallet(id);
      if (!success) {
        return res.status(404).json({ message: "Pallet not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pallet:", error);
      res.status(500).json({ message: "Failed to delete pallet" });
    }
  });

  // Position routes
  app.get('/api/positions', isAuthenticated, async (req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json(positions);
    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.get('/api/positions/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const position = await storage.getPosition(id);
      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      console.error("Error fetching position:", error);
      res.status(500).json({ message: "Failed to fetch position" });
    }
  });

  app.get('/api/positions/code/:code', isAuthenticated, async (req, res) => {
    try {
      const position = await storage.getPositionByCode(req.params.code);
      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      console.error("Error fetching position:", error);
      res.status(500).json({ message: "Failed to fetch position" });
    }
  });

  app.post('/api/positions', isAuthenticated, async (req: any, res) => {
    try {
      const result = insertPositionSchema.safeParse({
        ...req.body,
        createdBy: req.user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const position = await storage.createPosition(result.data);
      res.status(201).json(position);
    } catch (error) {
      console.error("Error creating position:", error);
      res.status(500).json({ message: "Failed to create position" });
    }
  });

  app.put('/api/positions/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPositionSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const position = await storage.updatePosition(id, result.data);
      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      console.error("Error updating position:", error);
      res.status(500).json({ message: "Failed to update position" });
    }
  });

  app.patch('/api/positions/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPositionSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const position = await storage.updatePosition(id, result.data);
      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      console.error("Error updating position:", error);
      res.status(500).json({ message: "Failed to update position" });
    }
  });

  app.delete('/api/positions/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePosition(id);
      if (!success) {
        return res.status(404).json({ message: "Position not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting position:", error);
      res.status(500).json({ message: "Failed to delete position" });
    }
  });

  // Product routes
  app.get('/api/products', isAuthenticated, async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.get('/api/products/sku/:sku', isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProductBySku(req.params.sku);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', isAuthenticated, async (req: any, res) => {
    try {
      const result = insertProductSchema.safeParse({
        ...req.body,
        createdBy: req.user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const product = await storage.createProduct(result.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProductSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const product = await storage.updateProduct(id, result.data);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Enhanced UCP routes for comprehensive lifecycle management
  app.get('/api/ucps', isAuthenticated, async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const ucps = await storage.getUcps(includeArchived);
      res.json(ucps);
    } catch (error) {
      console.error("Error fetching UCPs:", error);
      res.status(500).json({ message: "Failed to fetch UCPs" });
    }
  });

  app.get('/api/ucps/stats', isAuthenticated, async (req, res) => {
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
      console.error("Error fetching UCP stats:", error);
      res.status(500).json({ message: "Failed to fetch UCP stats" });
    }
  });

  app.get('/api/ucps/available', isAuthenticated, async (req, res) => {
    try {
      const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
      const availableUcps = await storage.getAvailableUcpsForProduct(productId);
      res.json(availableUcps);
    } catch (error) {
      console.error("Error fetching available UCPs:", error);
      res.status(500).json({ message: "Failed to fetch available UCPs" });
    }
  });

  app.get('/api/ucps/archived', isAuthenticated, async (req, res) => {
    try {
      const archivedUcps = await storage.getArchivedUcps();
      res.json(archivedUcps);
    } catch (error) {
      console.error("Error fetching archived UCPs:", error);
      res.status(500).json({ message: "Failed to fetch archived UCPs" });
    }
  });

  app.get('/api/ucps/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ucp = await storage.getUcp(id);
      if (!ucp) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json(ucp);
    } catch (error) {
      console.error("Error fetching UCP:", error);
      res.status(500).json({ message: "Failed to fetch UCP" });
    }
  });

  app.get('/api/ucps/code/:code', isAuthenticated, async (req, res) => {
    try {
      const ucp = await storage.getUcpByCode(req.params.code);
      if (!ucp) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json(ucp);
    } catch (error) {
      console.error("Error fetching UCP:", error);
      res.status(500).json({ message: "Failed to fetch UCP" });
    }
  });

  // Comprehensive UCP creation with wizard support
  app.post('/api/ucps/comprehensive', isAuthenticated, async (req: any, res) => {
    try {
      const { ucp, items } = req.body;
      
      const ucpResult = insertUcpSchema.safeParse({
        ...ucp,
        createdBy: req.user.id,
      });
      
      if (!ucpResult.success) {
        const validationError = fromZodError(ucpResult.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Generate UCP code if not provided
      if (!ucpResult.data.code) {
        ucpResult.data.code = await storage.getNextUcpCode();
      }

      // Create UCP with full history tracking
      const newUcp = await storage.createUcpWithHistory(ucpResult.data, req.user.id);
      
      // Add items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          const itemResult = insertUcpItemSchema.safeParse({
            ...item,
            ucpId: newUcp.id,
          });
          
          if (itemResult.success) {
            await storage.addUcpItem(itemResult.data, req.user.id);
          }
        }
      }

      res.status(201).json(newUcp);
    } catch (error) {
      console.error("Error creating comprehensive UCP:", error);
      res.status(500).json({ message: "Failed to create UCP" });
    }
  });

  app.post('/api/ucps', isAuthenticated, async (req: any, res) => {
    try {
      const result = insertUcpSchema.safeParse({
        ...req.body,
        createdBy: req.user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const ucp = await storage.createUcp(result.data);
      res.status(201).json(ucp);
    } catch (error) {
      console.error("Error creating UCP:", error);
      res.status(500).json({ message: "Failed to create UCP" });
    }
  });

  app.put('/api/ucps/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertUcpSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const ucp = await storage.updateUcp(id, result.data);
      if (!ucp) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json(ucp);
    } catch (error) {
      console.error("Error updating UCP:", error);
      res.status(500).json({ message: "Failed to update UCP" });
    }
  });

  // UCP Lifecycle Management Routes
  app.post('/api/ucps/:id/dismantle', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      
      const success = await storage.dismantleUcp(id, req.user.id, reason);
      if (!success) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json({ message: "UCP dismantled successfully" });
    } catch (error) {
      console.error("Error dismantling UCP:", error);
      res.status(500).json({ message: "Failed to dismantle UCP" });
    }
  });

  app.post('/api/ucps/:id/move', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { positionId, reason } = req.body;
      
      const success = await storage.moveUcpToPosition(id, positionId, req.user.id, reason);
      if (!success) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.json({ message: "UCP moved successfully" });
    } catch (error) {
      console.error("Error moving UCP:", error);
      res.status(500).json({ message: "Failed to move UCP" });
    }
  });

  app.get('/api/ucps/:id/history', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const history = await storage.getUcpHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching UCP history:", error);
      res.status(500).json({ message: "Failed to fetch UCP history" });
    }
  });

  app.post('/api/pallets/:id/reactivate', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const newUcpCode = await storage.reactivatePallet(id, req.user.id);
      res.json({ ucpCode: newUcpCode, message: "Pallet reactivated with new UCP" });
    } catch (error) {
      console.error("Error reactivating pallet:", error);
      res.status(500).json({ message: "Failed to reactivate pallet" });
    }
  });

  // UCP Item Management
  app.get('/api/ucps/:id/items', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const includeRemoved = req.query.includeRemoved === 'true';
      const items = await storage.getUcpItems(id, includeRemoved);
      res.json(items);
    } catch (error) {
      console.error("Error fetching UCP items:", error);
      res.status(500).json({ message: "Failed to fetch UCP items" });
    }
  });

  app.post('/api/ucps/:id/items', isAuthenticated, async (req: any, res) => {
    try {
      const ucpId = parseInt(req.params.id);
      const result = insertUcpItemSchema.safeParse({
        ...req.body,
        ucpId,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const item = await storage.addUcpItem(result.data, req.user.id);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding UCP item:", error);
      res.status(500).json({ message: "Failed to add UCP item" });
    }
  });

  app.delete('/api/ucp-items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Removal reason is required" });
      }

      const success = await storage.removeUcpItem(id, req.user.id, reason);
      if (!success) {
        return res.status(404).json({ message: "UCP item not found" });
      }
      res.json({ message: "UCP item removed successfully" });
    } catch (error) {
      console.error("Error removing UCP item:", error);
      res.status(500).json({ message: "Failed to remove UCP item" });
    }
  });

  app.delete('/api/ucps/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUcp(id);
      if (!success) {
        return res.status(404).json({ message: "UCP not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UCP:", error);
      res.status(500).json({ message: "Failed to delete UCP" });
    }
  });

  // UCP Item routes
  app.get('/api/ucps/:ucpId/items', isAuthenticated, async (req, res) => {
    try {
      const ucpId = parseInt(req.params.ucpId);
      const items = await storage.getUcpItems(ucpId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching UCP items:", error);
      res.status(500).json({ message: "Failed to fetch UCP items" });
    }
  });

  app.post('/api/ucps/:ucpId/items', isAuthenticated, async (req: any, res) => {
    try {
      const ucpId = parseInt(req.params.ucpId);
      const result = insertUcpItemSchema.safeParse({
        ...req.body,
        ucpId,
        addedBy: req.user.claims.sub,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const item = await storage.addUcpItem(result.data, req.user.id);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding UCP item:", error);
      res.status(500).json({ message: "Failed to add UCP item" });
    }
  });

  app.delete('/api/ucp-items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Removal reason is required" });
      }

      const success = await storage.removeUcpItem(id, req.user.id, reason);
      if (!success) {
        return res.status(404).json({ message: "UCP item not found" });
      }
      res.json({ message: "UCP item removed successfully" });
    } catch (error) {
      console.error("Error removing UCP item:", error);
      res.status(500).json({ message: "Failed to remove UCP item" });
    }
  });

  // Movement routes
  app.get('/api/movements', isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const movements = await storage.getMovements(limit);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching movements:", error);
      res.status(500).json({ message: "Failed to fetch movements" });
    }
  });

  app.post('/api/movements', isAuthenticated, async (req: any, res) => {
    try {
      const result = insertMovementSchema.safeParse({
        ...req.body,
        performedBy: req.user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const movement = await storage.createMovement(result.data);
      res.status(201).json(movement);
    } catch (error) {
      console.error("Error creating movement:", error);
      res.status(500).json({ message: "Failed to create movement" });
    }
  });

  // Pallet Structure routes
  app.get('/api/pallet-structures', isAuthenticated, async (req, res) => {
    try {
      const structures = await storage.getPalletStructures();
      res.json(structures);
    } catch (error) {
      console.error("Error fetching pallet structures:", error);
      res.status(500).json({ message: "Failed to fetch pallet structures" });
    }
  });

  app.get('/api/pallet-structures/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const structure = await storage.getPalletStructure(id);
      if (!structure) {
        return res.status(404).json({ message: "Pallet structure not found" });
      }
      res.json(structure);
    } catch (error) {
      console.error("Error fetching pallet structure:", error);
      res.status(500).json({ message: "Failed to fetch pallet structure" });
    }
  });

  app.post('/api/pallet-structures', isAuthenticated, async (req: any, res) => {
    try {
      const result = insertPalletStructureSchema.safeParse({
        ...req.body,
        createdBy: req.user.id,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const structure = await storage.createPalletStructure(result.data);
      res.status(201).json(structure);
    } catch (error) {
      console.error("Error creating pallet structure:", error);
      res.status(500).json({ message: "Failed to create pallet structure" });
    }
  });

  app.delete('/api/pallet-structures/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePalletStructure(id);
      if (!success) {
        return res.status(404).json({ message: "Pallet structure not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pallet structure:", error);
      res.status(500).json({ message: "Failed to delete pallet structure" });
    }
  });

  // Users routes
  app.get('/api/users', isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(result.data.password);
      const userData = { ...result.data, password: hashedPassword };

      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertUserSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Check if email already exists for other users
      if (result.data.email) {
        const existingUser = await storage.getUserByEmail(result.data.email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      // Hash password if provided
      let userData = { ...result.data };
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }

      const user = await storage.updateUser(id, userData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.put('/api/users/:id/role', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!role || !['operator', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Role inválido" });
      }

      const user = await storage.updateUser(id, { role });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
