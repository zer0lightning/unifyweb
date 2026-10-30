// UnifyWeb entry point: wires the protocol layer to the UI.
import { on } from './core/events.js';
import { $ } from './core/util.js';
import { log, logLines } from './core/log.js';
import { BUILD } from './core/build.js';
import { injectIcons } from './ui/icons.js';
import { ui, startRouter } from './ui/router.js';
import { bindEvents } from './ui/events.js';
import { showToast, showUpdate } from './ui/feedback.js';
import { unlockAudio } from './rules/feedback.js';
import { startHid } from './app/connect.js';
import { startUpdateChecks } from './app/updates.js';
import { applyTheme, watchSystemTheme } from './ui/theme.js';
import { renderThemeButton } from './ui/shell.js';

/** UW-05: refuse to run inside another site's frame (GitHub Pages can't send X-Frame-Options). */
function framed() {
  try { return window.top !== window.self; } catch { return true; }
}

if (framed()) {
  const main = $('main');
  document.body.classList.add('framed');
  main.textContent = '';
  const p = document.createElement('p');
  p.className = 'page';
  p.append('For your security, UnifyWeb only runs in its own tab. ');
  const a = document.createElement('a');
  a.href = location.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Open UnifyWeb';
  p.append(a);
  main.append(p);
} else {
  // UW-09: never fail silently.
  window.addEventListener('error', e => { log(`error: ${e.message}`); showToast(`Something went wrong: ${e.message}`, 'err'); });
  window.addEventListener('unhandledrejection', e => {
    const msg = e.reason?.message || String(e.reason);
    log(`unhandled: ${msg}`); showToast(`Something went wrong: ${msg}`, 'err');
  });

  applyTheme();
  injectIcons();
  renderThemeButton();
  watchSystemTheme(() => { renderThemeButton(); ui.update(); });
  unlockAudio();
  bindEvents();
  startRouter();

  on('changed', ({ force }) => ui.update(force));
  on('toast', ({ msg, kind }) => showToast(msg, kind));
  on('update-available', v => showUpdate(v));
  on('log', () => { const el = $('log'); if (el) { el.textContent = logLines.join('\n'); el.scrollTop = el.scrollHeight; } });
  on('device-removed', ({ device, receiver }) => { if (device && ui.route.id === device.id) ui.select(receiver.id); });

  log(`UnifyWeb ${BUILD.version} (${BUILD.commit}), built ${BUILD.time}, build ${BUILD.id}`);
  startHid();
  startUpdateChecks();
  ui.update(true);
}
