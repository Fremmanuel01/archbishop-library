const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const pdfParse = require('pdf-parse');
const fs = require('fs');
const db = require('../database');
const authenticateToken = require('../middleware/auth');
const { processDocument } = require('../services/aiProcessor');

/* ──────────────────────────────────────────────
   Cloudinary config
   ────────────────────────────────────────────── */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ──────────────────────────────────────────────
   Multer — local temp storage for PDF extraction,
   then manual upload to Cloudinary
   ────────────────────────────────────────────── */

const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, require('os').tmpdir()),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({
  storage: tempStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max for PDF
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'cover_photo') {
      const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowed.includes(file.mimetype)) {
        return cb(new Error('Cover photo must be JPG or PNG.'));
      }
      if (file.size > 5 * 1024 * 1024) {
        return cb(new Error('Cover photo must be under 5 MB.'));
      }
      cb(null, true);
    } else if (file.fieldname === 'pdf_file') {
      if (file.mimetype !== 'application/pdf') {
        return cb(new Error('Only PDF files are allowed.'));
      }
      cb(null, true);
    } else {
      cb(null, true);
    }
  }
});

const uploadFields = upload.fields([
  { name: 'cover_photo', maxCount: 1 },
  { name: 'pdf_file', maxCount: 1 }
]);

/* Cloudinary AI enhancement — insert transformation into URL */
function buildEnhancedUrl(cloudinaryUrl) {
  if (!cloudinaryUrl) return cloudinaryUrl;
  return cloudinaryUrl.replace(
    '/upload/',
    '/upload/e_improve,e_sharpen:100,e_upscale,e_brightness:10,e_contrast:15/'
  );
}

/* Helper: upload file to Cloudinary */
async function uploadToCloudinary(filePath, folder, resourceType) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'archbishop-library/' + folder,
    resource_type: resourceType || 'auto'
  });
  return result.secure_url;
}

/* Helper: clean up temp file */
function cleanTemp(filePath) {
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}

/* ──────────────────────────────────────────────
   PUBLIC — Get all pastoral letters
   ────────────────────────────────────────────── */

router.get('/', (req, res) => {
  try {
    const letters = db.prepare(
      'SELECT * FROM pastoral_letters ORDER BY date DESC'
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
  uploadFields(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File size exceeds limit.' });
      }
      return res.status(400).json({ success: false, message: uploadErr.message });
    }

    const coverFile = req.files && req.files.cover_photo ? req.files.cover_photo[0] : null;
    const pdfFile = req.files && req.files.pdf_file ? req.files.pdf_file[0] : null;

    try {
      const { title, description, date, occasion } = req.body;

      if (!title) {
        if (coverFile) cleanTemp(coverFile.path);
        if (pdfFile) cleanTemp(pdfFile.path);
        return res.status(400).json({ success: false, message: 'Title is required.' });
      }

      /* Upload files to Cloudinary */
      let coverPhotoUrl = null;
      let pdfUrl = null;

      if (coverFile) {
        const rawCoverUrl = await uploadToCloudinary(coverFile.path, 'pastoral-letters/covers', 'image');
        coverPhotoUrl = buildEnhancedUrl(rawCoverUrl);
        cleanTemp(coverFile.path);
      }

      if (pdfFile) {
        pdfUrl = await uploadToCloudinary(pdfFile.path, 'pastoral-letters/pdfs', 'raw');
      }

      /* Extract text from PDF and run AI processing */
      let aiResult = { summary: null, date: null, key_quote: null, tags: [], reading_time: null, tone: null, highlights: [], occasion: null, category: null };
      let aiProcessed = false;

      if (pdfFile) {
        try {
          const pdfBuffer = fs.readFileSync(pdfFile.path);
          const pdfData = await pdfParse(pdfBuffer);
          const extractedText = pdfData.text;

          if (extractedText && extractedText.trim().length > 50) {
            aiResult = await processDocument(extractedText, 'pastoral_letter');
            aiProcessed = !!(aiResult.summary || aiResult.key_quote);
          }
        } catch (pdfErr) {
          console.error('PDF extraction error:', pdfErr.message);
        }
        cleanTemp(pdfFile.path);
      }

      /* Use AI date if admin didn't provide one */
      const finalDate = date || aiResult.date || null;
      const finalDescription = description || aiResult.summary || null;

      const stmt = db.prepare(`
        INSERT INTO pastoral_letters
          (title, description, pdf_url, thumbnail_url, cover_photo_url, date,
           key_quote, tags, reading_time, tone, highlights)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        title,
        finalDescription,
        pdfUrl,
        coverPhotoUrl, /* thumbnail_url = cover photo for backwards compat */
        coverPhotoUrl,
        finalDate,
        aiResult.key_quote,
        JSON.stringify(aiResult.tags),
        aiResult.reading_time,
        aiResult.tone,
        JSON.stringify(aiResult.highlights)
      );

      const created = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({ success: true, data: created, ai_processed: aiProcessed });
    } catch (err) {
      if (coverFile) cleanTemp(coverFile.path);
      if (pdfFile) cleanTemp(pdfFile.path);
      console.error('Error creating pastoral letter:', err);
      res.status(500).json({ success: false, message: 'Failed to create pastoral letter.' });
    }
  });
});

/* ──────────────────────────────────────────────
   PROTECTED — Update pastoral letter
   ────────────────────────────────────────────── */

router.put('/:id', authenticateToken, (req, res) => {
  uploadFields(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ success: false, message: uploadErr.message });
    }

    const coverFile = req.files && req.files.cover_photo ? req.files.cover_photo[0] : null;
    const pdfFile = req.files && req.files.pdf_file ? req.files.pdf_file[0] : null;

    try {
      const existing = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(req.params.id);
      if (!existing) {
        if (coverFile) cleanTemp(coverFile.path);
        if (pdfFile) cleanTemp(pdfFile.path);
        return res.status(404).json({ success: false, message: 'Pastoral letter not found.' });
      }

      const { title, description, date, key_quote, tags, reading_time, tone, highlights } = req.body;

      let coverPhotoUrl = existing.cover_photo_url;
      let pdfUrl = existing.pdf_url;

      if (coverFile) {
        const rawCoverUrl = await uploadToCloudinary(coverFile.path, 'pastoral-letters/covers', 'image');
        coverPhotoUrl = buildEnhancedUrl(rawCoverUrl);
        cleanTemp(coverFile.path);
      }
      if (pdfFile) {
        pdfUrl = await uploadToCloudinary(pdfFile.path, 'pastoral-letters/pdfs', 'raw');
        cleanTemp(pdfFile.path);
      }

      db.prepare(`
        UPDATE pastoral_letters SET
          title = ?, description = ?, pdf_url = ?, thumbnail_url = ?, cover_photo_url = ?,
          date = ?, key_quote = ?, tags = ?, reading_time = ?, tone = ?, highlights = ?
        WHERE id = ?
      `).run(
        title || existing.title,
        description !== undefined ? description : existing.description,
        pdfUrl,
        coverPhotoUrl,
        coverPhotoUrl,
        date || existing.date,
        key_quote !== undefined ? key_quote : existing.key_quote,
        tags !== undefined ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : existing.tags,
        reading_time !== undefined ? reading_time : existing.reading_time,
        tone !== undefined ? tone : existing.tone,
        highlights !== undefined ? (typeof highlights === 'string' ? highlights : JSON.stringify(highlights)) : existing.highlights,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(req.params.id);
      res.json({ success: true, data: updated });
    } catch (err) {
      if (coverFile) cleanTemp(coverFile.path);
      if (pdfFile) cleanTemp(pdfFile.path);
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
