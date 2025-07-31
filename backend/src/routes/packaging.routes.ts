import { Router } from "express";
import { z } from "zod";
import { packagingService } from "../services/packaging.service";
import { insertPackagingTypeSchema } from "../db/schema";
import { validatePayload } from "../middleware/payload.middleware";
import { isAuthenticated, AuthenticatedRequest } from "../middleware/auth.middleware";

const router = Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(isAuthenticated);

/**
 * GET /api/packaging/products/:productId
 * Busca todas as embalagens de um produto com estoque
 */
router.get('/products/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'ID do produto inválido' });
    }

    const [packagings, stockByPackaging, consolidatedStock] = await Promise.all([
      packagingService.getPackagingsByProduct(productId),
      packagingService.getStockByPackaging(productId),
      packagingService.getStockConsolidated(productId)
    ]);

    res.json({
      packagings,
      stock: stockByPackaging,
      consolidated: consolidatedStock
    });
  } catch (error) {
    console.error('Erro ao buscar embalagens do produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/packaging/products/:productId/hierarchy
 * Busca hierarquia completa de embalagens de um produto
 */
router.get('/products/:productId/hierarchy', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'ID do produto inválido' });
    }

    const hierarchy = await packagingService.getPackagingHierarchy(productId);
    res.json(hierarchy);
  } catch (error) {
    console.error('Erro ao buscar hierarquia de embalagens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/packaging/scan
 * Busca embalagem por código de barras
 */
const scanBarcodeSchema = z.object({
  barcode: z.string().min(1, 'Código de barras é obrigatório')
});

router.post('/scan', validatePayload(scanBarcodeSchema), async (req, res) => {
  try {
    const { barcode } = req.body;
    
    const packaging = await packagingService.getPackagingByBarcode(barcode);
    res.json(packaging);
  } catch (error) {
    if (error instanceof Error && error.message.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    
    console.error('Erro ao buscar embalagem por código de barras:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/packaging/optimize-picking
 * Otimiza separação usando combinação de embalagens
 */
const optimizePickingSchema = z.object({
  productId: z.number().int().positive('ID do produto deve ser um número positivo'),
  requestedBaseUnits: z.number().positive('Quantidade solicitada deve ser positiva')
});

router.post('/optimize-picking', validatePayload(optimizePickingSchema), async (req, res) => {
  try {
    const { productId, requestedBaseUnits } = req.body;
    
    const pickingPlan = await packagingService.optimizePickingByPackaging(productId, requestedBaseUnits);
    res.json(pickingPlan);
  } catch (error) {
    console.error('Erro ao otimizar separação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/packaging/convert
 * Converte quantidade entre embalagens
 */
const convertQuantitySchema = z.object({
  quantity: z.number().positive('Quantidade deve ser positiva'),
  fromPackagingId: z.number().int().positive('ID da embalagem de origem obrigatório'),
  toPackagingId: z.number().int().positive('ID da embalagem de destino obrigatório')
});

router.post('/convert', validatePayload(convertQuantitySchema), async (req, res) => {
  try {
    const { quantity, fromPackagingId, toPackagingId } = req.body;
    
    // Converter para unidade base primeiro
    const baseUnits = await packagingService.convertToBaseUnits(quantity, fromPackagingId);
    
    // Depois converter para embalagem de destino
    const convertedQuantity = await packagingService.convertFromBaseUnits(baseUnits, toPackagingId);
    
    res.json({
      originalQuantity: quantity,
      originalPackagingId: fromPackagingId,
      convertedQuantity,
      targetPackagingId: toPackagingId,
      baseUnits
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('não encontrado')) {
      return res.status(404).json({ error: error.message });
    }
    
    console.error('Erro ao converter quantidade:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/packaging
 * Cria nova embalagem
 */
router.post('/', validatePayload(insertPackagingTypeSchema), async (req, res) => {
  try {
    const packaging = await packagingService.createPackaging({
      ...req.body,
      createdBy: (req as AuthenticatedRequest).user.id
    });
    
    res.status(201).json(packaging);
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('já existe') || 
      error.message.includes('já existe')
    )) {
      return res.status(409).json({ error: error.message });
    }
    
    console.error('Erro ao criar embalagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/packaging/:id
 * Atualiza embalagem existente
 */
const updatePackagingSchema = insertPackagingTypeSchema.partial();

router.put('/:id', validatePayload(updatePackagingSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID da embalagem inválido' });
    }

    const packaging = await packagingService.updatePackaging(id, req.body);
    res.json(packaging);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('já existe')) {
        return res.status(409).json({ error: error.message });
      }
    }
    
    console.error('Erro ao atualizar embalagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/packaging/:id
 * Remove embalagem (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID da embalagem inválido' });
    }

    await packagingService.deletePackaging(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('possui itens associados')) {
        return res.status(409).json({ error: error.message });
      }
    }
    
    console.error('Erro ao remover embalagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/packaging/:id
 * Busca embalagem por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID da embalagem inválido' });
    }

    const packaging = await packagingService.getPackagingsByProduct(id);
    
    if (!packaging.length) {
      return res.status(404).json({ error: 'Embalagem não encontrada' });
    }

    res.json(packaging[0]);
  } catch (error) {
    console.error('Erro ao buscar embalagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;