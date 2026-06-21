import prisma from "../lib/prisma.js";

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

const SHIPPING_FIELDS = {
  shippingName: "ชื่อผู้รับ",
  shippingPhone: "เบอร์โทร",
  shippingAddress: "ที่อยู่",
  shippingProvince: "จังหวัด",
  shippingPostalCode: "รหัสไปรษณีย์",
};

function genOrderNumber(seq, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `ORD-${y}${m}${d}-${String(seq).padStart(4, "0")}`;
}

// สร้าง order จากตะกร้าใน transaction เดียว + retry ถ้า orderNumber ชนกัน (P2002)
async function createOrderFromCart(userId, shipping, paymentMethod, attempt = 0) {
  try {
    return await prisma.$transaction(async (tx) => {
      const cart = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });
      if (cart.length === 0) {
        const e = new Error("ตะกร้าว่าง ไม่สามารถสั่งซื้อได้");
        e.status = 400;
        throw e;
      }

      // เช็คสินค้าปิดการขายก่อน (สต็อกจะเช็ค + ตัดแบบ atomic ตอน decrement)
      for (const it of cart) {
        if (!it.product.isActive) {
          const e = new Error(`สินค้า "${it.product.name}" ปิดการขายแล้ว`);
          e.status = 400;
          throw e;
        }
      }

      const totalAmount = cart.reduce(
        (sum, it) => sum + Number(it.product.price) * it.quantity,
        0
      );

      // running number ต่อวัน
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const countToday = await tx.order.count({ where: { createdAt: { gte: start } } });
      const orderNumber = genOrderNumber(countToday + 1 + attempt);

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          totalAmount,
          ...shipping,
          paymentMethod: paymentMethod || "mock",
          status: "PENDING",
          paymentStatus: "UNPAID",
          items: {
            create: cart.map((it) => ({
              productId: it.productId,
              productName: it.product.name, // snapshot กันสินค้าเปลี่ยนชื่อ/ราคา/ถูกลบทีหลัง
              price: it.product.price,
              quantity: it.quantity,
              subtotal: Number(it.product.price) * it.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // ตัดสต็อกแบบ atomic — ตัดเฉพาะเมื่อ stock เพียงพอ (กัน oversell ตอน concurrent)
      for (const it of cart) {
        const upd = await tx.product.updateMany({
          where: { id: it.productId, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (upd.count === 0) {
          const e = new Error(`สินค้า "${it.product.name}" สต็อกไม่พอ`);
          e.status = 400;
          throw e;
        }
      }

      await tx.cartItem.deleteMany({ where: { userId } });
      return order;
    });
  } catch (e) {
    if (e.code === "P2002" && attempt < 5) {
      return createOrderFromCart(userId, shipping, paymentMethod, attempt + 1);
    }
    throw e;
  }
}

// POST /api/orders  — checkout จากตะกร้า
export async function checkout(req, res, next) {
  try {
    const body = req.body ?? {};
    const shipping = {};
    for (const [field, label] of Object.entries(SHIPPING_FIELDS)) {
      const v = body[field];
      if (!v || !String(v).trim()) {
        return res.status(400).json({ message: `กรุณากรอก${label}` });
      }
      shipping[field] = String(v).trim();
    }

    const order = await createOrderFromCart(req.user.id, shipping, body.paymentMethod);
    res.status(201).json({ order });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
}

// GET /api/orders  — ประวัติคำสั่งซื้อของตัวเอง
export async function listOrders(req, res, next) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id  — รายละเอียดออเดอร์ (เจ้าของหรือ admin เท่านั้น)
export async function getOrder(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order || (order.userId !== req.user.id && req.user.role !== "ADMIN")) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// POST /api/orders/:id/pay  — mock payment (PENDING -> PAID)
export async function payOrder(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    }
    if (order.status !== "PENDING") {
      return res.status(400).json({ message: "คำสั่งซื้อนี้ชำระเงินไม่ได้ (ไม่อยู่ในสถานะรอชำระ)" });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: new Date(),
        paymentRef: `MOCK-${Date.now()}`,
      },
      include: { items: true },
    });
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/orders/:id/cancel  — ยกเลิก (ก่อนจัดส่ง) + คืนสต็อก
export async function cancelOrder(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    }
    if (["SHIPPED", "COMPLETED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({ message: "คำสั่งซื้อนี้ยกเลิกไม่ได้แล้ว" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // คืนสต็อกตามจำนวนที่สั่ง
      for (const it of order.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity } },
        });
      }
      return tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          // ถ้าจ่ายแล้ว (mock) ถือว่าคืนเงิน
          paymentStatus: order.paymentStatus === "PAID" ? "REFUNDED" : order.paymentStatus,
        },
        include: { items: true },
      });
    });

    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}
