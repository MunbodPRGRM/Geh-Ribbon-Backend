import { Router } from "express";
import {
  listAllOrders,
  getOrderAdmin,
  updateOrderStatus,
  listUsers,
  updateUserRole,
} from "../controllers/adminController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// ทุก endpoint ต้องล็อกอิน + เป็น ADMIN
router.use(requireAuth, requireAdmin);

// orders
router.get("/orders", listAllOrders);
router.get("/orders/:id", getOrderAdmin);
router.patch("/orders/:id/status", updateOrderStatus);

// users
router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);

export default router;
