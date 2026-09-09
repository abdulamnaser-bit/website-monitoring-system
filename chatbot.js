// chatbot.js — small rule-based assistant for the on-page help widget.
const RULES = [
  { test: /hi|hello|hey/i, reply: "Hey! I'm Watchbot 🤖 — ask me how to track a site, read the graphs, or fix a login issue." },
  { test: /add.*(site|url|website)|watch.*list|track/i, reply: 'Type a URL in the search bar up top and hit "Check", then press "Add to watchlist" on the result card. It\'ll start getting pinged automatically.' },
  { test: /remove|delete/i, reply: 'Click the ✕ on any card in your watchlist to stop monitoring it.' },
  { test: /down|offline|red/i, reply: 'A red pulse means the last check couldn\'t reach the server (timeout, DNS failure, or a 5xx error). Down sites are always sorted to the top of your list so you see them first.' },
  { test: /up|online|green/i, reply: 'A green pulse means the site answered with a healthy status code recently. Nice and steady.' },
  { test: /graph|chart|history|sparkline/i, reply: 'Each card has a response-time sparkline built from its last checks — spikes mean the server is getting slower, not necessarily down.' },
  { test: /captcha/i, reply: "The captcha is just there to prove you're not a bot logging in. Can't read it? Hit the refresh icon next to it for a new one." },
  { test: /forgot|reset.*password/i, reply: 'Click "Forgot password?" on the login screen, enter your email, and we\'ll simulate sending a reset link (this demo shows it directly since there\'s no mail server).' },
  { test: /gmail|google/i, reply: 'The "Continue with Google" button signs you in with a demo Google identity — wire up real OAuth credentials for production use.' },
  { test: /interval|how often|frequency/i, reply: 'Sites on your watchlist are re-checked automatically every 45 seconds in the background.' },
  { test: /ssl|https|secure/i, reply: 'We flag whether a site was reached over HTTPS. It\'s a quick signal, not a full certificate audit.' },
  { test: /uptime|percentage|%/i, reply: 'Uptime % on each card is calculated from the share of recent checks that came back "up".' },
  { test: /thank/i, reply: "Anytime! I'll be right here in the corner." },
];

function reply(message) {
  const text = String(message || '').trim();
  if (!text) return "Ask me anything about monitoring your sites — adding a URL, reading the graphs, or your login.";
  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.reply;
  }
  return "I'm just a small helper bot, so I mostly know this dashboard: adding sites, reading up/down status, graphs, captcha and login. Try asking about one of those!";
}

module.exports = { reply };
