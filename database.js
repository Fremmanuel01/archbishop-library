const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'archbishop_library.db');

/**
 * sql.js wrapper that mimics the better-sqlite3 API surface.
 * Provides .prepare(sql).get(...), .prepare(sql).all(...), .prepare(sql).run(...)
 * so existing route code works without changes.
 */

let sqlDb = null;

/* ── Statement wrapper ────────────────────── */

class StatementWrapper {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  get(...params) {
    try {
      const stmt = this.db.prepare(this.sql);
      stmt.bind(params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        stmt.free();
        const row = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });
        save();
        return row;
      }
      stmt.free();
      save();
      return undefined;
    } catch (e) {
      save();
      throw e;
    }
  }

  all(...params) {
    try {
      const results = [];
      const stmt = this.db.prepare(this.sql);
      if (params.length > 0) {
        stmt.bind(params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
      }
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const row = {};
        cols.forEach((c, i) => { row[c] = vals[i]; });
        results.push(row);
      }
      stmt.free();
      save();
      return results;
    } catch (e) {
      save();
      throw e;
    }
  }

  run(...params) {
    try {
      this.db.run(this.sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
      const lastId = this.db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] || 0;
      const changes = this.db.getRowsModified();
      save();
      return { lastInsertRowid: lastId, changes };
    } catch (e) {
      save();
      throw e;
    }
  }
}

/* ── Database proxy ───────────────────────── */

const dbProxy = {
  prepare(sql) {
    if (!sqlDb) throw new Error('Database not initialized. Call initDatabase() first.');
    return new StatementWrapper(sqlDb, sql);
  },

  exec(sql) {
    if (!sqlDb) throw new Error('Database not initialized.');
    sqlDb.run(sql);
    save();
  },

  pragma() {
    /* No-op for sql.js compatibility */
  },

  transaction(fn) {
    return () => {
      if (!sqlDb) throw new Error('Database not initialized.');
      sqlDb.run('BEGIN');
      try {
        fn();
        sqlDb.run('COMMIT');
        save();
      } catch (e) {
        sqlDb.run('ROLLBACK');
        throw e;
      }
    };
  }
};

/* ── Persistence: save DB to disk ─────────── */

function save() {
  if (!sqlDb) return;
  try {
    const data = sqlDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

/* ── Initialization ───────────────────────── */

async function initDatabase() {
  const SQL = await initSqlJs();

  /* Load existing DB file or create new */
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  /* Create tables */
  sqlDb.run(`
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

  /* Seed default settings */
  ['pastoral_letters', 'homilies', 'writings'].forEach(section => {
    const exists = dbProxy.prepare('SELECT id FROM settings WHERE section = ?').get(section);
    if (!exists) {
      dbProxy.prepare('INSERT INTO settings (section) VALUES (?)').run(section);
    }
  });

  /* Migrations — add new columns safely */
  function addColumn(table, column, type) {
    try {
      sqlDb.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (e) {
      /* Column already exists — ignore */
    }
  }

  addColumn('pastoral_letters', 'cover_photo_url', 'TEXT');
  addColumn('pastoral_letters', 'key_quote', 'TEXT');
  addColumn('pastoral_letters', 'tags', 'TEXT');
  addColumn('pastoral_letters', 'reading_time', 'TEXT');
  addColumn('pastoral_letters', 'tone', 'TEXT');
  addColumn('pastoral_letters', 'highlights', 'TEXT');

  addColumn('homilies', 'cover_photo_url', 'TEXT');
  addColumn('homilies', 'key_quote', 'TEXT');
  addColumn('homilies', 'tags', 'TEXT');
  addColumn('homilies', 'reading_time', 'TEXT');
  addColumn('homilies', 'tone', 'TEXT');
  addColumn('homilies', 'highlights', 'TEXT');

  addColumn('writings', 'occasion', 'TEXT');
  addColumn('writings', 'cover_photo_url', 'TEXT');
  addColumn('writings', 'pdf_url', 'TEXT');
  addColumn('writings', 'key_quote', 'TEXT');
  addColumn('writings', 'tags', 'TEXT');
  addColumn('writings', 'reading_time', 'TEXT');
  addColumn('writings', 'tone', 'TEXT');
  addColumn('writings', 'highlights', 'TEXT');

  save();
  console.log('Database initialized successfully.');

  return dbProxy;
}

/* Export the proxy (synchronous access) and the init function */
module.exports = dbProxy;
module.exports.initDatabase = initDatabase;
