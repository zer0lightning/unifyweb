// Hash routing (#/, #/r/<id>, #/d/<id>/<tab>, #/rules, #/help) and the redraw entry point.
import { roots } from '../core/registry.js';
import { $ } from '../core/util.js';
import { Receiver } from '../hidpp/receiver.js';
import { renderMain, renderNav } from './shell.js';

export function parseHash() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  if (p[0] === 'rules') return { view:'rules' };
  if (p[0] === 'help') return { view:'help' };
  if (p[0] === 'legal') return { view:'legal', tab:p[1] };
  if (p[0] === 'r' && p[1]) return { view:'rx', id:p[1] };
  if (p[0] === 'd' && p[1]) return { view:'dev', id:p[1], tab:p[2] };
  return { view:'home' };
}

export const ui = {
  route: parseHash(),
    draft: null, draftIndex: null,
  get selected() { return this.route.view === 'rules' ? 'rules' : this.route.id; },
  go(h) { if (location.hash !== h) location.hash = h; else this.update(true); },
  select(id) { const o = this.find(id); if (!o) return this.go('#/'); this.go(o instanceof Receiver ? `#/r/${id}` : `#/d/${id}`); },
  find(id) {
    if (!id) return null;
    for (const r of roots) { if (r.id === id) return r; if (r.devices) for (const d of r.devices.values()) if (d.id === id) return d; }
    return null;
  },
  update(force) {
    renderNav();
    const m = $('main'), a = document.activeElement;
    if (!force && m.contains(a) && a.matches('input:not([type=checkbox]),select,textarea')) return;
    renderMain();
  }
};

/** Start listening for navigation. */
export function startRouter() {
  window.addEventListener('hashchange', () => {
    ui.route = parseHash();
    document.body.classList.remove('drawer-open');
    ui.update(true);
    window.scrollTo(0, 0);
  });
}
