const express = require('express');
const router = express.Router();
const db = require('../database');
const authenticateToken = require('../middleware/auth');

/* ──────────────────────────────────────────────
   PUBLIC — Get all writings
   ────────────────────────────────────────────── */

router.get('/', (req, res) => {
  try {
    const writings = db.prepare(
      'SELECT * FROM writings ORDER BY date DESC, created_at DESC'
    ).all();

    res.json({ success: true, data: writings });
  } catch (err) {
    console.error('Error fetching writings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch writings.' });
  }
});

/* ──────────────────────────────────────────────
   PUBLIC — Get single writing
   ────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────
   PROTECTED — Create writing
   ────────────────────────────────────────────── */

router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, body, category, date } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO writings (title, body, category, date)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(title, body || null, category || null, date || null);

    const created = db.prepare('SELECT * FROM writings WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Error creating writing:', err);
    res.status(500).json({ success: false, message: 'Failed to create writing.' });
  }
});

/* ──────────────────────────────────────────────
   PROTECTED — Update writing
   ────────────────────────────────────────────── */

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM writings WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Writing not found.' });
    }

    const { title, body, category, date } = req.body;

    db.prepare(`
      UPDATE writings
      SET title = ?, body = ?, category = ?, date = ?
      WHERE id = ?
    `).run(
      title || existing.title,
      body !== undefined ? body : existing.body,
      category !== undefined ? category : existing.category,
      date || existing.date,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM writings WHERE id = ?').get(req.params.id);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating writing:', err);
    res.status(500).json({ success: false, message: 'Failed to update writing.' });
  }
});

/* ──────────────────────────────────────────────
   PROTECTED — Delete writing
   ────────────────────────────────────────────── */

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
