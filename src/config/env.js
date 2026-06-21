import "dotenv/config";

// อ่าน + ตรวจ env ที่จำเป็นในที่เดียว เพื่อให้ fail เร็วถ้าตั้งค่าไม่ครบ
function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`ตัวแปร env "${key}" ยังไม่ได้ตั้งค่า — ดู .env.example`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
};
