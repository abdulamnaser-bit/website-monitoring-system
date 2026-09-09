const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const { nanoid } = require('nanoid');

const db = require('./db');
const captcha = require('./captcha');
const { checkSite } = require('./monitor');
const { hashPassword, verifyPassword } = require('./auth');
const chatbot = require('./chatbot');

const app = express();
const PORT = process.env.PORT || 3000;
const HISTORY_LIMIT = 40;         // sparkline points kept per site
const PING_INTERVAL_MS = 45_000;  // background re-check cadence

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'sitewatch-demo-secret-change-me',
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }, // 8h
}));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- seed a demo account so the login screen is usable out of the box ----------
(function seed() {
  const users = db.getUsers();
  if (!users.find(u => u.email === 'demo@sitewatch.io')) {
    users.push({
      id: nanoid(),
      email: 'demo@sitewatch.io',
      name: 'Demo Operator',
      passwordHash: hashPassword('demo1234'),
      provider: 'local',
      createdAt: new Date().toISOString(),
    });
    db.saveUsers(users);
  }
})();

// ---------- helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, provider: u.provider };
}

// ============================================================
// CAPTCHA
// ============================================================
app.get('/api/captcha', (req, res) => {
  const { text, svg } = captcha.generate();
  req.session.captchaText = text;
  res.json({ svg });
});

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (db.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' });

  const users = db.getUsers();
  const user = {
    id: nanoid(),
    email: String(email).toLowerCase(),
    name: name || email.split('@')[0],
    passwordHash: hashPassword(password),
    provider: 'local',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  db.saveUsers(users);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, captchaAnswer } = req.body || {};

  const expected = req.session.captchaText;
  req.session.captchaText = null; // one-time use
  if (!expected || !captchaAnswer || String(captchaAnswer).trim().toUpperCase() !== expected.toUpperCase()) {
    return res.status(400).json({ error: 'Captcha did not match. Please try again.', field: 'captcha' });
  }

  const user = db.findUserByEmail(email || '');
  if (!user || user.provider !== 'local' || !verifyPassword(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.', field: 'credentials' });
  }

  req.session.userId = user.id;
  res.json({ ok: true, user: publicUser(user) });
});

// Mock "Continue with Google" — a real integration would redirect to
// Google's OAuth consent screen and verify an ID token server-side.
app.post('/api/auth/google', (req, res) => {
  let user = db.findUserByEmail('demo.google.user@gmail.com');
  if (!user) {
    const users = db.getUsers();
    user = {
      id: nanoid(),
      email: 'demo.google.user@gmail.com',
      name: 'Google Demo User',
      passwordHash: null,
      provider: 'google',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    db.saveUsers(users);
  }
  req.session.userId = user.id;
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const user = db.findUserByEmail(email || '');
  // Always respond success-shaped (don't leak which emails exist), but
  // for this demo (no mail server) we return the token directly so the
  // flow is testable end-to-end.
  if (!user) return res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });

  const token = crypto.randomBytes(20).toString('hex');
  const users = db.getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].resetToken = token;
  users[idx].resetTokenExpires = Date.now() + 1000 * 60 * 15; // 15 min
  db.saveUsers(users);

  res.json({
    ok: true,
    message: 'Reset link generated (demo mode — no mail server configured, so it is returned here instead of emailed).',
    demoResetLink: `/reset-password.html?token=${token}&email=${encodeURIComponent(user.email)}`,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body || {};
  const user = db.findUserByEmail(email || '');
  if (!user || user.resetToken !== token || !user.resetTokenExpires || Date.now() > user.resetTokenExpires) {
    return res.status(400).json({ error: 'That reset link is invalid or has expired.' });
  }
  const users = db.getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].passwordHash = hashPassword(newPassword);
  users[idx].provider = 'local';
  delete users[idx].resetToken;
  delete users[idx].resetTokenExpires;
  db.saveUsers(users);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: publicUser(user) });
});

