import cloudinary, { cloudinaryConfigured } from "../config/cloudinary.js";

// อัปโหลด buffer ขึ้น Cloudinary (upload_stream รับ buffer ตรง ๆ ไม่ต้องเขียนไฟล์)
function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "geh-ribbon" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// POST /api/admin/upload  (multipart, field "images") -> [{ url, publicId }]
export async function uploadImages(req, res, next) {
  try {
    if (!cloudinaryConfigured) {
      return res.status(503).json({ message: "ยังไม่ได้ตั้งค่า Cloudinary (ดู .env)" });
    }
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: "ไม่มีไฟล์ที่อัปโหลด" });

    const results = await Promise.all(files.map((f) => uploadBuffer(f.buffer)));
    res.status(201).json({
      images: results.map((r) => ({ url: r.secure_url, publicId: r.public_id })),
    });
  } catch (err) {
    next(err);
  }
}
