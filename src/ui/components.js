// Shared view helpers: icons for device kinds, battery gauge, status, section and page-head markup.
import { esc } from '../core/util.js';
import { ic } from './icons.js';

export const ICON = {keyboard:'keyboard',mouse:'mouse',trackball:'trackball',touchpad:'touchpad',presenter:'presenter',numpad:'numpad',headset:'headset',receiver:'receiver',remote:'remote',gamepad:'gamepad',webcam:'webcam',speaker:'speaker'};
export const GROUP_ORDER = ['Pointer', 'Scrolling', 'Keyboard', 'Connection', 'Other'];
export const GROUP_ICON = { Pointer:'pointer', Scrolling:'scroll', Keyboard:'keyboard', Connection:'swap', Lighting:'light', Buttons:'button', Other:'gear' };

// ---------- small view helpers ----------
export const kindLabel = k => k ? k[0].toUpperCase() + k.slice(1) : 'Device';
export const dotFor = d => d.state === 'loading' ? 'busy' : d.state === 'error' ? 'bad' : d.online ? 'on' : '';
export const iconFor = k => ic(ICON[k] || 'device');
export const sortDevs = r => [...r.devices.values()].sort((a, b) => a.idx - b.idx);
export const opt = (list, v) => list.map(([o, l]) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(l)}</option>`).join('')
  + (v === undefined || list.some(([o]) => o === v) ? '' : `<option value="${esc(v)}" selected>${esc(String(v))}</option>`);
export const section = (title, body, extra = '', icon) =>
  `<section class="grp"><header class="grp-h">${ic(icon || GROUP_ICON[title] || 'gear')}<h2>${esc(title)}</h2>${extra}</header><div class="card card-b">${body}</div></section>`;
export const emptyCard = msg => `<div class="card"><div class="empty">${msg}</div></div>`;
export const crumbs = (...parts) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Dashboard</a>${parts.map(p => `<span aria-hidden="true">/</span>${p}`).join('')}</nav>`;
export const hero = (icon, title, sub, chips = '', actions = '') =>
  `<div class="hero">${icon ? `<div class="tile lg">${icon.startsWith('<') ? icon : ic(icon)}</div>` : ''}<div class="hero-t"><h1>${esc(title)}</h1><div class="hero-sub">${sub}</div>${chips ? `<div class="chips">${chips}</div>` : ''}</div><div class="hero-a">${actions}</div></div>`;

export function battHtml(b) {
  if (!b) return '';
  const p = b.pct, w = p ?? ({ full:100, good:60, low:25, critical:8 }[b.level] ?? 50);
  const cls = w <= 10 ? 'crit' : w <= 25 ? 'low' : '';
  const tip = [b.status, b.mv ? `${(b.mv / 1000).toFixed(2)} V` : ''].filter(Boolean).join(', ');
  return `<span class="batt ${cls}" title="${esc(tip)}"><span class="cell"><i style="width:${w}%"></i></span>${b.charging ? ic('bolt') : ''}${esc(p != null ? `${p}%` : (b.level || '?'))}</span>`;
}
export function statusChip(d) {
  const [cls, txt] = d.state === 'loading' ? ['busy', 'Reading…'] : d.state === 'error' ? ['bad', 'Error'] : d.online ? ['ok', 'Connected'] : d.online === false ? ['', 'Asleep / out of range'] : ['', 'Waiting'];
  return `<span class="chip ${cls}"><span class="dot ${cls === 'ok' ? 'on' : cls}"></span>${txt}</span>`;
}
export const devSub = d => d.receiver ? `${kindLabel(d.kind)} on the ${d.receiver.type} receiver, slot ${d.idx}` : `${kindLabel(d.kind)}, connected directly`;
