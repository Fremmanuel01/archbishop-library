/**
 * Seed an admin user into the database.
 * Usage: node scripts/seed-admin.js [username] [password]
 * Defaults to admin / admin123 if no arguments provided.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { initDatabase } = require('../database');

const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'admin123';

initDatabase().then(() => {
  const hash = bcrypt.hashSync(password, 10);

  try {
    const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);

    if (existing) {
      db.prepare('UPDATE admin_users SET password = ? WHERE username = ?').run(hash, username);
      console.log(`Updated password for existing admin user "${username}".`);
    } else {
      db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)').run(username, hash);
      console.log(`Created admin user "${username}" with the provided password.`);
    }

    console.log(`\nBcrypt hash (for .env ADMIN_PASSWORD_HASH):\n${hash}`);
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    process.exit(1);
  }
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
