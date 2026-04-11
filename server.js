require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

/* ──────────────────────────────────────────────
   Middleware
   ────────────────────────────────────────────── */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Serve admin dashboard as static files */
app.use('/admin', express.static(path.join(__dirname, 'admin')));

/* ──────────────────────────────────────────────
   Auth route — login
   ────────────────────────────────────────────── */

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    /* Check admin_users table first */
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

    if (user) {
      const valid = bcrypt.compareSync(password, user.password);
      if (!valid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.'
        });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        data: { token, username: user.username }
      });
    }

    /* Fallback: check env-based admin credentials */
    if (username === process.env.ADMIN_USERNAME) {
      const valid = bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);
      if (valid) {
        const token = jwt.sign(
          { id: 0, username },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        return res.json({
          success: true,
          data: { token, username }
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid username or password.'
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

/* ──────────────────────────────────────────────
   Auth route — change password
   ────────────────────────────────────────────── */

const authenticateToken = require('./middleware/auth');

app.post('/api/auth/change-password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.'
      });
    }

    const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const valid = bcrypt.compareSync(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hash, user.id);

    res.json({ success: true, data: { message: 'Password updated successfully.' } });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
});

/* ──────────────────────────────────────────────
   API Routes
   ────────────────────────────────────────────── */

const pastoralLettersRouter = require('./routes/pastoralLetters');
const homiliesRouter = require('./routes/homilies');
const writingsRouter = require('./routes/writings');
const settingsRouter = require('./routes/settings');

app.use('/api/pastoral-letters', pastoralLettersRouter);
app.use('/api/homilies', homiliesRouter);
app.use('/api/writings', writingsRouter);
app.use('/api/settings', settingsRouter);

/* ──────────────────────────────────────────────
   Single Post Pages
   ────────────────────────────────────────────── */

const { renderSinglePost } = require('./services/singlePostRenderer');

app.get('/letter/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM pastoral_letters WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).send('<h1>Not Found</h1>');
    res.send(renderSinglePost(item, 'pastoral_letters'));
  } catch (err) {
    console.error('Error rendering letter:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

app.get('/homily/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM homilies WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).send('<h1>Not Found</h1>');
    res.send(renderSinglePost(item, 'homilies'));
  } catch (err) {
    console.error('Error rendering homily:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

app.get('/writing/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM writings WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).send('<h1>Not Found</h1>');
    res.send(renderSinglePost(item, 'writings'));
  } catch (err) {
    console.error('Error rendering writing:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

/* ──────────────────────────────────────────────
   Health check
   ────────────────────────────────────────────── */

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

/* ──────────────────────────────────────────────
   Root redirect to admin
   ────────────────────────────────────────────── */

app.get('/', (req, res) => {
  res.redirect('/admin');
});

/* ──────────────────────────────────────────────
   Start server (after database initialization)
   ────────────────────────────────────────────── */

const { initDatabase } = require('./database');

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Archbishop Library CMS running on port ${PORT}`);
    console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
    console.log(`API base URL:    http://localhost:${PORT}/api`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
