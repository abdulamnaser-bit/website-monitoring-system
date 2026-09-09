// monitor.js — performs the actual HTTP reachability check for a URL.
const { performance } = require('perf_hooks');

function normalizeUrl(input) {
  let url = String(input || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks whether a site is reachable.
 * Returns: { url, status: 'up'|'down'|'degraded', httpStatus, responseTime, ssl, checkedAt, error }
 */
async function checkSite(rawUrl, timeoutMs = 9000) {
  const url = normalizeUrl(rawUrl);
  const checkedAt = new Date().toISOString();
  if (!url) {
    return { url: rawUrl, status: 'down', httpStatus: null, responseTime: null, ssl: false, checkedAt, error: 'Invalid URL' };
  }

  const start = performance.now();
  try {
    let res;
    try {
      res = await fetchWithTimeout(url, { method: 'HEAD' }, timeoutMs);
      // Some servers reject HEAD with 403/405 — retry with GET in that case.
      if (res.status === 405 || res.status === 403) {
        res = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
      }
    } catch {
      res = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
    }
    const responseTime = Math.round(performance.now() - start);
    const ssl = url.startsWith('https://');
    const status = res.status >= 500 ? 'degraded' : 'up';
    return { url, status, httpStatus: res.status, responseTime, ssl, checkedAt, error: null };
  } catch (err) {
    const responseTime = Math.round(performance.now() - start);
    const reason = err?.name === 'AbortError' ? 'Timed out' : (err?.code || err?.message || 'Unreachable');
    return { url, status: 'down', httpStatus: null, responseTime, ssl: false, checkedAt, error: reason };
  }
}

module.exports = { checkSite, normalizeUrl };
