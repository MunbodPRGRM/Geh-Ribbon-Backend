// Seed ข้อมูลตั้งต้น: admin คนแรก + customer ตัวอย่าง + สินค้าตัวอย่างพร้อมรูป
// รัน: npm run seed   (idempotent — รันซ้ำได้ ไม่สร้าง user ซ้ำ, สินค้าจะสร้างเฉพาะตอน DB ยังว่าง)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ปรับค่าได้ผ่าน env (ไม่ตั้งก็ใช้ค่า default)
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@gehribbon.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin1234";
const CUSTOMER_EMAIL = process.env.SEED_CUSTOMER_EMAIL || "demo@gehribbon.com";
const CUSTOMER_PASSWORD = process.env.SEED_CUSTOMER_PASSWORD || "demo1234";

const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

const SAMPLE_PRODUCTS = [
  {
    name: "โบว์ติดผมริบบิ้นซาติน สีชมพู",
    description: "โบว์ติดผมงานแฮนด์เมด ทำจากริบบิ้นซาตินเนื้อนุ่ม สีชมพูหวาน",
    price: 89,
    stock: 50,
    images: [img("ribbon-pink-1"), img("ribbon-pink-2")],
  },
  {
    name: "ช่อดอกไม้ริบบิ้นวันรับปริญญา",
    description: "ช่อดอกไม้ประดิษฐ์จากริบบิ้น คงทน ไม่เหี่ยว เก็บเป็นที่ระลึกได้",
    price: 350,
    stock: 20,
    images: [img("ribbon-bouquet-1"), img("ribbon-bouquet-2"), img("ribbon-bouquet-3")],
  },
  {
    name: "พวงกุญแจริบบิ้นน่ารัก",
    description: "พวงกุญแจโบว์ริบบิ้น ห้อยกระเป๋าได้ มีหลายสีให้เลือก",
    price: 59,
    stock: 100,
    images: [img("ribbon-keychain-1")],
  },
  {
    name: "เข็มกลัดโบว์ริบบิ้นวินเทจ",
    description: "เข็มกลัดโบว์สไตล์วินเทจ ติดเสื้อหรือกระเป๋าเพิ่มความน่ารัก",
    price: 120,
    stock: 30,
    images: [img("ribbon-pin-1"), img("ribbon-pin-2")],
  },
  {
    name: "ที่คาดผมริบบิ้นโบว์ใหญ่",
    description: "ที่คาดผมแต่งโบว์ริบบิ้นชิ้นใหญ่ ใส่สบาย ไม่บีบหัว",
    price: 150,
    stock: 15,
    images: [img("ribbon-headband-1"), img("ribbon-headband-2")],
  },
  {
    name: "กล่องของขวัญผูกโบว์ริบบิ้น",
    description: "กล่องของขวัญพร้อมผูกโบว์ริบบิ้นสวยงาม สั่งทำตามโอกาสได้",
    price: 250,
    stock: 25,
    images: [img("ribbon-gift-1"), img("ribbon-gift-2")],
  },
];

async function main() {
  // --- admin (upsert กันซ้ำ) ---
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(ADMIN_PASSWORD, 10),
      name: "ผู้ดูแลระบบ",
      role: "ADMIN",
    },
  });
  console.log(`✓ admin     : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  // --- customer ตัวอย่าง ---
  await prisma.user.upsert({
    where: { email: CUSTOMER_EMAIL },
    update: {},
    create: {
      email: CUSTOMER_EMAIL,
      password: await bcrypt.hash(CUSTOMER_PASSWORD, 10),
      name: "ลูกค้าทดลอง",
      phone: "0800000000",
      role: "CUSTOMER",
    },
  });
  console.log(`✓ customer  : ${CUSTOMER_EMAIL} / ${CUSTOMER_PASSWORD}`);

  // --- สินค้า (สร้างเฉพาะตอนยังไม่มีสินค้าเลย เพื่อให้ idempotent) ---
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`• ข้ามการสร้างสินค้า (มีอยู่แล้ว ${existing} รายการ)`);
  } else {
    for (const p of SAMPLE_PRODUCTS) {
      await prisma.product.create({
        data: {
          name: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock,
          images: {
            create: p.images.map((url, idx) => ({ url, publicId: "", sortOrder: idx })),
          },
        },
      });
    }
    console.log(`✓ สร้างสินค้าตัวอย่าง ${SAMPLE_PRODUCTS.length} รายการ`);
  }

  console.log("\nseed เสร็จสมบูรณ์");
}

main()
  .catch((e) => {
    console.error("seed ล้มเหลว:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
