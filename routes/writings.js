const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const pdfParse = require('pdf-parse');
const fs = require('fs');
const db = require('../database');
const authenticateToken = require('../middleware/auth');
const { processDocument } = require('../services/aiProcessor');
const { generateCover } = require('../services/coverGenerator');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, require('os').tmpdir()),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({
  storage: tempStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'pdf_file') {
      if (file.mimetype !== 'application/pdf') {
        return cb(new Error('Only PDF files are allowed.'));
      }
    }
    cb(null, true);
  }
});

const uploadFields = upload.fields([
  { name: 'pdf_file', maxCount: 1 }
]);

async function uploadToCloudinary(filePath, folder, resourceType) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'archbishop-library/' + folder,
    resource_type: resourceType || 'auto'
  });
  return result.secure_url;
}

function cleanTemp(filePath) {
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}

/* ── PUBLIC — Get all writings ──────────────── */

router.get('/', (req, res) => {
  try {
    const writings = db.prepare(
      'SELECT * FROM writings ORDER BY category ASC, date DESC'
    ).all();
    res.json({ success: true, data: writings });
  } catch (err) {
    console.error('Error fetching writings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch writings.' });
  }
});

/* ── PUBLIC — Get single writing ────────────── */

router.get('/:id', (req, res) => {
  try {
    const writing = db.prepare('SELECT * FROM writings WHERE id = ?').get(req.params.id);
    if (!writing) {
      return res.status(404).json({ success: false, message: 'Writing not found.' });
    }
    res.json({ success: true, data: writing });
  } catch (err) {
    console.error('Error fetching writing:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch writing.' });
  }
});

/* ── PROTECTED — Create writing ─────────────── */

router.post('/', authenticateToken, (req, res) => {
  uploadFields(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size exceeds limit.' });
      }
      return res.status(400).json({ success: false, message: uploadErr.message });
    }

    const pdfFile = req.files && req.files.pdf_file ? req.files.pdf_file[0] : null;

    try {
      const { title, body, category, date } = req.body;

      if (!title) {
        if (pdfFile) cleanTemp(pdfFile.path);
        return res.status(400).json({ success: false, message: 'Title is required.' });
      }

      let pdfUrl = null;

      if (pdfFile) {
        pdfUrl = await uploadToCloudinary(pdfFile.path, 'writings/pdfs', 'raw');
      }

      /* AI processing */
      let aiResult = { summary: null, date: null, key_quote: null, tags: [], reading_time: null, tone: null, highlights: [], occasion: null, category: null };
      let aiProcessed = false;

      if (pdfFile) {
        try {
          const pdfBuffer = fs.readFileSync(pdfFile.path);
          const pdfData = await pdfParse(pdfBuffer);
          if (pdfData.text && pdfData.text.trim().length > 50) {
            aiResult = await processDocument(pdfData.text, 'writing');
            aiProcessed = !!(aiResult.summary || aiResult.key_quote);
          }
        } catch (pdfErr) {
          console.error('PDF extraction error:', pdfErr.message);
        }
        cleanTemp(pdfFile.path);
      }

      const finalDate = date || aiResult.date || null;
      const finalBody = body || aiResult.summary || null;
      const finalCategory = category || aiResult.category || null;

      const stmt = db.prepare(`
        INSERT INTO writings
          (title, body, category, date, cover_photo_url, pdf_url,
           key_quote, tags, reading_time, tone, highlights)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        title, finalBody, finalCategory, finalDate,
        null, pdfUrl,
        aiResult.key_quote,
        JSON.stringify(aiResult.tags),
        aiResult.reading_time,
        aiResult.tone,
        JSON.stringify(aiResult.highlights)
      );

      /* Auto-generate branded cover (non-blocking) */
      const recordId = result.lastInsertRowid;
      generateCover(title, finalDate, 'writing').then(coverUrl => {
        if (coverUrl) {
          db.prepare('UPDATE writings SET cover_photo_url = ? WHERE id = ?')
            .run(coverUrl, recordId);
        }
      }).catch(e => console.error('Cover generation error:', e.message));

      const created = db.prepare('SELECT * FROM writings WHERE id = ?').get(recordId);
      res.status(201).json({ success: true, data: created, ai_processed: aiProcessed });
    } catch (err) {
      if (pdfFile) cleanTemp(pdfFile.path);
      console.error('Error creating writing:', err);
      res.status(500).json({ success: false, message: 'Failed to create writing.' });
    }
  });
});

/* ── PROTECTED — Update writing ─────────────── */

router.put('/:id', authenticateToken, (req, res) => {
  uploadFields(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ success: false, message: uploadErr.message });
    }

    const pdfFile = req.files && req.files.pdf_file ? req.files.pdf_file[0] : null;

    try {
      const existing = db.prepare('SELECT * FROM writings WHERE id = ?').get(req.params.id);
      if (!existing) {
        if (pdfFile) cleanTemp(pdfFile.path);
        return res.status(404).json({ success: false, message: 'Writing not found.' });
      }

      const { title, body, category, date, key_quote, tags, reading_time, tone, highlights } = req.body;

      let coverPhotoUrl = existing.cover_photo_url;
      let pdfUrl = existing.pdf_url;

      if (pdfFile) {
        pdfUrl = await uploadToCloudinary(pdfFile.path, 'writings/pdfs', 'raw');
        cleanTemp(pdfFile.path);
      }

      db.prepare(`
        UPDATE writings SET
          title = ?, body = ?, category = ?, date = ?, cover_photo_url = ?, pdf_url = ?,
          key_quote = ?, tags = ?, reading_time = ?, tone = ?, highlights = ?
        WHERE id = ?
      `).run(
        title || existing.title,
        body !== undefined ? body : existing.body,
        category !== undefined ? category : existing.category,
        date || existing.date,
        coverPhotoUrl, pdfUrl,
        key_quote !== undefined ? key_quote : existing.key_quote,
        tags !== undefined ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : existing.tags,
        reading_time !== undefined ? reading_time : existing.reading_time,
        tone !== undefined ? tone : existing.tone,
        highlights !== undefined ? (typeof highlights === 'string' ? highlights : JSON.stringify(highlights)) : existing.highlights,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM writings WHERE id = ?').get(req.params.id);
      res.json({ success: true, data: updated });
    } catch (err) {
      if (pdfFile) cleanTemp(pdfFile.path);
      console.error('Error updating writing:', err);
      res.status(500).json({ success: false, message: 'Failed to update writing.' });
    }
  });
});

/* ── PROTECTED — Delete writing ─────────────── */

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM writings WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Writing not found.' });
    }
    db.prepare('DELETE FROM writings WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { message: 'Writing deleted successfully.' } });
  } catch (err) {
    console.error('Error deleting writing:', err);
    res.status(500).json({ success: false, message: 'Failed to delete writing.' });
  }
});

module.exports = router;
