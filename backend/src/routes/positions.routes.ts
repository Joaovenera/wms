import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireManagerOrAdmin } from "../middleware/auth.middleware";
import { insertPositionSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// Position routes
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const positions = await storage.getPositions();
    res.json(positions);
  } catch (error) {
    console.error("Error fetching positions:", error);
    res.status(500).json({ message: "Failed to fetch positions" });
  }
});

router.get('/:id', isAuthenticated, async (req, res) => {
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

router.get('/code/:code', isAuthenticated, async (req, res) => {
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

router.post('/', isAuthenticated, requireManagerOrAdmin, async (req: any, res) => {
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

router.put('/:id', isAuthenticated, async (req, res) => {
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

router.patch('/:id', isAuthenticated, async (req, res) => {
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

router.delete('/:id', isAuthenticated, requireManagerOrAdmin, async (req, res) => {
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

// Add real-time position status updates
router.patch('/:id/status/realtime', isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, reason } = req.body;
    
    const position = await storage.updatePosition(id, { status });
    if (!position) {
      return res.status(404).json({ message: "Position not found" });
    }
    
    // TODO: Add broadcast functionality when WebSocket is refactored
    
    res.json(position);
  } catch (error) {
    console.error("Error updating position status:", error);
    res.status(500).json({ message: "Failed to update position status" });
  }
});

export default router;
