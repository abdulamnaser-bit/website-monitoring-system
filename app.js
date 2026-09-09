const POLL_MS = 20000;

// ---------------- auth guard ----------------
async function loadMe() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { location.href = '/login.html'; return null; }
    const { user } = await res.json();
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').textContent = user.name.slice(0, 1).toUpperCase();
    return user;
  } catch {
    location.href = '/login.html';
    return null;
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
});

// ---------------- toast ----------------
function toast(text, kind = 'success') {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ---------------- ad-hoc search / check ----------------
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResult = document.getElementById('searchResult');
const srDot = document.getElementById('srDot');
const srUrl = document.getElementById('srUrl');
const srMeta = document.getElementById('srMeta');
const srAddBtn = document.getElementById('srAddBtn');
let lastChecked = null;

async function runCheck() {
  const url = searchInput.value.trim();
  if (!url) return;
  searchBtn.disabled = true;
  searchBtn.textContent = 'Checking…';
  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    lastChecked = data;
    renderSearchResult(data);
  } catch {
    toast('Could not reach the check service.', 'error');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Check status';
  }
}

function renderSearchResult(data) {
  searchResult.classList.add('show');
  srDot.className = `status-dot ${data.status}`;
  srUrl.textContent = data.url;
  const bits = [];
  bits.push(data.status === 'up' ? 'UP' : data.status === 'degraded' ? 'DEGRADED' : 'DOWN');
  if (data.httpStatus) bits.push(`HTTP ${data.httpStatus}`);
  if (data.responseTime != null) bits.push(`${data.responseTime} ms`);
  bits.push(data.ssl ? 'SSL ✓' : 'no SSL');
  if (data.error) bits.push(data.error);
  srMeta.textContent = bits.join(' · ');
  srAddBtn.disabled = false;
  srAddBtn.textContent = '+ Add to watchlist';
}

searchBtn.addEventListener('click', runCheck);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCheck(); });

srAddBtn.addEventListener('click', async () => {
  if (!lastChecked) return;
  srAddBtn.disabled = true;
  srAddBtn.textContent = 'Adding…';
  try {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: lastChecked.url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add site.');
    toast(`Added ${data.site.label} to your watchlist.`, 'success');
    loadWatchlist();
  } catch (err) {
    toast(err.message, 'error');
    srAddBtn.disabled = false;
    srAddBtn.textContent = '+ Add to watchlist';
  }
});

// ---------------- watchlist ----------------
const grid = document.getElementById('watchlistGrid');
const emptyState = document.getElementById('emptyState');
const watchCount = document.getElementById('watchCount');

