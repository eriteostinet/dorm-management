import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/error';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10) },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, '只支持上传图片文件（jpg/png/gif/webp）'));
    }
  },
});

const router = Router();

// 单文件上传
router.post('/image', authenticate, upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, '没有上传文件');
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, url, filename: req.file.filename });
  } catch (error) {
    next(error);
  }
});

// 多文件上传
router.post('/images', authenticate, upload.array('images', 5), (req, res, next) => {
  try {
    if (!req.files || !(req.files instanceof Array)) {
      throw new AppError(400, '没有上传文件');
    }
    const urls = (req.files as Express.Multer.File[]).map((f) => `/uploads/${f.filename}`);
    res.json({ success: true, urls, count: urls.length });
  } catch (error) {
    next(error);
  }
});

export { router as uploadRouter };
