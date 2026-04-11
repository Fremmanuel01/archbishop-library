const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'archbishop_library.db');
const db = new Database(dbPath);

/* Enable WAL mode for better concurrent read performance */
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ──────────────────────────────────────────────
   Table creation
   ────────────────────────────────────────────── */

db.exec(`
  CREATE TABLE IF NOT EXISTS pastoral_letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    pdf_url TEXT,
    thumbnail_url TEXT,
    date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS homilies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    pdf_url TEXT,
    thumbnail_url TEXT,
    occasion TEXT,
    date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS writings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    category TEXT,
    date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT UNIQUE NOT NULL,
    layout TEXT DEFAULT 'grid',
    primary_color TEXT DEFAULT '#1a3c6e',
    background_color TEXT DEFAULT '#ffffff',
    text_color TEXT DEFAULT '#333333',
    accent_color TEXT DEFAULT '#c9a84c',
    heading_font TEXT DEFAULT 'Playfair Display',
    body_font TEXT DEFAULT 'Lora',
    font_size TEXT DEFAULT '16px',
    back_button_label TEXT DEFAULT 'Visit Archbishop Website',
    back_button_url TEXT DEFAULT 'https://archbishopokeke.com',
    back_button_position TEXT DEFAULT 'both',
    back_button_color TEXT DEFAULT '#c9a84c',
    back_button_visibility TEXT DEFAULT 'both',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

/* ──────────────────────────────────────────────
   Seed default settings rows (one per section)
   ────────────────────────────────────────────── */

const seedSettings = db.prepare(`
  INSERT OR IGNORE INTO settings (section) VALUES (?)
`);

const seedTransaction = db.transaction(() => {
  seedSettings.run('pastoral_letters');
  seedSettings.run('homilies');
  seedSettings.run('writings');
});

seedTransaction();

/* ──────────────────────────────────────────────
   Migrations — add new columns safely
   ────────────────────────────────────────────── */

function addColumn(table, column, type) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    /* Column already exists — ignore */
  }
}

/* Pastoral Letters — new columns */
addColumn('pastoral_letters', 'cover_photo_url', 'TEXT');
addColumn('pastoral_letters', 'key_quote', 'TEXT');
addColumn('pastoral_letters', 'tags', 'TEXT');
addColumn('pastoral_letters', 'reading_time', 'TEXT');
addColumn('pastoral_letters', 'tone', 'TEXT');
addColumn('pastoral_letters', 'highlights', 'TEXT');

/* Homilies — new columns */
addColumn('homilies', 'cover_photo_url', 'TEXT');
addColumn('homilies', 'key_quote', 'TEXT');
addColumn('homilies', 'tags', 'TEXT');
addColumn('homilies', 'reading_time', 'TEXT');
addColumn('homilies', 'tone', 'TEXT');
addColumn('homilies', 'highlights', 'TEXT');

/* Writings — new columns */
addColumn('writings', 'cover_photo_url', 'TEXT');
addColumn('writings', 'pdf_url', 'TEXT');
addColumn('writings', 'key_quote', 'TEXT');
addColumn('writings', 'tags', 'TEXT');
addColumn('writings', 'reading_time', 'TEXT');
addColumn('writings', 'tone', 'TEXT');
addColumn('writings', 'highlights', 'TEXT');

module.exports = db;
