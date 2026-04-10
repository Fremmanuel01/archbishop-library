const express = require('express');
const router = express.Router();
const db = require('../database');
const authenticateToken = require('../middleware/auth');

const VALID_SECTIONS = ['pastoral_letters', 'homilies', 'writings'];

/* ──────────────────────────────────────────────
   PUBLIC — Get settings for a section
   ────────────────────────────────────────────── */

router.get('/:section', (req, res) => {
  try {
    const { section } = req.params;

    if (!VALID_SECTIONS.includes(section)) {
      return res.status(400).json({
        success: false,
        message: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}`
      });
    }

    const settings = db.prepare('SELECT * FROM settings WHERE section = ?').get(section);

    if (!settings) {
      return res.status(404).json({ success: false, message: 'Settings not found for this section.' });
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
});

/* ──────────────────────────────────────────────
   PROTECTED — Update settings for a section
   ────────────────────────────────────────────── */

router.put('/:section', authenticateToken, (req, res) => {
  try {
    const { section } = req.params;

    if (!VALID_SECTIONS.includes(section)) {
      return res.status(400).json({
        success: false,
        message: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}`
      });
    }

    const {
      layout,
      primary_color,
      background_color,
      text_color,
      accent_color,
      heading_font,
      body_font,
      font_size,
      back_button_label,
      back_button_url,
      back_button_position,
      back_button_color,
      back_button_visibility
    } = req.body;

    const existing = db.prepare('SELECT * FROM settings WHERE section = ?').get(section);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Settings not found for this section.' });
    }

    db.prepare(`
      UPDATE settings SET
        layout = ?,
        primary_color = ?,
        background_color = ?,
        text_color = ?,
        accent_color = ?,
        heading_font = ?,
        body_font = ?,
        font_size = ?,
        back_button_label = ?,
        back_button_url = ?,
        back_button_position = ?,
        back_button_color = ?,
        back_button_visibility = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE section = ?
    `).run(
      layout || existing.layout,
      primary_color || existing.primary_color,
      background_color || existing.background_color,
      text_color || existing.text_color,
      accent_color || existing.accent_color,
      heading_font || existing.heading_font,
      body_font || existing.body_font,
      font_size || existing.font_size,
      back_button_label !== undefined ? back_button_label : existing.back_button_label,
      back_button_url !== undefined ? back_button_url : existing.back_button_url,
      back_button_position || existing.back_button_position,
      back_button_color || existing.back_button_color,
      back_button_visibility || existing.back_button_visibility,
      section
    );

    const updated = db.prepare('SELECT * FROM settings WHERE section = ?').get(section);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
});

module.exports = router;
