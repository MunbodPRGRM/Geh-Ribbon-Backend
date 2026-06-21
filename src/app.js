import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.js";

const app = express();

// --- Global middleware ---
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: env.clientOrigin, // อนุญาตเฉพาะ frontend
    credentials: true, // ให้ส่ง/รับ cookie (JWT httpOnly) ข้าม origin ได้
  })
);

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "geh-ribbon-backend" });
});

// --- Routes (จะ mount ใน Phase 2) ---
// app.use("/api/auth", authRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/cart", cartRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api/admin", adminRoutes);

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
