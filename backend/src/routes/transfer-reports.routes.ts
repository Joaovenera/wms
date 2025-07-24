import express from 'express';
import { transferReportsController } from '../controllers/transfer-reports.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(isAuthenticated);

// GET /api/transfer-reports - Listar relatórios gerados
router.get('/', transferReportsController.getAllReports);

// GET /api/transfer-reports/divergence-analysis - Análise de divergências
router.get('/divergence-analysis', transferReportsController.getDivergenceAnalysis);

// GET /api/transfer-reports/efficiency-metrics - Métricas de eficiência
router.get('/efficiency-metrics', transferReportsController.getEfficiencyMetrics);

// GET /api/transfer-reports/:id - Buscar relatório por ID
router.get('/:id', transferReportsController.getReportById);

// POST /api/transfer-reports/generate/:transferRequestId - Gerar relatório detalhado
router.post('/generate/:transferRequestId', transferReportsController.generateDetailedReport);

export default router;