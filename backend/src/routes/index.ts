import { Express } from "express";
import { setupAuth } from "../auth";
import { createServer, type Server } from "http";
import { initWebSocket } from "../services/websocket.service";

// Import all route modules
import authRoutes from "./auth.routes";
import palletsRoutes from "./pallets.routes";
import positionsRoutes from "./positions.routes";
import productsRoutes from "./products.routes";
import productPhotosRoutes from "./product-photos.routes";
import packagingRoutes from "./packaging.routes";
import ucpsRoutes from "./ucps.routes";
import ucpItemsRoutes from "./ucp-items.routes";
import usersRoutes from "./users.routes";
import movementsRoutes from "./movements.routes";
import palletStructuresRoutes from "./pallet-structures.routes";
import vehiclesRoutes from "./vehicles.routes";
import transferRequestsRoutes from "./transfer-requests.routes";
import loadingExecutionsRoutes from "./loading-executions.routes";
import transferReportsRoutes from "./transfer-reports.routes";
import containerArrivalsRoutes from "./container-arrivals.routes";
import compositionsRoutes from "./compositions.routes";
import testRoutes from "./test.routes";
import healthRoutes from "./health.routes";
import searchRoutes from "./search.routes";
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { storage } from "../storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Register all routes with their prefixes
  app.use('/api', authRoutes);
  
  // Dashboard stats
  const dashboardRouter = Router();
  dashboardRouter.get('/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
  });
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/pallets', palletsRoutes);
  app.use('/api/positions', positionsRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/product-photos', productPhotosRoutes);
  app.use('/api/packaging', packagingRoutes);
  app.use('/api/ucps', ucpsRoutes);
  app.use('/api/ucp-items', ucpItemsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/movements', movementsRoutes);
  app.use('/api/pallet-structures', palletStructuresRoutes);
  app.use('/api/vehicles', vehiclesRoutes);
  app.use('/api/transfer-requests', transferRequestsRoutes);
  app.use('/api/loading-executions', loadingExecutionsRoutes);
  app.use('/api/transfer-reports', transferReportsRoutes);
  app.use('/api/container-arrivals', containerArrivalsRoutes);
  app.use('/api/compositions', compositionsRoutes);
  app.use('/api/test', testRoutes);
  app.use('/api', healthRoutes);
  app.use('/api/search', searchRoutes);

  const httpServer = createServer(app);
  
  // Initialize WebSocket service with Redis pub/sub for scalability
  initWebSocket(httpServer);
  
  return httpServer;
} 