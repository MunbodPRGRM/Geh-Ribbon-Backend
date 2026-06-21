import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

// อยู่หลัง reverse proxy ของ host (Render/Railway/Fly/ฯลฯ) ตอน production
// ให้ Express เชื่อ X-Forwarded-* เพื่อรู้ว่าเป็น HTTPS จริง (จำเป็นกับ secure cookie)
if (env.isProd) app.set("trust proxy", 1);

// --- Global middleware ---
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    // อนุญาตเฉพาะ frontend ที่กำหนด (รองรับหลาย origin: prod + preview)
    // ไม่มี origin (เช่น curl/health check server-to-server) ก็ปล่อยผ่าน
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: ไม่อนุญาต origin ${origin}`));
    },
    credentials: true, // ให้ส่ง/รับ cookie (JWT httpOnly) ข้าม origin ได้
  })
);

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "geh-ribbon-backend" });
});

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({ message: "ไม่พบ endpoint นี้" });
});

// --- Error handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
  });
});

export default app;
