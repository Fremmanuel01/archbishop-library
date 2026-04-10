const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('../database');
const authenticateToken = require('../middleware/auth');

/* ──────────────────────────────────────────────
   Cloudinary config
   ────────────────────────────────────────────── */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ──────────────────────────────────────────────
   Multer + Cloudinary storage
   ────────────────────────────────────────────── */

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'archbishop-library/homilies',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
    resource_type: 'auto'
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed.'));
    }
  }
});

const uploadFields = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

/* ──────────────────────────────────────────────
   PUBLIC — Get all homilies
   ────────────────────────────────────────────── */

router.get('/', (req, res) => {
  try {
    const homilies = db.prepare(
      'SELECT * FROM homilies ORDER BY date DESC, created_at DESC'
    ).all();

    res.json({ success: true, data: homilies });
  } catch (err) {
    console.error('Error fetching homilies:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch homilies.' });
  }
});

/* ──────────────────────────────────────────────
   PUBLIC — Get single homily
   ────────────────────────────────────────────── */

router.get('/:id', (req, res) => {
  try {
    const homily = db.prepare('SELECT * FROM homilies WHERE id = ?').get(req.params.id);

    if (!homily) {
      return res.status(404).json({ success: false, message: 'Homily not found.' });
    }

    res.json({ success: true, data: homily });
  } catch (err) {
    console.error('Error fetching homily:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch homily.' });
  }
});

/* ──────────────────────────────────────────────
   PROTECTED — Create homily
   ────────────────────────────────────────────── */

router.post('/', authenticateToken, (req, res) => {
  uploadFields(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size exceeds 10 MB limit.' });
      }
      return res.status(400).json({ success: false, message: uploadErr.message });
    }

    try {
      const { title, description, occasion, date } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required.' });
      }

      const pdfUrl = req.files && req.files.pdf ? req.files.pdf[0].path : null;
      const thumbnailUrl = req.files && req.files.thumbnail ? req.files.thumbnail[0].path : null;

      const stmt = db.prepare(`
        INSERT INTO homilies (title, description, pdf_url, thumbnail_url, occasion, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        title,
        description || null,
        pdfUrl,
        thumbnailUrl,
        occasion || null,
        date || null
      );

      const created = db.prepare('SELECT * FROM homilies WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error('Error creating homily:', err);
      res.status(500).json({ success: false, message: 'Failed to create homily.' });
    }
  });
});

/* ──────────────────────────────────────────────
   PROTECTED — Update homily
   ────────────────────────────────────────────── */

router.put('/:id', authenticateToken, (req, res) => {
  uploadFields(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size exceeds 10 MB limit.' });
      }
      return res.status(400).json({ success: false, message: uploadErr.message });
    }

    try {
      const existing = db.prepare('SELECT * FROM homilies WHERE id = ?').get(req.params.id);

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Homily not found.' });
      }

      const { title, description, occasion, date } = req.body;

      const pdfUrl = req.files && req.files.pdf ? req.files.pdf[0].path : existing.pdf_url;
      const thumbnailUrl = req.files && req.files.thumbnail ? req.files.thumbnail[0].path : existing.thumbnail_url;

      db.prepare(`
        UPDATE homilies
        SET title = ?, description = ?, pdf_url = ?, thumbnail_url = ?, occasion = ?, date = ?
        WHERE id = ?
      `).run(
        title || existing.title,
        description !== undefined ? description : existing.description,
        pdfUrl,
        thumbnailUrl,
        occasion !== undefined ? occasion : existing.occasion,
        date || existing.date,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM homilies WHERE id = ?').get(req.params.id);

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Error updating homily:', err);
      res.status(500).json({ success: false, message: 'Failed to update homily.' });
    }
  });
});

/* ──────────────────────────────────────────────
   PROTECTED — Delete homily
   ────────────────────────────────────────────── */

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM homilies WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Homily not found.' });
    }

    db.prepare('DELETE FROM homilies WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Homily deleted successfully.' } });
  } catch (err) {
    console.error('Error deleting homily:', err);
    res.status(500).json({ success: false, message: 'Failed to delete homily.' });
  }
});

module.exports = router;
