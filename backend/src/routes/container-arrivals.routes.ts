import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { containerArrivalsController } from '../controllers/container-arrivals.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(isAuthenticated);

// Configurar multer para upload de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'containers', req.params.id || 'temp');
    
    // Criar diretório se não existir
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Nome do arquivo: containerId_photoType_timestamp.ext
    const photoType = req.body.photoType || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}_${photoType}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use apenas JPEG, PNG ou WebP.'));
    }
  }
});

// GET /api/container-arrivals - Listar containers
router.get('/', containerArrivalsController.getAllContainers);

// GET /api/container-arrivals/stats - Estatísticas dos containers
router.get('/stats', containerArrivalsController.getContainerStats);

// GET /api/container-arrivals/:id - Buscar container por ID
router.get('/:id', containerArrivalsController.getContainerById);

// POST /api/container-arrivals - Criar novo container
router.post('/', containerArrivalsController.createContainer as any);

// PUT /api/container-arrivals/:id - Atualizar container
router.put('/:id', containerArrivalsController.updateContainer as any);

// PUT /api/container-arrivals/:id/status - Atualizar status do container
router.put('/:id/status', containerArrivalsController.updateContainerStatus as any);

// POST /api/container-arrivals/:id/photos - Upload de fotos
router.post('/:id/photos', upload.single('photo'), containerArrivalsController.uploadPhoto as any);

// DELETE /api/container-arrivals/:id/photos/:photoId - Remover foto
router.delete('/:id/photos/:photoId', containerArrivalsController.deletePhoto as any);

// GET /api/container-arrivals/:id/photos/:photoId - Visualizar foto
router.get('/:id/photos/:photoId', containerArrivalsController.getPhoto);

// POST /api/container-arrivals/:id/items - Adicionar item ao container
router.post('/:id/items', containerArrivalsController.addItemToContainer as any);

// PUT /api/container-arrivals/:id/items/:itemId - Atualizar item
router.put('/:id/items/:itemId', containerArrivalsController.updateContainerItem as any);

// DELETE /api/container-arrivals/:id/items/:itemId - Remover item
router.delete('/:id/items/:itemId', containerArrivalsController.removeItemFromContainer as any);

// POST /api/container-arrivals/:id/complete - Finalizar container
router.post('/:id/complete', containerArrivalsController.completeContainer as any);

// GET /api/container-arrivals/:id/report - Gerar relatório do container
router.get('/:id/report', containerArrivalsController.generateContainerReport);

export default router;