import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertMovementSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// Movement routes
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const movements = await storage.getMovements(limit);
    res.json(movements);
  } catch (error) {
    console.error("Error fetching movements:", error);
    res.status(500).json({ message: "Failed to fetch movements" });
  }
});

router.post('/', isAuthenticated, async (req: any, res) => {
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

// Add real-time movement broadcasting
router.post('/realtime', isAuthenticated, async (req: any, res) => {
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
    
    // TODO: Broadcast real-time update to all connected clients when WebSocket is refactored
    
    res.status(201).json(movement);
  } catch (error) {
    console.error("Error creating real-time movement:", error);
    res.status(500).json({ message: "Failed to create movement" });
  }
});

export default router;
