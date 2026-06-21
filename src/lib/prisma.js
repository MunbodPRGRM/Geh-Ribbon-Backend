import { PrismaClient } from "@prisma/client";

// PrismaClient instance เดียวใช้ร่วมทั้งแอป (กัน connection รั่วตอน dev/hot-reload)
const prisma = new PrismaClient();

export default prisma;
