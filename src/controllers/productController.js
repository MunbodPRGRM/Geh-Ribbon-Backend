import prisma from "../lib/prisma.js";
import cloudinary, { cloudinaryConfigured } from "../config/cloudinary.js";

const imagesOrdered = { images: { orderBy: { sortOrder: "asc" } } };

// ตรวจ + แปลง input ของสินค้า (partial=true สำหรับ update ที่ส่งมาบาง field)
function parseProductInput(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) errors.push("กรุณากรอกชื่อสินค้า");
    else data.name = String(body.name).trim();
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push("ราคาไม่ถูกต้อง");
    else data.price = price;
  }
  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) errors.push("จำนวนสต็อกไม่ถูกต้อง");
    else data.stock = stock;
  }
  if (body.description !== undefined) {
    data.description = body.description === null ? null : String(body.description);
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") errors.push("isActive ต้องเป็น true/false");
    else data.isActive = body.isActive;
  }

  return { data, errors };
}

// แปลง array รูป -> รูปแบบที่ Prisma ใช้สร้าง (url บังคับ, publicId ว่างได้ถ้าไม่ได้มาจาก Cloudinary)
// คืน null ถ้าไม่ได้ส่ง images มา (จะได้แยกกรณี "ไม่แตะรูป" ออกจาก "ล้างรูปทั้งหมด")
function parseImages(images) {
  if (!Array.isArray(images)) return null;
  return images
    .filter((i) => i && i.url)
    .map((i, idx) => ({
      url: String(i.url),
      publicId: i.publicId ? String(i.publicId) : "",
      sortOrder: Number.isInteger(i.sortOrder) ? i.sortOrder : idx,
    }));
}

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

// GET /api/products  (public; admin ส่ง ?includeInactive=true เพื่อเห็นสินค้าปิดการขาย)
export async function listProducts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));
    const search = (req.query.search || "").trim();
    const includeInactive =
      req.query.includeInactive === "true" && req.user?.role === "ADMIN";

    const where = {};
    if (!includeInactive) where.isActive = true;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: imagesOrdered,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:id
export async function getProduct(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const product = await prisma.product.findUnique({
      where: { id },
      include: imagesOrdered,
    });
    if (!product) return res.status(404).json({ message: "ไม่พบสินค้า" });

    res.json({ product });
  } catch (err) {
    next(err);
  }
}

// POST /api/products  (admin)
export async function createProduct(req, res, next) {
  try {
    const { data, errors } = parseProductInput(req.body ?? {});
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const images = parseImages(req.body?.images);
    const product = await prisma.product.create({
      data: { ...data, ...(images?.length ? { images: { create: images } } : {}) },
      include: imagesOrdered,
    });

    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

// PUT /api/products/:id  (admin) — ส่ง images มา = แทนที่รูปทั้งชุด
export async function updateProduct(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const { data, errors } = parseProductInput(req.body ?? {}, { partial: true });
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const images = parseImages(req.body?.images);
    if (Object.keys(data).length === 0 && images === null) {
      return res.status(400).json({ message: "ไม่มีข้อมูลให้แก้ไข" });
    }

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "ไม่พบสินค้า" });

    const product = await prisma.$transaction(async (tx) => {
      if (images) await tx.productImage.deleteMany({ where: { productId: id } });
      return tx.product.update({
        where: { id },
        data: { ...data, ...(images ? { images: { create: images } } : {}) },
        include: imagesOrdered,
      });
    });

    res.json({ product });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/products/:id  (admin)
export async function deleteProduct(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "ไม่พบสินค้า" });

    // product_images / cart_items ลบตามด้วย onDelete: Cascade
    // แต่ order_items เป็น Restrict -> ลบสินค้าที่เคยถูกสั่งซื้อไม่ได้
    try {
      await prisma.product.delete({ where: { id } });
    } catch {
      return res.status(409).json({
        message:
          "ลบไม่ได้: สินค้านี้มีประวัติการสั่งซื้อแล้ว แนะนำปิดการขาย (isActive=false) แทน",
      });
    }

    res.json({ message: "ลบสินค้าแล้ว" });
  } catch (err) {
    next(err);
  }
}

// POST /api/products/:id/images  (admin) — เพิ่มรูป (ต่อท้ายของเดิม)
export async function addImages(req, res, next) {
  try {
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!product) return res.status(404).json({ message: "ไม่พบสินค้า" });

    const images = parseImages(req.body?.images);
    if (!images?.length) return res.status(400).json({ message: "ไม่มีรูปให้เพิ่ม" });

    const base = product.images.length;
    await prisma.productImage.createMany({
      data: images.map((im, idx) => ({
        productId: id,
        url: im.url,
        publicId: im.publicId,
        sortOrder: base + idx,
      })),
    });

    const updated = await prisma.product.findUnique({
      where: { id },
      include: imagesOrdered,
    });
    res.status(201).json({ product: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/products/:id/images/:imageId  (admin)
export async function removeImage(req, res, next) {
  try {
    const id = toInt(req.params.id);
    const imageId = toInt(req.params.imageId);
    if (id === null || imageId === null)
      return res.status(400).json({ message: "id ไม่ถูกต้อง" });

    const image = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== id)
      return res.status(404).json({ message: "ไม่พบรูปนี้ในสินค้า" });

    // ลบไฟล์จริงจาก Cloudinary ด้วย (best-effort) ถ้ารูปนี้มาจาก Cloudinary
    if (cloudinaryConfigured && image.publicId) {
      try {
        await cloudinary.uploader.destroy(image.publicId);
      } catch {
        // ลบจาก Cloudinary ไม่สำเร็จ ไม่ถือเป็น error หลัก
      }
    }

    await prisma.productImage.delete({ where: { id: imageId } });
    res.json({ message: "ลบรูปแล้ว" });
  } catch (err) {
    next(err);
  }
}
