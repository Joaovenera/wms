import express from 'express';
import { loadingExecutionsController } from '../controllers/loading-executions.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(isAuthenticated);

// GET /api/loading-executions - Listar execuções de carregamento
router.get('/', loadingExecutionsController.getAllLoadingExecutions);

// GET /api/loading-executions/pending - Listar execuções pendentes
router.get('/pending', loadingExecutionsController.getPendingExecutions);

// GET /api/loading-executions/:id - Buscar execução por ID
router.get('/:id', loadingExecutionsController.getLoadingExecutionById);

// POST /api/loading-executions - Iniciar nova execução
router.post('/', loadingExecutionsController.startLoadingExecution);

// POST /api/loading-executions/:id/scan-item - Confirmar item via scanner
router.post('/:id/scan-item', loadingExecutionsController.scanAndConfirmItem);

// PUT /api/loading-executions/:id/items/:itemId/divergence - Registrar divergência
router.put('/:id/items/:itemId/divergence', loadingExecutionsController.registerDivergence);

// PUT /api/loading-executions/:id/finish - Finalizar execução
router.put('/:id/finish', loadingExecutionsController.finishLoadingExecution);

export default router;