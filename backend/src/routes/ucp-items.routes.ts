import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertUcpItemSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// UCP Item Management
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const ucpId = parseInt(req.query.ucpId as string);
    const includeRemoved = req.query.includeRemoved === 'true';
    
    if (!ucpId || isNaN(ucpId)) {
      return res.status(400).json({ message: "Valid UCP ID is required" });
    }
    
    const items = await storage.getUcpItems(ucpId, includeRemoved);
    res.json(items);
  } catch (error) {
    console.error("Error fetching UCP items:", error);
    res.status(500).json({ message: "Failed to fetch UCP items" });
  }
});

router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const { ucpId, fromPositionId } = req.body;
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

router.delete('/:id', isAuthenticated, async (req: any, res) => {
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

export default router;
