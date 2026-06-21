-- ============================================================
-- Geh Ribbon (เก๋ริบบิ้น) — PostgreSQL schema
-- แปลงจาก prisma/schema.prisma ให้ตรงกับที่ Prisma migrate จะ generate
-- (ชื่อตารางเป็น snake_case ตาม @@map, ชื่อคอลัมน์เป็น camelCase ใส่ "..." )
--
-- วิธีใช้ใน pgAdmin4:
--   1) คลิกขวาที่ Databases -> Create -> Database... ตั้งชื่อ  geh_ribbon  แล้ว Save
--      (หรือรันใน Query Tool ที่ต่อกับ DB "postgres":  CREATE DATABASE geh_ribbon;)
--   2) คลิกที่ database  geh_ribbon  -> เปิด Query Tool
--   3) วางไฟล์นี้ทั้งหมดแล้ว Run (F5)
--
-- หมายเหตุ: คอลัมน์ "updatedAt" ปกติให้ Prisma จัดการค่าให้ตอน update ในชั้นแอป
--           ถ้าจะใช้ DB ล้วน ๆ โดยยังไม่มี backend ดู section TRIGGER ท้ายไฟล์ (comment ไว้)
-- ============================================================

-- ---------- Enums ----------
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'FAILED', 'REFUNDED');

-- ---------- users ----------
CREATE TABLE "users" (
    "id"        SERIAL        NOT NULL,
    "email"     TEXT          NOT NULL,
    "password"  TEXT          NOT NULL,
    "name"      TEXT          NOT NULL,
    "phone"     TEXT,
    "role"      "Role"        NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");

-- ---------- products ----------
CREATE TABLE "products" (
    "id"          SERIAL         NOT NULL,
    "name"        TEXT           NOT NULL,
    "description" TEXT,
    "price"       DECIMAL(10, 2) NOT NULL,
    "stock"       INTEGER        NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN        NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)   NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- ---------- product_images ----------
CREATE TABLE "product_images" (
    "id"        SERIAL       NOT NULL,
    "productId" INTEGER      NOT NULL,
    "url"       TEXT         NOT NULL,
    "publicId"  TEXT         NOT NULL,
    "sortOrder" INTEGER      NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_images_productId_idx" ON "product_images" ("productId");

-- ---------- cart_items ----------
CREATE TABLE "cart_items" (
    "id"        SERIAL       NOT NULL,
    "userId"    INTEGER      NOT NULL,
    "productId" INTEGER      NOT NULL,
    "quantity"  INTEGER      NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cart_items_userId_productId_key" ON "cart_items" ("userId", "productId");

-- ---------- orders ----------
CREATE TABLE "orders" (
    "id"                 SERIAL          NOT NULL,
    "orderNumber"        TEXT            NOT NULL,
    "userId"             INTEGER         NOT NULL,
    "status"             "OrderStatus"   NOT NULL DEFAULT 'PENDING',
    "totalAmount"        DECIMAL(10, 2)  NOT NULL,
    "shippingName"       TEXT            NOT NULL,
    "shippingPhone"      TEXT            NOT NULL,
    "shippingAddress"    TEXT            NOT NULL,
    "shippingProvince"   TEXT            NOT NULL,
    "shippingPostalCode" TEXT            NOT NULL,
    "paymentMethod"      TEXT,
    "paymentStatus"      "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentRef"         TEXT,
    "paidAt"             TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders" ("orderNumber");
CREATE INDEX "orders_userId_idx" ON "orders" ("userId");

-- ---------- order_items ----------
CREATE TABLE "order_items" (
    "id"          SERIAL         NOT NULL,
    "orderId"     INTEGER        NOT NULL,
    "productId"   INTEGER        NOT NULL,
    "productName" TEXT           NOT NULL,
    "price"       DECIMAL(10, 2) NOT NULL,
    "quantity"    INTEGER        NOT NULL,
    "subtotal"    DECIMAL(10, 2) NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_items_orderId_idx" ON "order_items" ("orderId");

-- ---------- Foreign keys ----------
ALTER TABLE "product_images"
    ADD CONSTRAINT "product_images_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- (ทางเลือก) TRIGGER อัปเดต "updatedAt" อัตโนมัติ
-- เปิดใช้ section นี้เฉพาะกรณีใช้ DB ตรง ๆ โดยยังไม่มี backend (Prisma) จัดการให้
-- ถ้าจะใช้ Prisma เป็นหลัก ไม่ต้องเปิด (Prisma เซ็ตค่า updatedAt ให้เองตอน update)
-- ------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION set_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW."updatedAt" = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER users_set_updated_at      BEFORE UPDATE ON "users"      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- CREATE TRIGGER products_set_updated_at   BEFORE UPDATE ON "products"   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- CREATE TRIGGER cart_items_set_updated_at BEFORE UPDATE ON "cart_items" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- CREATE TRIGGER orders_set_updated_at     BEFORE UPDATE ON "orders"     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ============================================================
