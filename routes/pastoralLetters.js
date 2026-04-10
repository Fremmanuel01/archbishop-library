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
    folder: 'archbishop-library/pastoral-letters',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
    resource_type: 'auto'
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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
   PUBLIC — Get all pastoral letters
   ────────────────────────────────────────────── */

router.get('/', (req, res) => {
  try {
    const letters = db.prepare(
      'SELECT * FROM pastoral_letters ORDER BY date DESC, created_at DESC'
    ).all();

    res.json({ success: true, data: letters });
  } catch (err) {
    console.error('Error fetching pastoral letters:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pastoral letters.' });
  }
});

/* ──────────────────────────────────────────────
   PUBLIC — Get single pastoral letter
   ────────────────────────────────────────────── */

router.get('/:id', (req, res) => {
  try {
    const letter = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(req.params.id);

    if (!letter) {
      return res.status(404).json({ success: false, message: 'Pastoral letter not found.' });
    }

    res.json({ success: true, data: letter });
  } catch (err) {
    console.error('Error fetching pastoral letter:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pastoral letter.' });
  }
});

/* ──────────────────────────────────────────────
   PROTECTED — Create pastoral letter
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
      const { title, description, date } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required.' });
      }

      const pdfUrl = req.files && req.files.pdf ? req.files.pdf[0].path : null;
      const thumbnailUrl = req.files && req.files.thumbnail ? req.files.thumbnail[0].path : null;

      const stmt = db.prepare(`
        INSERT INTO pastoral_letters (title, description, pdf_url, thumbnail_url, date)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(title, description || null, pdfUrl, thumbnailUrl, date || null);

      const created = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error('Error creating pastoral letter:', err);
      res.status(500).json({ success: false, message: 'Failed to create pastoral letter.' });
    }
  });
});

/* ──────────────────────────────────────────────
   PROTECTED — Update pastoral letter
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
      const existing = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(req.params.id);

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Pastoral letter not found.' });
      }

      const { title, description, date } = req.body;

      const pdfUrl = req.files && req.files.pdf ? req.files.pdf[0].path : existing.pdf_url;
      const thumbnailUrl = req.files && req.files.thumbnail ? req.files.thumbnail[0].path : existing.thumbnail_url;

      db.prepare(`
        UPDATE pastoral_letters
        SET title = ?, description = ?, pdf_url = ?, thumbnail_url = ?, date = ?
        WHERE id = ?
      `).run(
        title || existing.title,
        description !== undefined ? description : existing.description,
        pdfUrl,
        thumbnailUrl,
        date || existing.date,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(req.params.id);

      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Error updating pastoral letter:', err);
      res.status(500).json({ success: false, message: 'Failed to update pastoral letter.' });
    }
  });
});

/* ──────────────────────────────────────────────
   PROTECTED — Delete pastoral letter
   ────────────────────────────────────────────── */

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pastoral letter not found.' });
    }

    db.prepare('DELETE FROM pastoral_letters WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Pastoral letter deleted successfully.' } });
  } catch (err) {
    console.error('Error deleting pastoral letter:', err);
    res.status(500).json({ success: false, message: 'Failed to delete pastoral letter.' });
  }
});

module.exports = router;
