// db.js — tiny JSON-file "database". Good enough for a demo; swap for
// Postgres/Mongo in production by re-implementing these same functions.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SITES_FILE = path.join(DATA_DIR, 'watchlist.json');

function ensure(file, fallback) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
}

function read(file) {
  ensure(file, []);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---- users ----
function getUsers() { return read(USERS_FILE); }
function saveUsers(users) { write(USERS_FILE, users); }
function findUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
}
function findUserById(id) {
  return getUsers().find(u => u.id === id);
}

// ---- watchlist / sites ----
function getSites() { return read(SITES_FILE); }
function saveSites(sites) { write(SITES_FILE, sites); }
function getSitesForUser(userId) {
  return getSites().filter(s => s.userId === userId);
}

module.exports = {
  getUsers, saveUsers, findUserByEmail, findUserById,
  getSites, saveSites, getSitesForUser,
};
