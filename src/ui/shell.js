// The app frame: the device rail on the left and the main page area.
// ---------- navigation ----------
import { logLines } from '../core/log.js';
import { roots } from '../core/registry.js';
import { $, esc } from '../core/util.js';
import { Receiver } from '../hidpp/receiver.js';
import { engine } from '../rules/engine.js';
import { dotFor, iconFor, sortDevs } from './components.js';
import { ic } from './icons.js';
import { devicePage } from './pages/device.js';
import { helpPage } from './pages/help.js';
import { homePage } from './pages/home.js';
import { receiverPage } from './pages/receiver.js';
import { rulesPage } from './pages/rules.js';
import { ui } from './router.js';
import { BUILD, timeAgo } from '../core/build.js';
import { updateState } from '../app/updates.js';
import { THEMES, getTheme } from './theme.js';
import { legalPage } from './pages/legal.js';

export function navDev(d, child) {
  const sub = d.online === false ? 'Not connected' : d.state === 'loading' ? 'Reading…' : d.battery?.pct != null ? `${d.battery.pct}% battery` : d.battery?.level ? `Battery ${d.battery.level}` : d.online ? 'Connected' : '';
  const act = ui.route.view === 'dev' && ui.route.id === d.id ? ' active' : '';
  return `<a class="nav-item${child ? ' child' : ''}${act}" href="#/d/${d.id}"><span class="ni">${iconFor(d.kind)}</span><span class="nl">${esc(d.title)}<small>${esc(sub)}</small></span><span class="dot ${dotFor(d)}"></span></a>`;
}
export function renderNav() {
  const r = ui.route, cur = (v, id) => (r.view === v && (!id || r.id === id)) ? ' active' : '';
  const n = engine.rules.filter(x => x.enabled).length;
  let h = `<div class="nav-sec">Overview</div><a class="nav-item${cur('home')}" href="#/"><span class="ni">${ic('dashboard')}</span><span class="nl">Dashboard</span></a>`;
  h += `<div class="nav-sec">Devices</div>`;
  if (!roots.length) h += `<div class="nav-empty">Nothing connected yet</div>`;
  for (const o of roots) {
    if (o instanceof Receiver) {
      h += `<a class="nav-item${cur('rx', o.id)}" href="#/r/${o.id}"><span class="ni">${ic('receiver')}</span><span class="nl">${esc(o.title)}<small>${o.devices.size} of ${o.maxDevices} paired</small></span></a>`;
      for (const d of sortDevs(o)) h += navDev(d, true);
    } else h += navDev(o, false);
  }
  h += `<button class="nav-add" data-act="add">${ic('plus')}Add receiver or device</button>`;
  h += `<div class="nav-sec">Automation</div><a class="nav-item${cur('rules')}" href="#/rules"><span class="ni">${ic('rules')}</span><span class="nl">Rules</span>${n ? `<span class="badge">${n}</span>` : ''}</a>`;
  h += `<div class="nav-sec">App</div><a class="nav-item${cur('help')}" href="#/help"><span class="ni">${ic('help')}</span><span class="nl">Help &amp; diagnostics</span></a>`;
  h += `<a class="nav-item${cur('legal')}" href="#/legal/privacy"><span class="ni">${ic('shield')}</span><span class="nl">Privacy &amp; legal</span></a>`;
  h += `<a class="build" href="#/help" title="Built ${esc(new Date(BUILD.time).toLocaleString())}. Build ${esc(BUILD.id)}">
    <span>UnifyWeb ${esc(BUILD.version)} <span class="mono">${esc(BUILD.commit)}</span></span>
    <span>Built ${esc(timeAgo(BUILD.time))}${updateState.latest && updateState.latest.id !== BUILD.id ? ' <b class="upd">Update ready</b>' : ''}</span></a>`;
  h += `<div class="legal-links"><a href="#/legal/privacy">Privacy</a><a href="#/legal/support">Support</a><a href="#/legal/disclaimer">Disclaimer</a><a href="#/legal/credits">Credits</a></div>`;
  $('nav').innerHTML = h;
}

export let rendering = false, renderAgain = false;
export function renderMain() {
  // Blurring the focused field can fire a 'change' that asks for another render; queue it instead of nesting.
  if (rendering) { renderAgain = true; return; }
  rendering = true;
  try {
    const a = document.activeElement;
    if ($('main').contains(a)) a.blur();
    paintMain();
  } finally {
    rendering = false;
    if (renderAgain) { renderAgain = false; renderMain(); }
  }
}
export function paintMain() {
  const r = ui.route; let html;
  if (r.view === 'rules') html = rulesPage();
  else if (r.view === 'legal') html = legalPage(r.tab);
  else if (r.view === 'help') html = helpPage();
  else if (r.view === 'rx' || r.view === 'dev') {
    const o = ui.find(r.id);
    html = !o ? homePage() : o instanceof Receiver ? receiverPage(o) : devicePage(o, r.tab);
  } else html = homePage();
  $('main').innerHTML = `<div class="page">${html}</div>`;
  const lg = $('log'); if (lg) { lg.textContent = logLines.join('\n'); lg.scrollTop = lg.scrollHeight; }
}

/** Top-bar button: shows the current theme preference and cycles System → Light → Dark. */
export function renderThemeButton() {
  const b = $('themeBtn'); if (!b) return;
  const i = THEMES.findIndex(([k]) => k === getTheme()), [, label, icon] = THEMES[i], [, next] = THEMES[(i + 1) % THEMES.length];
  b.innerHTML = ic(icon);
  b.title = `Theme: ${label}. Click for ${next}.`;
  b.setAttribute('aria-label', `Theme: ${label}. Switch to ${next}`);
}
