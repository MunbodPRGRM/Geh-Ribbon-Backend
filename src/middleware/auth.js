import { verifyToken } from "../lib/jwt.js";
import { COOKIE_NAME } from "../lib/cookie.js";
import prisma from "../lib/prisma.js";

// ต้องล็อกอิน — อ่าน JWT จาก cookie, verify, แล้วแนบ user ปัจจุบันไว้ที่ req.user
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    if (!user) {
      return res.status(401).json({ message: "ไม่พบบัญชีผู้ใช้" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "เซสชันไม่ถูกต้องหรือหมดอายุ" });
  }
}

// ไม่บังคับล็อกอิน — ถ้ามี cookie ที่ valid ก็แนบ req.user ให้ ถ้าไม่มี/ไม่ valid ก็ปล่อยผ่าน
// ใช้กับ endpoint ที่เป็น public แต่อยากรู้ว่าใครเรียก (เช่น admin ขอเห็นสินค้าปิดการขาย)
export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, phone: true, role: true },
      });
      if (user) req.user = user;
    }
  } catch {
    // token ไม่ valid -> ถือว่าไม่ได้ล็อกอิน ไม่ต้อง error
  }
  next();
}

// ต้องเป็น ADMIN — ใช้ต่อจาก requireAuth เสมอ (พึ่ง req.user)
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "ต้องเป็นผู้ดูแลระบบเท่านั้น" });
  }
  next();
}
