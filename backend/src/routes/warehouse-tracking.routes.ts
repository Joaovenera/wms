import { Router } from "express";
import { warehouseTrackingController } from "../controllers/warehouse-tracking.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Warehouse metrics and overview
router.get("/metrics", warehouseTrackingController.getWarehouseMetrics);
router.get("/zones", warehouseTrackingController.getWarehouseZones);

// Live position tracking
router.get("/positions", warehouseTrackingController.getLivePositionMap);
router.get("/positions/:id", warehouseTrackingController.getPositionDetails);
router.put("/positions/:id/status", warehouseTrackingController.updatePositionStatus);

// Live movements
router.get("/movements", warehouseTrackingController.getLiveMovements);

// Heatmap and analytics
router.get("/heatmap", warehouseTrackingController.getWarehouseHeatmap);

// Real-time updates
router.post("/trigger-update", warehouseTrackingController.triggerRealTimeUpdate);

export { router as warehouseTrackingRoutes };