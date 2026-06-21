import { env } from "../config/env.js";

export const COOKIE_NAME = "token";

// แปลงรูปแบบ "7d" / "12h" / "30m" -> มิลลิวินาที (ใช้ตั้ง maxAge ของ cookie ให้ตรงกับอายุ JWT)
function expiresInMs(str) {
  const m = /^(\d+)([dhm])$/.exec(str);
  if (!m) return 7 * 24 * 60 * 60 * 1000; // default 7 วัน
  const n = Number(m[1]);
  const mult = m[2] === "d" ? 86400000 : m[2] === "h" ? 3600000 : 60000;
  return n * mult;
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JS ฝั่ง client อ่านไม่ได้ (กัน XSS ขโมย token)
    secure: env.isProd, // ส่งผ่าน https เท่านั้นตอน production
    sameSite: env.isProd ? "none" : "lax",
    maxAge: expiresInMs(env.jwtExpiresIn),
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
