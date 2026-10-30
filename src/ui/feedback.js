// Toasts, the top banner and the "new version" notice. All text goes in through textContent.
import { $ } from '../core/util.js';
import { timeAgo } from '../core/build.js';

let toastTimer;
export function showToast(msg, kind = 'ok') {
  const t = $('toast'); t.textContent = msg; t.className = `show ${kind}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 3800);
}
export function banner(msg) { const b = $('banner'); b.textContent = msg || ''; b.className = msg ? 'banner show' : 'banner'; }

/** v: { version, commit, time } from version.json (already validated). */
export function showUpdate(v) {
  const el = $('update');
  el.textContent = '';
  const text = document.createElement('span');
  text.textContent = `UnifyWeb ${v.version} is available (built ${timeAgo(v.time)}). Reload to use it.`;
  const reload = document.createElement('button');
  reload.className = 'primary'; reload.dataset.act = 'reload'; reload.textContent = 'Reload';
  const later = document.createElement('button');
  later.className = 'ghost'; later.dataset.act = 'update-dismiss'; later.textContent = 'Later';
  el.append(text, reload, later);
  el.hidden = false;
}
