# เก๋ริบบิ้น (Geh Ribbon) — Backend

Backend ของเว็บอีคอมเมิร์ซขายงานฝีมือริบบิ้น เป็น repo แยกต่างหากบน GitHub (ดูภาพรวมทั้งโปรเจกต์ที่ `../CLAUDE.md`)

## Stack
- Node.js + Express 5 (ESM, `"type": "module"`)
- Prisma ORM **v6** + PostgreSQL — ⚠️ pin v6 ไว้ตั้งใจ (Prisma 7 เลิกรองรับ `url` ใน schema + บังคับ driver adapter)
- Auth: JWT เก็บใน httpOnly cookie (login เดียวกันทั้งลูกค้า/แอดมิน แยกด้วย `role`)
- รูปภาพสินค้า: Cloudinary (อัปโหลดผ่าน `POST /api/admin/upload` ด้วย multer memory storage + `upload_stream`); ยังรับเป็น URL ตรง ๆ ได้ด้วย. ถ้าไม่ตั้ง env Cloudinary → endpoint อัปโหลดคืน 503 แต่ส่วนอื่นทำงานปกติ

## การรัน
```bash
npm install
# ตั้งค่า .env ก่อน (ดู .env.example) — DATABASE_URL, JWT_SECRET ฯลฯ
npx prisma migrate dev      # สร้าง/ซิงค์ตาราง (มี migration history แล้ว)
npm run seed                # สร้าง admin + customer + สินค้าตัวอย่าง (idempotent)
npm run dev                 # รัน dev server (nodemon) ที่ http://localhost:4000
```
script อื่น: `npm start`, `npm run prisma:studio`, `npm run prisma:generate`

บัญชี seed เริ่มต้น (เปลี่ยนได้ผ่าน env `SEED_ADMIN_EMAIL` ฯลฯ):
- admin: `admin@gehribbon.com` / `admin1234`
- customer: `demo@gehribbon.com` / `demo1234`

## โครงสร้าง
```
prisma/
  schema.prisma          # source of truth ของ DB
  migrations/            # Prisma migrate (baseline 0_init)
  seed.js                # seed ข้อมูลตั้งต้น
schema.sql               # DDL อ้างอิง (เทียบเท่า migrate output) — ไม่จำเป็นต้องรันถ้าใช้ migrate
src/
  server.js              # entrypoint (เช็ค DB ก่อน listen + graceful shutdown)
  app.js                 # express app, middleware, mount routes, 404 + error handler
  config/env.js          # โหลด/ตรวจ env รวมศูนย์
  lib/prisma.js          # PrismaClient singleton
  lib/jwt.js             # sign/verify JWT
  lib/cookie.js          # set/clear auth cookie (httpOnly)
  middleware/auth.js     # requireAuth / requireAdmin / optionalAuth
  controllers/           # auth, product, cart, order, admin
  routes/                # auth, product, cart, order, admin
```

## API endpoints (ครบและทดสอบแล้ว ~73 เคส)
- **`/api/auth`** — `POST /register`, `POST /login`, `POST /logout`, `GET /me`
- **`/api/products`** — public: `GET /`, `GET /:id`; admin: `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/images`, `DELETE /:id/images/:imageId`
- **`/api/cart`** (ต้องล็อกอิน) — `GET /`, `POST /`, `PUT /:productId`, `DELETE /:productId`, `DELETE /`
- **`/api/orders`** (ต้องล็อกอิน) — `POST /` (checkout), `GET /`, `GET /:id`, `POST /:id/pay` (mock), `POST /:id/cancel`
- **`/api/admin`** (ต้องเป็น ADMIN) — `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`, `GET /users`, `PATCH /users/:id/role`, `POST /upload` (multipart field `images`, อัปโหลดไป Cloudinary → `[{url, publicId}]`)
- `GET /api/health` — health check

## Database Schema (สรุปจาก schema.prisma)
- `User` — มี `role` (CUSTOMER/ADMIN)
- `Product` + `ProductImage` — 1 สินค้าหลายรูป (`url` + `publicId` + `sortOrder`)
- `CartItem` — unique (userId, productId) กันแถวซ้ำ
- `Order` — snapshot ที่อยู่จัดส่ง + field รองรับ payment gateway จริงในอนาคต (`paymentMethod`/`paymentStatus`/`paymentRef`/`paidAt`) ตอนนี้ mock
- `OrderItem` — snapshot ชื่อ/ราคา ณ ตอนสั่งซื้อ

## หลักการที่ใช้ (สำคัญ)
- ตัดสต็อกตอน checkout แบบ atomic (`updateMany` + เงื่อนไข `stock >= qty`) กัน oversell; คืนสต็อกตอน cancel
- order status เป็น state machine (PENDING→PAID→SHIPPED→COMPLETED / CANCELLED) เช็คก่อนเปลี่ยน
- mock payment 2 จังหวะ: checkout = PENDING/UNPAID → pay = PAID (เผื่อเสียบ gateway จริงทีหลัง)
- ราคาเป็น `Decimal` ใน DB — คิดเงินฝั่ง server ด้วย `Number(price)`

## งานที่ยังไม่ได้ทำ (เสริม/อนาคต)
1. ตั้งค่า env Cloudinary จริง (`CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`) เพื่อเปิดใช้อัปโหลด
2. ลบรูปเก่าจาก Cloudinary ตอน update product (replace images) / delete product (ตอนนี้ทำเฉพาะ removeImage)
3. (เสริม) rate limiting, validation library (zod), เทส automated ถาวร
