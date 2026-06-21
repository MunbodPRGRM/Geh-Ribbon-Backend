import prisma from "../lib/prisma.js";

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

const STATUSES = ["PENDING", "PAID", "SHIPPED", "COMPLETED", "CANCELLED"];

// state machine ของสถานะออเดอร์ — อนุญาตเปลี่ยนได้เฉพาะที่ระบุ
const ALLOWED_TRANSITIONS = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

// ---------- Orders ----------

// GET /api/admin/orders?status=&page=&limit=
export async function listAllOrders(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status;

    const where = {};
    if (status && STATUSES.includes(status)) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/orders/:id
export async function getOrderAdmin(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/orders/:id/status  { status }
export async function updateOrderStatus(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const status = req.body?.status;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
    }

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ message: `เปลี่ยนสถานะจาก ${order.status} เป็น ${status} ไม่ได้` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data = { status };

      if (status === "CANCELLED") {
        // คืนสต็อกตามจำนวนที่สั่ง + ถ้าจ่ายแล้ว = คืนเงิน (mock)
        for (const it of order.items) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
        if (order.paymentStatus === "PAID") data.paymentStatus = "REFUNDED";
      }

      if (status === "PAID" && order.paymentStatus !== "PAID") {
        // admin ยืนยันการชำระเงินเอง (mock)
        data.paymentStatus = "PAID";
        data.paidAt = new Date();
        data.paymentRef = order.paymentRef || `MOCK-ADMIN-${Date.now()}`;
      }

      return tx.order.update({
        where: { id },
        data,
        include: { items: true, user: { select: { id: true, name: true, email: true } } },
      });
    });

    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}

// ---------- Users ----------

// GET /api/admin/users?search=&page=&limit=
export async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = (req.query.search || "").trim();

    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/users/:id/role  { role }
export async function updateUserRole(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const role = req.body?.role;
    if (!["CUSTOMER", "ADMIN"].includes(role)) {
      return res.status(400).json({ message: "role ไม่ถูกต้อง" });
    }
    // กันแอดมินลดสิทธิ์ตัวเองจนล็อกตัวเองออก
    if (id === req.user.id) {
      return res.status(400).json({ message: "ไม่สามารถเปลี่ยน role ของตัวเองได้" });
    }

    const exists = await prisma.user.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
