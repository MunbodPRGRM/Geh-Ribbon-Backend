import prisma from "../lib/prisma.js";

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

// รวมข้อมูลตะกร้าของ user + คำนวณยอด (price เป็น Decimal -> แปลงเป็น number ตอนคิดเงิน)
async function getCartResponse(userId) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: { include: { images: { orderBy: { sortOrder: "asc" } } } } },
    orderBy: { createdAt: "asc" },
  });

  let totalAmount = 0;
  let totalItems = 0;
  const mapped = items.map((it) => {
    const subtotal = Number(it.product.price) * it.quantity;
    totalAmount += subtotal;
    totalItems += it.quantity;
    return {
      id: it.id,
      productId: it.productId,
      quantity: it.quantity,
      subtotal,
      product: it.product,
    };
  });

  return { items: mapped, totalItems, totalAmount };
}

// GET /api/cart
export async function getCart(req, res, next) {
  try {
    res.json(await getCartResponse(req.user.id));
  } catch (err) {
    next(err);
  }
}

// POST /api/cart  { productId, quantity? }  — เพิ่มลงตะกร้า (ถ้ามีอยู่แล้วบวกจำนวนเพิ่ม)
export async function addToCart(req, res, next) {
  try {
    const userId = req.user.id;
    const productId = toInt(req.body?.productId);
    const quantity = req.body?.quantity === undefined ? 1 : toInt(req.body.quantity);

    if (productId === null) return res.status(400).json({ message: "productId ไม่ถูกต้อง" });
    if (quantity === null || quantity < 1)
      return res.status(400).json({ message: "จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป" });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: "ไม่พบสินค้า" });
    if (!product.isActive) return res.status(400).json({ message: "สินค้านี้ปิดการขายอยู่" });

    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > product.stock)
      return res.status(400).json({ message: `สต็อกไม่พอ (คงเหลือ ${product.stock} ชิ้น)` });

    await prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity: newQty },
      update: { quantity: newQty },
    });

    res.status(201).json(await getCartResponse(userId));
  } catch (err) {
    next(err);
  }
}

// PUT /api/cart/:productId  { quantity }  — ตั้งจำนวนแบบ absolute (<=0 = เอาออก)
export async function setQuantity(req, res, next) {
  try {
    const userId = req.user.id;
    const productId = toInt(req.params.productId);
    const quantity = toInt(req.body?.quantity);

    if (productId === null) return res.status(400).json({ message: "productId ไม่ถูกต้อง" });
    if (quantity === null) return res.status(400).json({ message: "จำนวนไม่ถูกต้อง" });

    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({ where: { userId, productId } });
      return res.json(await getCartResponse(userId));
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: "ไม่พบสินค้า" });
    if (!product.isActive) return res.status(400).json({ message: "สินค้านี้ปิดการขายอยู่" });
    if (quantity > product.stock)
      return res.status(400).json({ message: `สต็อกไม่พอ (คงเหลือ ${product.stock} ชิ้น)` });

    await prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity },
    });

    res.json(await getCartResponse(userId));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart/:productId  — เอาสินค้าออกจากตะกร้า
export async function removeItem(req, res, next) {
  try {
    const userId = req.user.id;
    const productId = toInt(req.params.productId);
    if (productId === null) return res.status(400).json({ message: "productId ไม่ถูกต้อง" });

    await prisma.cartItem.deleteMany({ where: { userId, productId } });
    res.json(await getCartResponse(userId));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart  — ล้างตะกร้าทั้งหมด
export async function clearCart(req, res, next) {
  try {
    await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
    res.json(await getCartResponse(req.user.id));
  } catch (err) {
    next(err);
  }
}
