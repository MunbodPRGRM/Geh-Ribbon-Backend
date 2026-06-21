import multer from "multer";

// เก็บไฟล์ใน memory (buffer) เพื่อส่งต่อให้ Cloudinary โดยไม่เขียนลงดิสก์
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // จำกัด 5MB ต่อไฟล์
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("รองรับเฉพาะไฟล์รูปภาพ"));
  },
});
