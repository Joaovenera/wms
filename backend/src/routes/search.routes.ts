import { Router } from "express";
import { unifiedSearch } from "../controllers/search.controller";
import { isAuthenticated } from "../middleware/auth.middleware"; // Assuming you have an auth middleware

const router = Router();

// Define the unified search route
router.get("/", isAuthenticated, unifiedSearch);

export default router;