function sparklineSVG(history) {
  const points = (history || []).slice(-20);
  if (points.length < 2) {
    return `<svg viewBox="0 0 200 42" preserveAspectRatio="none"><line x1="0" y1="21" x2="200" y2="21" stroke="var(--border)" stroke-width="1"/></svg>`;
  }
  const values = points.map(p => (p.ms == null ? 0 : p.ms));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const stepX = 200 / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = 38 - ((p.ms == null ? 0 : p.ms) - min) / range * 34;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1];
  const strokeColor = last.status === 'down' ? 'var(--rose)' : last.status === 'degraded' ? 'var(--amber)' : 'var(--mint)';
  const areaPath = `M0,42 L${coords.join(' L')} L200,42 Z`;
  const linePath = `M${coords.join(' L')}`;
  const dots = points.map((p, i) => {
    if (p.status !== 'down') return '';
    const x = (i * stepX).toFixed(1);
    const y = (38 - ((p.ms == null ? 0 : p.ms) - min) / range * 34).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="2.4" fill="var(--rose)"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 42" preserveAspectRatio="none">
    <path d="${areaPath}" fill="${strokeColor}" opacity="0.12"/>
    <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}

function timeAgo(iso) {
  if (!iso) return '—';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

function uptimePct(history) {
  if (!history || history.length === 0) return '—';
  const upCount = history.filter(h => h.status === 'up').length;
  return `${Math.round((upCount / history.length) * 100)}%`;
}

function renderWatchlist(sites) {
  grid.innerHTML = '';
  watchCount.textContent = `${sites.length} site${sites.length === 1 ? '' : 's'} · down first`;
  emptyState.style.display = sites.length === 0 ? 'block' : 'none';

  let up = 0, down = 0, totalMs = 0, msCount = 0;

  sites.forEach(site => {
    if (site.status === 'up') up++;
    if (site.status === 'down' || site.status === 'degraded') down++;
    if (typeof site.responseTime === 'number') { totalMs += site.responseTime; msCount++; }

    const card = document.createElement('div');
    card.className = `site-card state-${site.status}`;
    card.innerHTML = `
      <div class="card-top">
        <div class="status-dot ${site.status}"></div>
        <div class="titles">
          <div class="label">${escapeHtml(site.label)}</div>
          <div class="url">${escapeHtml(site.url)}</div>
        </div>
        <button class="remove-btn" title="Remove" data-id="${site.id}">✕</button>
      </div>
      <span class="status-tag ${site.status}">${site.status.toUpperCase()}${site.httpStatus ? ' · HTTP ' + site.httpStatus : ''}</span>
      <div class="card-metrics">
        <div class="metric"><div class="m-val">${site.responseTime ?? '—'}${site.responseTime != null ? 'ms' : ''}</div><div class="m-lbl">LATENCY</div></div>
        <div class="metric"><div class="m-val">${uptimePct(site.history)}</div><div class="m-lbl">UPTIME</div></div>
        <div class="metric"><div class="m-val">${site.ssl ? 'YES' : 'NO'}</div><div class="m-lbl">SSL</div></div>
      </div>
      <div class="sparkline-wrap">${sparklineSVG(site.history)}</div>
      <div class="card-bottom">
        <span class="last-checked">checked ${timeAgo(site.lastChecked)}</span>
        <button class="recheck-btn" data-id="${site.id}">⟳ Recheck</button>
      </div>
    `;
    grid.appendChild(card);
  });

  document.getElementById('statTotal').textContent = sites.length;
  document.getElementById('statUp').textContent = up;
  document.getElementById('statDown').textContent = down;
  document.getElementById('statAvg').textContent = msCount ? Math.round(totalMs / msCount) : '—';

  grid.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeSite(btn.dataset.id));
  });
  grid.querySelectorAll('.recheck-btn').forEach(btn => {
    btn.addEventListener('click', () => recheckSite(btn.dataset.id, btn));
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadWatchlist() {
  try {
    const res = await fetch('/api/watchlist');
    if (res.status === 401) { location.href = '/login.html'; return; }
    const { sites } = await res.json();
    renderWatchlist(sites);
  } catch {
    toast('Could not refresh your watchlist.', 'error');
  }
}

async function removeSite(id) {
  try {
    const res = await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    loadWatchlist();
  } catch {
    toast('Could not remove that site.', 'error');
  }
}

async function recheckSite(id, btn) {
  btn.classList.add('spinning');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/watchlist/${id}/recheck`, { method: 'POST' });
    if (!res.ok) throw new Error();
    loadWatchlist();
  } catch {
    toast('Recheck failed.', 'error');
  } finally {
    btn.classList.remove('spinning');
    btn.disabled = false;
  }
}

// ---------------- chatbot ----------------
const chatLauncher = document.getElementById('chatLauncher');
const chatPanel = document.getElementById('chatPanel');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');

function openChat() { chatPanel.classList.add('open'); chatInput.focus(); }
function closeChat() { chatPanel.classList.remove('open'); }
chatLauncher.addEventListener('click', () => chatPanel.classList.contains('open') ? closeChat() : openChat());
document.getElementById('chatClose').addEventListener('click', closeChat);

function addMsg(text, who) {
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.textContent = text;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
}

async function sendChat(text) {
  if (!text.trim()) return;
  addMsg(text, 'user');
  chatInput.value = '';
  try {
    const res = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    setTimeout(() => addMsg(data.reply, 'bot'), 260);
  } catch {
    addMsg('Sorry, I lost connection to the server.', 'bot');
  }
}

document.getElementById('chatSend').addEventListener('click', () => sendChat(chatInput.value));
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(chatInput.value); });
document.querySelectorAll('.chip-btn').forEach(chip => {
  chip.addEventListener('click', () => sendChat(chip.dataset.q));
});

// ---------------- boot ----------------
(async function init() {
  const user = await loadMe();
  if (!user) return;
  await loadWatchlist();
  setInterval(loadWatchlist, POLL_MS);
})();
