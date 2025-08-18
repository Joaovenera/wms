import { Router } from 'express';

const router = Router();

/**
 * GET /api/compositions
 * Get all compositions
 */
router.get('/', async (req, res) => {
  try {
    // For now, return empty array to prevent 404 errors
    // TODO: Implement actual compositions functionality
    res.json([]);
  } catch (error) {
    console.error('Error fetching compositions:', error);
    res.status(500).json({ 
      message: 'Erro ao buscar composições',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/compositions
 * Create new composition
 */
router.post('/', async (req, res) => {
  try {
    // TODO: Implement composition creation
    res.status(501).json({ 
      message: 'Funcionalidade de composições ainda não implementada' 
    });
  } catch (error) {
    console.error('Error creating composition:', error);
    res.status(500).json({ 
      message: 'Erro ao criar composição',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;