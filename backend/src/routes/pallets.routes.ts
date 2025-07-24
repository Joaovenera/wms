import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, requireManagerOrAdmin } from "../middleware/auth.middleware";
import { insertPalletSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// Pallet routes
router.get('/', isAuthenticated, async (req, res) => {
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

router.get('/next-code', isAuthenticated, async (req, res) => {
  try {
    const nextCode = await storage.getNextPalletCode();
    res.json({ code: nextCode });
  } catch (error) {
    console.error('Error generating next pallet code:', error);
    res.status(500).json({ message: 'Failed to generate next pallet code' });
  }
});

router.get('/available-for-ucp', isAuthenticated, async (req, res) => {
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

router.get('/:id', isAuthenticated, async (req, res) => {
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

router.get('/code/:code', isAuthenticated, async (req, res) => {
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

router.post('/', isAuthenticated, requireManagerOrAdmin, async (req: any, res) => {
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

router.put('/:id', isAuthenticated, requireManagerOrAdmin, async (req, res) => {
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

router.delete('/:id', isAuthenticated, requireManagerOrAdmin, async (req, res) => {
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

router.post('/:id/reactivate', isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const newUcpCode = await storage.reactivatePallet(id, req.user.id);
    res.json({ ucpCode: newUcpCode, message: "Pallet reactivated with new UCP" });
  } catch (error) {
    console.error("Error reactivating pallet:", error);
    res.status(500).json({ message: "Failed to reactivate pallet" });
  }
});

export default router;
