import { Router } from "express";
import {
  getCart,
  addToCart,
  setQuantity,
  removeItem,
  clearCart,
} from "../controllers/cartController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ทุก endpoint ของตะกร้าต้องล็อกอิน
router.use(requireAuth);

router.get("/", getCart);
router.post("/", addToCart);
router.delete("/", clearCart);
router.put("/:productId", setQuantity);
router.delete("/:productId", removeItem);

export default router;
