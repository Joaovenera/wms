import { Router } from "express";
import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";

import { 
  isAuthenticated as localAuth, 
  requireAdmin, 
  requireManagerOrAdmin, 
  requireUser 
} from "./middleware/auth.middleware";
import { logError, logInfo, logWarn } from "./utils/logger";
import { validateRequestBody, ValidationError } from "./utils/validation";
import { 
  insertPalletSchema, 
  insertPositionSchema, 
  insertProductSchema, 
  insertUcpSchema, 
  insertUcpItemSchema, 
  insertMovementSchema, 
  insertPalletStructureSchema, 
  insertUserSchema 
} from "./db/schema.js";
import { fromZodError } from "zod-validation-error";
import { WebSocketServer } from "ws";
import { createServer, type Server } from "http";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

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
      console.log('DEBUG: API /api/pallets chamada');
      const pallets = await storage.getPallets();
      console.log('DEBUG: API retornando', pallets.length, 'pallets');
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

  app.get('/api/pallets/available-for-ucp', isAuthenticated, async (req, res) => {
    try {
      console.log('DEBUG: API /api/pallets/available-for-ucp chamada');
      const availablePallets = await storage.getAvailablePalletsForUcp();
      console.log('DEBUG: Pallets disponíveis para UCP:', availablePallets.length);
      res.json(availablePallets);
    } catch (error) {
      console.error("Error fetching available pallets for UCP:", error);
      res.status(500).json({ message: "Failed to fetch available pallets" });
    }
  });

  app.get('/api/pallets/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid pallet ID" });
      }
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
      const includeStock = req.query.includeStock === 'true';
      
      if (includeStock) {
        const products = await storage.getProductsWithStock();
        res.json(products);
      } else {
        const products = await storage.getProducts();
        res.json(products);
      }
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

  // Product Photo routes
  app.get('/api/products/:id/photos', isAuthenticated, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const photos = await storage.getProductPhotos(productId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching product photos:", error);
      res.status(500).json({ message: "Failed to fetch product photos" });
    }
  });

  app.get('/api/product-photos/:id', isAuthenticated, async (req, res) => {
    try {
      const photoId = parseInt(req.params.id);
      const photo = await storage.getProductPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(photo);
    } catch (error) {
      console.error("Error fetching product photo:", error);
      res.status(500).json({ message: "Failed to fetch product photo" });
    }
  });

  app.post('/api/products/:id/photos', isAuthenticated, async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      const photoData = {
        ...req.body,
        productId,
        uploadedBy: req.user.id,
      };

      console.log('📸 Adding product photo:', {
        productId,
        filename: photoData.filename,
        userId: req.user.id,
        isPrimary: photoData.isPrimary || false
      });

      const photo = await storage.addProductPhoto(photoData, req.user.id);
      
      res.status(201).json({
        success: true,
        message: "Photo uploaded successfully",
        photo
      });
    } catch (error: any) {
      console.error("Error adding product photo:", error);
      res.status(500).json({ 
        message: "Failed to add product photo",
        detail: error?.message || "Unknown error"
      });
    }
  });

  app.delete('/api/product-photos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const photoId = parseInt(req.params.id);
      const notes = req.body.notes;

      console.log('🗑️ Removing product photo:', {
        photoId,
        userId: req.user.id,
        notes
      });

      const success = await storage.removeProductPhoto(photoId, req.user.id, notes);
      
      if (!success) {
        return res.status(404).json({ message: "Photo not found" });
      }

      res.json({
        success: true,
        message: "Photo removed successfully"
      });
    } catch (error: any) {
      console.error("Error removing product photo:", error);
      res.status(500).json({ 
        message: "Failed to remove product photo",
        detail: error?.message || "Unknown error"
      });
    }
  });

  app.put('/api/product-photos/:id/set-primary', isAuthenticated, async (req: any, res) => {
    try {
      const photoId = parseInt(req.params.id);

      console.log('⭐ Setting primary photo:', {
        photoId,
        userId: req.user.id
      });

      const success = await storage.setPrimaryPhoto(photoId, req.user.id);
      
      if (!success) {
        return res.status(404).json({ message: "Photo not found" });
      }

      res.json({
        success: true,
        message: "Photo set as primary successfully"
      });
    } catch (error: any) {
      console.error("Error setting primary photo:", error);
      res.status(500).json({ 
        message: "Failed to set primary photo",
        detail: error?.message || "Unknown error"
      });
    }
  });

  app.get('/api/products/:id/photo-history', isAuthenticated, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const history = await storage.getProductPhotoHistory(productId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching product photo history:", error);
      res.status(500).json({ message: "Failed to fetch photo history" });
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

  // Endpoint para buscar UCPs disponíveis para transferência
  app.get('/api/ucps/available-for-transfer', isAuthenticated, async (req, res) => {
    try {
      console.log('DEBUG: Fetching available UCPs for transfer');
      
      // Usar método específico para UCPs ativas apenas
      const activeUcps = await storage.getAvailableUcpsForProduct();
      console.log('DEBUG: Found active UCPs:', activeUcps.length);
      console.log('DEBUG: Sample active UCP:', activeUcps[0]);
      
      // Filtrar apenas status "active" (não "empty")
      const availableUcps = activeUcps.filter(ucp => ucp.status === 'active').map(ucp => ({
        id: ucp.id,
        code: ucp.code,
        status: ucp.status,
        pallet: ucp.pallet ? { code: ucp.pallet.code } : undefined,
        position: ucp.position ? { code: ucp.position.code } : undefined,
      }));
      
      console.log('DEBUG: Filtered UCPs for transfer:', availableUcps.length);
      res.json(availableUcps);
    } catch (error) {
      console.error("Error fetching available UCPs for transfer:", error);
      res.status(500).json({ message: "Failed to fetch available UCPs" });
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
      
      console.log('DEBUG: Comprehensive UCP creation request');
      console.log('DEBUG: UCP data:', ucp);
      console.log('DEBUG: Items data:', items);
      console.log('DEBUG: Items count:', items?.length || 0);
      
      const ucpResult = insertUcpSchema.safeParse({
        ...ucp,
        createdBy: req.user.id,
      });
      
      if (!ucpResult.success) {
        console.log('DEBUG: UCP validation failed:', ucpResult.error);
        const validationError = fromZodError(ucpResult.error);
        return res.status(400).json({ message: validationError.message });
      }

      // Generate UCP code if not provided
      if (!ucpResult.data.code) {
        ucpResult.data.code = await storage.getNextUcpCode();
      }

      // Create UCP with full history tracking
      console.log('DEBUG: Creating UCP with data:', ucpResult.data);
      const newUcp = await storage.createUcpWithHistory(ucpResult.data, req.user.id);
      console.log('DEBUG: UCP created with ID:', newUcp.id);
      
      // Add items if provided
      if (items && items.length > 0) {
        console.log('DEBUG: Processing items...');
        for (const item of items) {
          console.log('DEBUG: Processing item:', item);
          const itemData = {
            ucpId: newUcp.id,
            productId: item.productId,
            quantity: item.quantity.toString(), // Convert number to string for decimal field
            lot: item.lot || null,
            expiryDate: item.expiryDate || null,
            internalCode: item.internalCode || null,
            addedBy: req.user.id,
          };
          
          console.log('DEBUG: Prepared item data:', itemData);
          const itemResult = insertUcpItemSchema.safeParse(itemData);
          
          console.log('DEBUG: Item validation result:', itemResult.success ? 'SUCCESS' : 'FAILED');
          if (!itemResult.success) {
            console.log('DEBUG: Item validation errors:', itemResult.error);
          }
          
          if (itemResult.success) {
            console.log('DEBUG: Adding item to storage:', itemResult.data);
            const addedItem = await storage.addUcpItem(itemResult.data, req.user.id);
            console.log('DEBUG: Item added successfully:', addedItem.id);
          }
        }
      } else {
        console.log('DEBUG: No items to process');
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
      console.log(`DEBUG: Fetching history for UCP ID: ${id}`);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid UCP ID" });
      }
      
      const history = await storage.getUcpHistory(id);
      console.log(`DEBUG: Found ${history.length} history entries for UCP ${id}`);
      
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
      const { fromPositionId } = req.body;
      const result = insertUcpItemSchema.safeParse({
        ...req.body,
        ucpId,
      });
      
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.message });
      }

      const item = await storage.addUcpItem({ ...result.data, fromPositionId }, req.user.id);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding UCP item:", error);
      res.status(500).json({ message: "Failed to add UCP item" });
    }
  });

  app.delete('/api/ucp-items/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason, toPositionId } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Removal reason is required" });
      }

      const success = await storage.removeUcpItem(id, req.user.id, reason, toPositionId);
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
  
  // Setup WebSocket server for real-time warehouse tracking
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Set<any>();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('New WebSocket client connected. Total clients:', clients.size);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to warehouse tracking system',
      timestamp: new Date().toISOString()
    }));
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected. Total clients:', clients.size);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  // Broadcast function for real-time updates
  function broadcastUpdate(type: string, data: any) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Enhance movement creation to broadcast real-time updates
  const originalMovementPost = app._router.stack.find((layer: any) => 
    layer.route && layer.route.path === '/api/movements' && layer.route.methods.post
  );
  
  // Add real-time movement broadcasting
  app.post('/api/movements/realtime', isAuthenticated, async (req: any, res) => {
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
      
      // Broadcast real-time update to all connected clients
      broadcastUpdate('movement_created', {
        movement,
        user: req.user,
        message: 'New movement recorded'
      });
      
      res.status(201).json(movement);
    } catch (error) {
      console.error("Error creating real-time movement:", error);
      res.status(500).json({ message: "Failed to create movement" });
    }
  });
  
  // Add real-time UCP status updates
  app.patch('/api/ucps/:id/status/realtime', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, reason } = req.body;
      
      const ucp = await storage.updateUcp(id, { status });
      if (!ucp) {
        return res.status(404).json({ message: "UCP not found" });
      }
      
      // Broadcast real-time update
      broadcastUpdate('ucp_status_changed', {
        ucpId: id,
        oldStatus: req.body.oldStatus,
        newStatus: status,
        reason,
        user: req.user,
        timestamp: new Date().toISOString()
      });
      
      res.json(ucp);
    } catch (error) {
      console.error("Error updating UCP status:", error);
      res.status(500).json({ message: "Failed to update UCP status" });
    }
  });
  
  // Add real-time position status updates
  app.patch('/api/positions/:id/status/realtime', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, reason } = req.body;
      
      const position = await storage.updatePosition(id, { status });
      if (!position) {
        return res.status(404).json({ message: "Position not found" });
      }
      
      // Broadcast real-time update
      broadcastUpdate('position_status_changed', {
        positionId: id,
        oldStatus: req.body.oldStatus,
        newStatus: status,
        reason,
        user: req.user,
        timestamp: new Date().toISOString()
      });
      
      res.json(position);
    } catch (error) {
      console.error("Error updating position status:", error);
      res.status(500).json({ message: "Failed to update position status" });
    }
  });

  // Endpoint para transferir item entre UCPs
  app.post('/api/ucps/transfer-item', isAuthenticated, async (req: any, res) => {
    try {
      const { sourceItemId, targetUcpId, quantity, reason } = req.body;
      
      console.log('🚀 API: Recebida solicitação de transferência:', {
        sourceItemId,
        targetUcpId,
        quantity,
        reason,
        userId: req.user.id,
        userEmail: req.user.email,
        timestamp: new Date().toISOString()
      });

      // Validações básicas de entrada
      if (!sourceItemId || !targetUcpId || !quantity || !reason) {
        console.log('❌ API: Campos obrigatórios ausentes');
        return res.status(400).json({ 
          message: "Campos obrigatórios: sourceItemId, targetUcpId, quantity, reason" 
        });
      }

      if (typeof quantity !== 'number' || quantity <= 0) {
        console.log('❌ API: Quantidade inválida:', quantity);
        return res.status(400).json({ 
          message: "Quantidade deve ser um número positivo" 
        });
      }

      if (typeof reason !== 'string' || reason.trim().length === 0) {
        console.log('❌ API: Motivo inválido:', reason);
        return res.status(400).json({ 
          message: "Motivo da transferência é obrigatório" 
        });
      }

      // Executar a transferência através do storage
      // Todo o processamento e validação é feito no backend
      console.log('✅ API: Dados validados, executando transferência...');
      
      const result = await storage.transferUcpItem({
        sourceItemId: parseInt(sourceItemId),
        targetUcpId: parseInt(targetUcpId),
        quantity: parseInt(quantity.toString()),
        reason: reason.trim(),
        userId: req.user.id
      });

      console.log('✅ API: Transferência executada com sucesso:', {
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
            id: req.user.id,
            email: req.user.email,
            name: `${req.user.firstName} ${req.user.lastName}`
          }
        }
      });

          } catch (error: any) {
        console.error('❌ API: Erro na transferência:', error);
        
        // Retornar erro mais específico baseado na mensagem
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
  });

  // TEST ENDPOINT - Criar dados de teste para UCP 7
  app.post('/api/test/create-ucp-items', isAuthenticated, async (req: any, res) => {
    try {
      console.log('Creating test data for UCP items...');
      
      // Verificar se a UCP 7 existe
      const ucp = await storage.getUcp(7);
      if (!ucp) {
        return res.status(404).json({ message: "UCP 7 not found" });
      }
      
      // Buscar produtos existentes
      const products = await storage.getProducts();
      if (products.length === 0) {
        return res.status(400).json({ message: "No products found. Create products first." });
      }
      
      // Adicionar 3 itens de teste à UCP 7
      const testItems = [];
      for (let i = 0; i < Math.min(3, products.length); i++) {
        const product = products[i];
        const itemData = {
          ucpId: 7,
          productId: product.id,
          quantity: (Math.floor(Math.random() * 10) + 1).toString(),
          lot: `LOTE${Date.now()}${i}`,
          internalCode: `CI${Date.now()}${i}`,
          addedBy: req.user.id
        };
        
        try {
          const item = await storage.addUcpItem(itemData, req.user.id);
          testItems.push(item);
          console.log(`Test item added: ${product.name} (${product.sku})`);
        } catch (error) {
          console.error(`Error adding item ${product.name}:`, error);
        }
      }
      
      res.json({ 
        message: `${testItems.length} test items added to UCP 7`,
        items: testItems 
      });
      
    } catch (error) {
      console.error("Error creating test UCP items:", error);
      res.status(500).json({ message: "Failed to create test data" });
    }
  });

  return httpServer;
}