// ============================================================
// SITE CHECKING (ad-hoc search bar)
// ============================================================
app.post('/api/check', requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'A URL is required.' });
  const result = await checkSite(url);
  res.json(result);
});

// ============================================================
// WATCHLIST
// ============================================================
app.get('/api/watchlist', requireAuth, (req, res) => {
  const sites = db.getSitesForUser(req.session.userId)
    .slice()
    .sort((a, b) => {
      // Down (and degraded) first, then up. Ties broken by most recently added.
      const rank = s => (s.status === 'down' ? 0 : s.status === 'degraded' ? 1 : 2);
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return new Date(b.addedAt) - new Date(a.addedAt);
    });
  res.json({ sites });
});

app.post('/api/watchlist', requireAuth, async (req, res) => {
  const { url, label } = req.body || {};
  if (!url) return res.status(400).json({ error: 'A URL is required.' });

  const result = await checkSite(url);
  if (!result.url) return res.status(400).json({ error: 'That does not look like a valid URL.' });

  const sites = db.getSites();
  if (sites.some(s => s.userId === req.session.userId && s.url === result.url)) {
    return res.status(409).json({ error: 'That site is already on your watchlist.' });
  }

  const site = {
    id: nanoid(),
    userId: req.session.userId,
    url: result.url,
    label: label || new URL(result.url).hostname,
    status: result.status,
    httpStatus: result.httpStatus,
    responseTime: result.responseTime,
    ssl: result.ssl,
    lastChecked: result.checkedAt,
    addedAt: new Date().toISOString(),
    history: [{ t: result.checkedAt, ms: result.responseTime, status: result.status }],
  };
  sites.push(site);
  db.saveSites(sites);
  res.json({ site });
});

app.delete('/api/watchlist/:id', requireAuth, (req, res) => {
  const sites = db.getSites();
  const next = sites.filter(s => !(s.id === req.params.id && s.userId === req.session.userId));
  if (next.length === sites.length) return res.status(404).json({ error: 'Site not found.' });
  db.saveSites(next);
  res.json({ ok: true });
});

// Force an immediate re-check of one watchlist entry
app.post('/api/watchlist/:id/recheck', requireAuth, async (req, res) => {
  const sites = db.getSites();
  const site = sites.find(s => s.id === req.params.id && s.userId === req.session.userId);
  if (!site) return res.status(404).json({ error: 'Site not found.' });

  const result = await checkSite(site.url);
  site.status = result.status;
  site.httpStatus = result.httpStatus;
  site.responseTime = result.responseTime;
  site.ssl = result.ssl;
  site.lastChecked = result.checkedAt;
  site.history.push({ t: result.checkedAt, ms: result.responseTime, status: result.status });
  if (site.history.length > HISTORY_LIMIT) site.history = site.history.slice(-HISTORY_LIMIT);

  db.saveSites(sites);
  res.json({ site });
});

// ============================================================
// CHATBOT
// ============================================================
app.post('/api/chatbot', (req, res) => {
  const { message } = req.body || {};
  res.json({ reply: chatbot.reply(message) });
});

// ============================================================
// BACKGROUND SCHEDULER — pings every watched site periodically
// ============================================================
async function pingAllSites() {
  const sites = db.getSites();
  if (sites.length === 0) return;

  await Promise.all(sites.map(async (site) => {
    try {
      const result = await checkSite(site.url);
      site.status = result.status;
      site.httpStatus = result.httpStatus;
      site.responseTime = result.responseTime;
      site.ssl = result.ssl;
      site.lastChecked = result.checkedAt;
      site.history = site.history || [];
      site.history.push({ t: result.checkedAt, ms: result.responseTime, status: result.status });
      if (site.history.length > HISTORY_LIMIT) site.history = site.history.slice(-HISTORY_LIMIT);
    } catch {
      // leave last known state if the check itself throws unexpectedly
    }
  }));

  db.saveSites(sites);
}
setInterval(pingAllSites, PING_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`SiteWatch running at http://localhost:${PORT}`);
  console.log('Demo login → email: demo@sitewatch.io / password: demo1234');
});
