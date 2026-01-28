import multer from 'multer';
import path from 'path';
import fs from 'fs';

const dir = path.join(process.cwd(), 'uploads', 'posts');
fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

function fileFilter(_req: any, file: any, cb: any) {
  const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('INVALID_FILE_TYPE'), ok);
}

export const postImageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB
});
