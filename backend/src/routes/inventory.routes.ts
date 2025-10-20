import { Router } from "express";
import { inventoryController } from "../controllers/inventory.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Stock levels and balance routes
router.get("/stock-levels", inventoryController.getStockLevels);
router.get("/products/:id/balance", inventoryController.getProductStockBalance);

// Stock movements routes  
router.get("/movements", inventoryController.getStockMovements);

// Inventory adjustments routes
router.post("/adjustments", inventoryController.createInventoryAdjustment);
router.put("/adjustments/bulk", inventoryController.bulkStockUpdate);

// Alerts and reporting routes
router.get("/alerts", inventoryController.getLowStockAlerts);
router.get("/aging", inventoryController.getInventoryAging);

export { router as inventoryRoutes };