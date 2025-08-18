import { Router, Request, Response } from "express";
import { packagingController } from "../controllers/packaging.controller";
import { validatePayload } from "../middleware/payload.middleware";
import { isAuthenticated } from "../middleware/auth.middleware";
import { 
  validateCompositionRequest,
  validateReportRequest,
  validateValidationRequest,
  validateBusinessRules,
  optimizeForPerformance,
  sanitizeCompositionRequest,
  rateLimit
} from "../middleware/composition-validation.middleware";

const router = Router();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

/**
 * GET /api/packaging/products/:productId
 * Get all packaging types for a product with stock information
 */
router.get('/products/:productId', packagingController.getPackagingsByProduct.bind(packagingController));

/**
 * GET /api/packaging/products/:productId/hierarchy
 * Get complete packaging hierarchy for a product
 */
router.get('/products/:productId/hierarchy', packagingController.getPackagingHierarchy.bind(packagingController));

/**
 * POST /api/packaging/scan
 * Scan packaging by barcode
 */
router.post('/scan', packagingController.scanBarcode.bind(packagingController));

/**
 * POST /api/packaging/optimize-picking
 * Optimize picking using packaging combinations
 */
router.post('/optimize-picking', packagingController.optimizePicking.bind(packagingController));

/**
 * POST /api/packaging/convert
 * Convert quantity between packaging types
 */
router.post('/convert', packagingController.convertQuantity.bind(packagingController));

// CRUD OPERATIONS

/**
 * POST /api/packaging
 * Create new packaging type
 */
router.post('/', (req: Request, res: Response) => packagingController.createPackaging(req as any, res));

/**
 * PUT /api/packaging/:id
 * Update existing packaging type
 */
router.put('/:id', packagingController.updatePackaging.bind(packagingController));

/**
 * DELETE /api/packaging/:id
 * Delete packaging type (soft delete)
 */
router.delete('/:id', packagingController.deletePackaging.bind(packagingController));

/**
 * GET /api/packaging/:id
 * Get packaging by ID
 */
router.get('/:id', packagingController.getPackagingById.bind(packagingController));

// HIERARCHY VALIDATION ROUTES

/**
 * GET /api/packaging/products/:productId/validate-hierarchy
 * Validate packaging hierarchy integrity for a product
 */
router.get('/products/:productId/validate-hierarchy', packagingController.validateHierarchyIntegrity.bind(packagingController));

/**
 * GET /api/packaging/:packagingId/hierarchy-path
 * Get complete hierarchy path for a packaging
 */
router.get('/:packagingId/hierarchy-path', packagingController.getHierarchyPath.bind(packagingController));

/**
 * POST /api/packaging/convert-between
 * Convert quantities between packaging types with detailed conversion path
 */
router.post('/convert-between', packagingController.convertBetweenPackagings.bind(packagingController));

/**
 * POST /api/packaging/create-example-hierarchy
 * Create example 3-level hierarchy for testing (1 → 2 → 10 units)
 */
router.post('/create-example-hierarchy', packagingController.createExampleHierarchy.bind(packagingController));

// COMPOSITION ROUTES

/**
 * POST /api/packaging/composition/calculate
 * Calculate optimal pallet composition for products
 */
router.post(
  '/composition/calculate',
  rateLimit(5, 60000), // 5 requests per minute for complex calculations
  sanitizeCompositionRequest,
  validateCompositionRequest,
  validateBusinessRules,
  optimizeForPerformance,
  (req: Request, res: Response) => packagingController.calculateOptimalComposition(req, res)
);

/**
 * POST /api/packaging/composition/validate
 * Validate packaging composition constraints
 */
router.post(
  '/composition/validate',
  sanitizeCompositionRequest,
  validateValidationRequest,
  validateBusinessRules,
  (req: Request, res: Response) => packagingController.validateComposition(req, res)
);

/**
 * POST /api/packaging/composition/report
 * Generate comprehensive composition report
 */
router.post(
  '/composition/report',
  validateReportRequest,
  (req: Request, res: Response) => packagingController.generateCompositionReport(req, res)
);

// COMPOSITION PERSISTENCE ROUTES

/**
 * POST /api/packaging/composition/save
 * Save composition to database
 */
router.post(
  '/composition/save',
  rateLimit(10, 60000), // 10 saves per minute
  sanitizeCompositionRequest,
  validateCompositionRequest,
  validateBusinessRules,
  (req: Request, res: Response) => packagingController.saveComposition(req as any, res)
);

/**
 * GET /api/packaging/composition/list
 * List saved compositions with pagination
 */
router.get('/composition/list', packagingController.listCompositions.bind(packagingController));

/**
 * GET /api/packaging/composition/:id
 * Get composition by ID
 */
router.get('/composition/:id', packagingController.getComposition.bind(packagingController));

/**
 * PATCH /api/packaging/composition/:id/status
 * Update composition status
 */
router.patch('/composition/:id/status', (req: Request, res: Response) => packagingController.updateCompositionStatus(req as any, res));

/**
 * DELETE /api/packaging/composition/:id
 * Delete composition (soft delete)
 */
router.delete('/composition/:id', packagingController.deleteComposition.bind(packagingController));

// ASSEMBLY/DISASSEMBLY ROUTES

/**
 * POST /api/packaging/composition/assemble
 * Assemble composition (create UCP from composition)
 */
router.post(
  '/composition/assemble',
  rateLimit(5, 60000), // 5 assembly operations per minute
  (req: Request, res: Response) => packagingController.assembleComposition(req as any, res)
);

/**
 * POST /api/packaging/composition/disassemble
 * Disassemble composition
 */
router.post(
  '/composition/disassemble',
  rateLimit(5, 60000), // 5 disassembly operations per minute
  (req: Request, res: Response) => packagingController.disassembleComposition(req as any, res)
);

export default router;