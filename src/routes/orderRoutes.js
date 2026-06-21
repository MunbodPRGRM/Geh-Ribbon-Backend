import { Router } from "express";
import {
  checkout,
  listOrders,
  getOrder,
  payOrder,
  cancelOrder,
} from "../controllers/orderController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ทุก endpoint ต้องล็อกอิน
router.use(requireAuth);

router.post("/", checkout);
router.get("/", listOrders);
router.get("/:id", getOrder);
router.post("/:id/pay", payOrder);
router.post("/:id/cancel", cancelOrder);

export default router;
