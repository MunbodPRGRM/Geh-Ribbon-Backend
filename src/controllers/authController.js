import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { setAuthCookie, clearAuthCookie } from "../lib/cookie.js";

const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// คืนเฉพาะ field ที่ปลอดภัยส่งให้ client (ไม่รวม password hash)
function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role };
}

export async function register(req, res, next) {
  try {
    const { email, password, name, phone } = req.body ?? {};

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "อีเมลไม่ถูกต้อง" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "กรุณากรอกชื่อ" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "อีเมลนี้ถูกใช้งานแล้ว" });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name.trim(), phone: phone || null },
    });

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, token);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "กรุณากรอกอีเมลและรหัสผ่าน" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // ข้อความเดียวกันทั้งกรณีไม่เจอ user และรหัสผิด เพื่อไม่ให้เดาว่าอีเมลมีอยู่จริงไหม
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    const token = signToken({ userId: user.id, role: user.role });
    setAuthCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export function logout(req, res) {
  clearAuthCookie(res);
  res.json({ message: "ออกจากระบบแล้ว" });
}

// ข้อมูลผู้ใช้ปัจจุบัน (req.user มาจาก requireAuth) — frontend ใช้เช็คสถานะล็อกอิน + role
export function me(req, res) {
  res.json({ user: req.user });
}
