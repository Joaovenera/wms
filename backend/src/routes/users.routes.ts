import { Router } from "express";
import { isAuthenticated, requireAdmin, requireManagerOrAdmin } from "../middleware/auth.middleware";
import { usersController } from "../controllers/users.controller";

const router = Router();

// Users routes with proper authorization
router.get('/', isAuthenticated, requireManagerOrAdmin, usersController.getUsers.bind(usersController));
router.get('/:id', isAuthenticated, usersController.getUserById.bind(usersController));
router.post('/', isAuthenticated, requireAdmin, usersController.createUser.bind(usersController));
router.put('/:id', isAuthenticated, requireAdmin, usersController.updateUser.bind(usersController));
router.put('/:id/role', isAuthenticated, requireAdmin, usersController.updateUserRole.bind(usersController));
router.delete('/:id', isAuthenticated, requireAdmin, usersController.deleteUser.bind(usersController));

export default router;
