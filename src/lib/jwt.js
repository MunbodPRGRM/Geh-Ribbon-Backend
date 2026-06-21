import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// เซ็น JWT (payload เก็บแค่ userId + role พอ — ข้อมูลอื่นดึงจาก DB ตอนใช้งาน)
export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
