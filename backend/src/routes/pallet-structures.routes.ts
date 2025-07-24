import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertPalletStructureSchema } from "../db/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

// Pallet Structure routes
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const structures = await storage.getPalletStructures();
    res.json(structures);
  } catch (error) {
    console.error("Error fetching pallet structures:", error);
    res.status(500).json({ message: "Failed to fetch pallet structures" });
  }
});

router.get('/:id', isAuthenticated, async (req, res) => {
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

router.post('/', isAuthenticated, async (req: any, res) => {
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

router.delete('/:id', isAuthenticated, async (req, res) => {
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

export default router;
