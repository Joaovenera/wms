import { Router } from "express";
import { isAuthenticated, requireManagerOrAdmin } from "../middleware/auth.middleware";
import { ucpsController } from "../controllers/ucps.controller";

const router = Router();

// Enhanced UCP routes for comprehensive lifecycle management with proper authorization
router.get('/', isAuthenticated, ucpsController.getUcps.bind(ucpsController));
router.get('/stats', isAuthenticated, ucpsController.getUcpStats.bind(ucpsController));
router.get('/available', isAuthenticated, ucpsController.getAvailableUcps.bind(ucpsController));
router.get('/archived', isAuthenticated, ucpsController.getUcps.bind(ucpsController)); // Same method, different query
router.get('/available-for-transfer', isAuthenticated, ucpsController.getAvailableUcpsForTransfer.bind(ucpsController));
router.get('/:id', isAuthenticated, ucpsController.getUcpById.bind(ucpsController));
router.get('/code/:code', isAuthenticated, ucpsController.getUcpByCode.bind(ucpsController));

// UCP creation and management - require manager or admin
router.post('/comprehensive', isAuthenticated, requireManagerOrAdmin, ucpsController.createComprehensiveUcp.bind(ucpsController));
router.post('/', isAuthenticated, requireManagerOrAdmin, ucpsController.createUcp.bind(ucpsController));
router.put('/:id', isAuthenticated, requireManagerOrAdmin, ucpsController.updateUcp.bind(ucpsController));

// UCP lifecycle operations - require manager or admin
router.post('/:id/dismantle', isAuthenticated, requireManagerOrAdmin, ucpsController.dismantleUcp.bind(ucpsController));
router.post('/:id/move', isAuthenticated, requireManagerOrAdmin, ucpsController.moveUcp.bind(ucpsController));
router.get('/:id/history', isAuthenticated, ucpsController.getUcpHistory.bind(ucpsController));
router.delete('/:id', isAuthenticated, requireManagerOrAdmin, ucpsController.deleteUcp.bind(ucpsController));

// Real-time updates and transfers
router.patch('/:id/status/realtime', isAuthenticated, requireManagerOrAdmin, ucpsController.updateUcp.bind(ucpsController));
router.post('/transfer-item', isAuthenticated, ucpsController.transferUcpItem.bind(ucpsController));

export default router;
