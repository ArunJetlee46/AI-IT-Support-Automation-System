import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Request } from 'express';

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024);
const allowedExtensions = (process.env.ALLOWED_FILE_EXTENSIONS || 'pdf,doc,docx,xls,xlsx,txt,jpg,jpeg,png,zip')
  .split(',')
  .map((ext) => ext.trim().toLowerCase())
  .filter(Boolean);

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req: Request, file, cb) => {
  const ext = path.extname(file.originalname).replace('.', '').toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    cb(new Error(`File type not allowed: .${ext}`));
    return;
  }

  cb(null, true);
};

export const uploadAttachments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 5,
  },
});
