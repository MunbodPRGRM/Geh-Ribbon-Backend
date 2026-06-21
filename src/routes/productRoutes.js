import { Router } from "express";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addImages,
  removeImage,
} from "../controllers/productController.js";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth.js";

const router = Router();

// --- public ---
router.get("/", optionalAuth, listProducts); // optionalAuth: admin เห็น inactive ได้
router.get("/:id", getProduct);

// --- admin ---
router.post("/", requireAuth, requireAdmin, createProduct);
router.put("/:id", requireAuth, requireAdmin, updateProduct);
router.delete("/:id", requireAuth, requireAdmin, deleteProduct);
router.post("/:id/images", requireAuth, requireAdmin, addImages);
router.delete("/:id/images/:imageId", requireAuth, requireAdmin, removeImage);

export default router;
