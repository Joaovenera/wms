import express from 'express';
import { transferRequestsController } from '../controllers/transfer-requests.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(isAuthenticated);

// GET /api/transfer-requests - Listar pedidos de transferência
router.get('/', transferRequestsController.getAllTransferRequests);

// GET /api/transfer-requests/:id - Buscar pedido por ID
router.get('/:id', transferRequestsController.getTransferRequestById);

// POST /api/transfer-requests - Criar novo pedido
router.post('/', transferRequestsController.createTransferRequest);

// POST /api/transfer-requests/:id/items - Adicionar item ao pedido
router.post('/:id/items', transferRequestsController.addItemToRequest);

// DELETE /api/transfer-requests/:id/items/:itemId - Remover item do pedido
router.delete('/:id/items/:itemId', transferRequestsController.removeItemFromRequest);

// PUT /api/transfer-requests/:id/status - Atualizar status do pedido
router.put('/:id/status', transferRequestsController.updateRequestStatus);

export default router;