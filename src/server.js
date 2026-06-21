import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./lib/prisma.js";

async function start() {
  try {
    // เช็คว่าต่อ DB ได้ก่อนเปิดรับ request
    await prisma.$connect();
    console.log("✓ เชื่อมต่อฐานข้อมูลสำเร็จ");

    app.listen(env.port, () => {
      console.log(`✓ API รันที่ http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    console.error("✗ เริ่มเซิร์ฟเวอร์ไม่สำเร็จ:", err.message);
    process.exit(1);
  }
}

// ปิด connection ให้เรียบร้อยตอน process ถูกปิด
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
