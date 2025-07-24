import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

const router = Router();

// Product Photo routes (separate from products for better organization)
router.get('/:id', isAuthenticated, async (req, res) => {
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

router.delete('/:id', isAuthenticated, async (req: any, res) => {
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

router.put('/:id/set-primary', isAuthenticated, async (req: any, res) => {
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

export default router;
