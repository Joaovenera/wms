import { Router } from "express";
import { isAuthenticated, requireManagerOrAdmin } from "../middleware/auth.middleware";
import { imageUploadMiddleware } from "../middleware/payload.middleware";
import { productsController } from "../controllers/products.controller";

const router = Router();

// Product routes
router.get('/', isAuthenticated, productsController.getProducts.bind(productsController));
router.get('/:id', isAuthenticated, productsController.getProductById.bind(productsController));
router.get('/sku/:sku', isAuthenticated, productsController.getProductBySku.bind(productsController));
router.post('/', isAuthenticated, requireManagerOrAdmin, productsController.createProduct.bind(productsController));
router.put('/:id', isAuthenticated, requireManagerOrAdmin, productsController.updateProduct.bind(productsController));
router.delete('/:id', isAuthenticated, requireManagerOrAdmin, productsController.deleteProduct.bind(productsController));

// Product Photo routes
router.get('/:id/photos', isAuthenticated, productsController.getProductPhotos.bind(productsController));
router.get('/:id/photos/primary', isAuthenticated, productsController.getPrimaryPhoto.bind(productsController));
// Photo upload route with high payload limit for base64 images
router.post('/:id/photos', imageUploadMiddleware, isAuthenticated, productsController.addProductPhoto.bind(productsController));
router.get('/:id/photo-history', isAuthenticated, productsController.getProductPhotoHistory.bind(productsController));

export default router;
