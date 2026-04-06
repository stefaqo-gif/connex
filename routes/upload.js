const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

['uploads/messages', 'uploads/stories'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = req.query.type === 'story' ? 'uploads/stories' : 'uploads/messages';
    cb(null, folder);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname);
    const name = Date.now() + '_' + Math.random().toString(36).slice(2) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mp3|ogg|wav|pdf|doc|docx|xls|xlsx|zip/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    cb(null, allowed.test(ext));
  }
});

// Acepta 'file' (mensajes) e 'image' (estados)
router.post('/', upload.fields([{ name: 'file' }, { name: 'image' }]), (req, res) => {
  const file = req.files?.image?.[0] || req.files?.file?.[0];
  if (!file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const url = '/' + file.path.replace(/\\/g, '/');
  res.json({ url, imageUrl: url, name: file.originalname, mime: file.mimetype });
});

module.exports = router;