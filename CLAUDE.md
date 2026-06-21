# เก๋ริบบิ้น (Geh Ribbon) — Backend

Backend ของเว็บอีคอมเมิร์ซขายงานฝีมือริบบิ้น เป็น repo แยกต่างหากบน GitHub (ดูภาพรวมทั้งโปรเจกต์ที่ `../CLAUDE.md`)

## Stack
- Node.js + Express
- Prisma ORM + PostgreSQL
- Auth: JWT (แนะนำเก็บใน httpOnly cookie)
- เก็บรูปภาพสินค้าด้วย Cloudinary (ยังไม่ได้ติดตั้ง SDK)

## สถานะปัจจุบัน
- มีแค่ `prisma/schema.prisma` ที่ออกแบบไว้แล้ว ยังไม่ได้ setup โปรเจกต์ Express จริง (ยังไม่มี `package.json`, `src/`, server entrypoint)
- ยังไม่ได้เชื่อมต่อ PostgreSQL จริง ต้องสร้าง `.env` พร้อม `DATABASE_URL` เอง (ดูตัวอย่างรูปแบบใน schema.prisma)

⚠️ **หมายเหตุ:** มี `node_modules/`, `package.json`, `.env` ค้างอยู่ในโฟลเดอร์นี้จากการทดลองรันคำสั่งของ Claude ก่อนหน้านี้ ซึ่งไม่ใช่ของจริง (ไม่ได้มาจาก `npm init` ของโปรเจกต์นี้) ลบไม่สำเร็จผ่าน sandbox เนื่องจากข้อจำกัดของ shared-folder mount — ควรลบไฟล์เหล่านี้เองก่อนเริ่ม setup โปรเจกต์จริง

## Database Schema (สรุปจาก schema.prisma)
- `User` — มี `role` (CUSTOMER/ADMIN) ใช้ login เดียวกันทั้งลูกค้าและแอดมิน
- `Product` + `ProductImage` — สินค้า 1 ชิ้นมีได้หลายรูป (เก็บ `url` + `publicId` จาก Cloudinary)
- `CartItem` — unique (userId, productId) กันแถวซ้ำ
- `Order` — เก็บ snapshot ที่อยู่จัดส่ง, มี `paymentMethod`/`paymentStatus`/`paymentRef`/`paidAt` รองรับเชื่อม payment gateway จริงในอนาคต (Omise/Stripe/2C2P) ตอนนี้ใช้ mock
- `OrderItem` — snapshot ชื่อ/ราคาสินค้า ณ ตอนสั่งซื้อ

## ขอบเขตหน้า Admin (ส่วนที่ backend ต้องรองรับ)
- จัดการสินค้า (CRUD + อัปโหลด/ลบรูปผ่าน Cloudinary)
- จัดการคำสั่งซื้อ (ดู/เปลี่ยนสถานะออเดอร์)
- จัดการผู้ใช้ (ดูรายชื่อ/ระงับบัญชี)
- ใช้ JWT + role check จาก endpoint login เดียวกัน ไม่มี endpoint login แยกสำหรับ admin

## งานที่ยังไม่ได้ทำ (ขั้นต่อไป)
1. `npm init` + ติดตั้ง express, prisma, @prisma/client, bcrypt, jsonwebtoken, cloudinary
2. `npx prisma migrate dev` เพื่อสร้างตารางจริงใน PostgreSQL
3. เขียน auth routes (register/login) + middleware เช็ค JWT และ role
4. เขียน REST API: products, cart, orders, admin/*
