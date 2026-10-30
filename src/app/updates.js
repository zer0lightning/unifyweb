// Tells the user when a newer build has been published (hosted copies only; file:// can't fetch).
import { BUILD } from '../core/build.js';
import { emit } from '../core/events.js';
import { log } from '../core/log.js';

const EVERY = 30 * 60 * 1000;
let latest = null;
export const updateState = { checking: false, checkedAt: null, latest: null, error: '' };
export const canCheck = () => /^https?:$/.test(location.protocol) && BUILD.id !== 'dev';

/** Accepts only the fields we display, with sane types and lengths. */
function parse(j) {
  const ok = v => typeof v === 'string' && v.length > 0 && v.length <= 80;
  if (!j || !ok(j.id) || !ok(j.version) || !ok(j.commit) || !ok(j.time)) throw new Error('unexpected version.json');
  return { id: j.id, version: j.version, commit: j.commit, time: j.time };
}

export async function checkForUpdate() {
  if (!canCheck() || updateState.checking) return;
  updateState.checking = true; emit('changed', { force: false });
  try {
    const res = await fetch(new URL('version.json', location.href), { cache: 'no-store', credentials: 'omit', redirect: 'error' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const v = parse(await res.json());
    updateState.latest = v; updateState.error = '';
    if (v.id !== BUILD.id && latest?.id !== v.id) { latest = v; emit('update-available', v); log(`update available: ${v.version} (${v.commit})`); }
  } catch (e) { updateState.error = e.message; log('update check: ' + e.message); }
  updateState.checking = false; updateState.checkedAt = new Date().toISOString();
  emit('changed', { force: false });
}

export function startUpdateChecks() {
  if (!canCheck()) return;
  setTimeout(checkForUpdate, 5000);
  setInterval(checkForUpdate, EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - Date.parse(updateState.checkedAt || 0) > 5 * 60 * 1000) checkForUpdate();
  });
}
