// Build metadata injected by scripts/build.js (version, commit, time, unique build ID).
/* global __BUILD__ */
export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__
  : { version: 'dev', commit: 'local', time: new Date(0).toISOString(), id: 'dev', repo: '' };

/** "3 minutes ago", "2 days ago" — for the build-time indicator. */
export function timeAgo(iso, now = Date.now()) {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (!Number.isFinite(s)) return 'unknown';
  if (s < 60) return 'just now';
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (s >= n) { const v = Math.floor(s / n); return `${v} ${u}${v === 1 ? '' : 's'} ago`; }
  return 'just now';
}
