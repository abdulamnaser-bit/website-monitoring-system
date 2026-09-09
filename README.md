# SiteWatch

A full-stack website uptime monitoring dashboard: HUD-styled login (username/password + captcha + a mock "Continue with Google" + forgot password), and a dashboard where you search any URL for up/down status, add it to a watchlist, and watch response-time sparklines update live. Down and degraded sites always sort to the top of the list. A rule-based chatbot ("Watchbot") sits in the bottom-left corner for in-app help.

## Stack

- **Backend:** Node.js + Express, session-based auth, a tiny JSON-file store (`data/`), a background scheduler that pings every watched site every 45s, and an SVG captcha generator with no native dependencies.
- **Frontend:** Plain HTML/CSS/JS (no build step) — a dark "mission control" HUD look with a grid backdrop, radar sweep, pulsing status dots, and animated sparkline graphs rendered as inline SVG.

## Run it

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

### Demo login
```
email:    demo@sitewatch.io
password: demo1234
```
(Or click "Create one" on the login screen to register your own account.)

## What's implemented

- **Auth:** email/password login with a server-generated SVG captcha, session cookies, "Continue with Google" (mocked — see note below), forgot-password flow that issues a real reset token (shown inline since there's no mail server in this demo), and a reset-password page.
- **Search/check:** paste any URL and get live status (up / degraded / down), HTTP status code, response time, and SSL check.
- **Watchlist:** add/remove sites, list always sorts **down and degraded sites first**, then up sites, each with an uptime %, latency, SSL flag and a response-time sparkline built from its check history.
- **Auto-refresh:** the dashboard polls every 20s and the backend re-pings every watched site every 45s in the background, so status updates without you doing anything.
- **HUD stats bar:** live counts of tracked / up / down sites and average latency.
- **Chatbot:** bottom-left floating widget with quick-reply chips and a small rule-based assistant that explains the dashboard.

## Notes on the mocked pieces

- **Google login** is a stand-in. For real Google Sign-In, register an OAuth client in Google Cloud Console, redirect to Google's consent screen, and verify the returned ID token server-side (e.g. with `google-auth-library`) instead of the `/api/auth/google` mock in `server.js`.
- **Forgot password** doesn't send real email (no SMTP configured) — the reset link is returned directly in the API response so the flow is fully testable. Wire up a provider like SendGrid/SES to email it for real.
- **Storage** is flat JSON files under `data/` for simplicity — swap `db.js` for a real database in production.
