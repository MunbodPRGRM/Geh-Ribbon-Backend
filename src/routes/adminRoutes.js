import { Router } from "express";
import {
  listAllOrders,
  getOrderAdmin,
  updateOrderStatus,
  listUsers,
  updateUserRole,
} from "../controllers/adminController.js";
import { uploadImages } from "../controllers/uploadController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

// ทุก endpoint ต้องล็อกอิน + เป็น ADMIN
router.use(requireAuth, requireAdmin);

// อัปโหลดรูปสินค้าไป Cloudinary
router.post("/upload", upload.array("images", 10), uploadImages);

// orders
router.get("/orders", listAllOrders);
router.get("/orders/:id", getOrderAdmin);
router.patch("/orders/:id/status", updateOrderStatus);

// users
router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);

export default router;
