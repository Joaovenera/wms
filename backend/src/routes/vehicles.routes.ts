import express from 'express';
import { vehiclesController } from '../controllers/vehicles.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(isAuthenticated);

// GET /api/vehicles - Listar todos os veículos
router.get('/', vehiclesController.getAllVehicles);

// GET /api/vehicles/available - Listar veículos disponíveis
router.get('/available', vehiclesController.getAvailableVehicles);

// GET /api/vehicles/:id - Buscar veículo por ID
router.get('/:id', vehiclesController.getVehicleById);

// POST /api/vehicles - Criar novo veículo
router.post('/', vehiclesController.createVehicle);

// PUT /api/vehicles/:id - Atualizar veículo
router.put('/:id', vehiclesController.updateVehicle);

// DELETE /api/vehicles/:id - Desativar veículo
router.delete('/:id', vehiclesController.deactivateVehicle);

export default router;