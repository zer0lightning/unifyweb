// Rules engine: diverts buttons that rules need, turns HID++ events into triggers, and runs actions.
// Rules run in the page; actions can change device settings, show a notification or play a sound.
import { changed } from '../core/events.js';
import { log } from '../core/log.js';
import { allDevices } from '../core/registry.js';
import { store } from '../core/store.js';
import { cidName } from '../hidpp/constants.js';
import { beep, desktopNotify } from './feedback.js';
import { loadRules } from './schema.js';

export const TRIGGERS = [['button','Button is pressed'],['release','Button is released'],['gesture','Mouse gesture (hold button & move)'],['thumbwheel','Thumb wheel is turned'],['connect','Device connects'],['battery','Battery drops below']];
export const DIRS = [['click','Click (no movement)'],['up','Up'],['down','Down'],['left','Left'],['right','Right']];
export const ACTIONS = [['setting','Change a setting'],['cycle','Cycle a setting through values'],['notify','Show a notification'],['sound','Play a sound']];
export const s16 = (a, b) => { const v = (a << 8) | b; return v & 0x8000 ? v - 0x10000 : v; };

export const engine = {
  rules: loadRules(store.get('rules', [])),
  activity: [],
  save() { store.set('rules', this.rules); allDevices().forEach(d => this.sync(d)); },
  applies(r, d) { return r.enabled && (r.device === 'any' || r.device === d.key); },
  needs(d) {
    const m = new Map(); let thumb = false;
    const add = (cid, raw) => { if (cid == null) return; const c = m.get(cid) || { raw:false }; c.raw = c.raw || raw; m.set(cid, c); };
    for (const r of this.rules) {
      if (!this.applies(r, d)) continue;
      const t = r.trigger;
      if (t.type === 'button' || t.type === 'release') add(t.cid, false);
      if (t.type === 'gesture') add(t.cid, true);
      if (t.type === 'thumbwheel') thumb = true;
      if (r.condition?.type === 'held') add(r.condition.cid, false);
    }
    return { m, thumb };
  },
  reset(d) { d.divert = null; d.thumbDiv = false; d.pressed = new Set(); d.gesture = null; },
  // Divert exactly the buttons that rules need; give the rest back to the OS.
  async sync(d) {
    if (d.state !== 'ready' || !d.online || !(d.has(0x1b04) || d.has(0x2150))) return;
    if (d.syncing) { d.resync = true; return; }
    d.syncing = true;
    try {
      const { m, thumb } = this.needs(d);
      if (!d.divert) {
        d.divert = new Map();
        for (const k of d.keys || []) if (k.flags & 0x20) {
          try { const x = await d.call(0x1b04, 2, [k.cid >> 8, k.cid & 255]); d.divert.set(k.cid, x[2] & 0x01 ? (x[2] & 0x10 ? 'raw' : 'div') : 'none'); } catch {}
        }
      }
      for (const k of d.keys || []) {
        if (!(k.flags & 0x20)) continue;
        const w = m.get(k.cid), raw = !!(w && w.raw && (k.addl & 1)), want = w ? (raw ? 'raw' : 'div') : 'none';
        if ((d.divert.get(k.cid) || 'none') === want) continue;
        let fl = w ? 0x03 : 0x02;
        if (k.addl & 1) fl |= raw ? 0x30 : 0x20;
        try { await d.call(0x1b04, 3, [k.cid >> 8, k.cid & 255, fl, 0, 0]); d.divert.set(k.cid, want); log(`${d.title}: ${cidName(k.cid)} ${want === 'none' ? 'returned to normal' : 'now handled by rules'}`); }
        catch (e) { log('divert: ' + e.message); }
      }
      if (d.has(0x2150) && !!d.thumbDiv !== thumb) {
        try { const r = await d.call(0x2150, 1); await d.call(0x2150, 2, [thumb ? 1 : 0, r[1]]); d.thumbDiv = thumb; } catch (e) { log('thumb wheel: ' + e.message); }
      }
    } finally {
      d.syncing = false;
      if (d.resync) { d.resync = false; this.sync(d); }
    }
  },
  gestureCids(d) { const s = new Set(); for (const r of this.rules) if (this.applies(r, d) && r.trigger.type === 'gesture') s.add(r.trigger.cid); return s; },
  event(d, fid, fn, r) {
    if (fid === 0x1b04 && fn === 0) {
      const now = new Set();
      for (let i = 0; i + 1 < 8; i += 2) { const c = (r[i] << 8) | r[i + 1]; if (c) now.add(c); }
      const prev = d.pressed || new Set(); d.pressed = now;
      for (const c of now) if (!prev.has(c)) {
        if (this.gestureCids(d).has(c)) d.gesture = { cid:c, dx:0, dy:0 };
        this.fire(d, { type:'button', cid:c });
      }
      for (const c of prev) if (!now.has(c)) {
        this.fire(d, { type:'release', cid:c });
        if (d.gesture?.cid === c) {
          const g = d.gesture; d.gesture = null;
          const ax = Math.abs(g.dx), ay = Math.abs(g.dy);
          const dir = Math.max(ax, ay) < 50 ? 'click' : ax > ay ? (g.dx > 0 ? 'right' : 'left') : (g.dy > 0 ? 'down' : 'up');
          this.fire(d, { type:'gesture', cid:c, dir });
        }
      }
      return true;
    }
    if (fid === 0x1b04 && fn === 1) { if (d.gesture) { d.gesture.dx += s16(r[0], r[1]); d.gesture.dy += s16(r[2], r[3]); } return true; }
    if (fid === 0x2150 && fn === 0 && d.thumbDiv) {
      const rot = s16(r[0], r[1]), now = Date.now();
      if (rot && now - (d.thumbAt || 0) > 150) { d.thumbAt = now; this.fire(d, { type:'thumbwheel', dir: rot > 0 ? 'right' : 'left' }); }
      return true;
    }
    return false;
  },
  matches(t, ev) {
    if (t.type !== ev.type) return false;
    if (t.type === 'button' || t.type === 'release') return t.cid === ev.cid;
    if (t.type === 'gesture') return t.cid === ev.cid && t.dir === ev.dir;
    if (t.type === 'thumbwheel') return t.dir === ev.dir;
    if (t.type === 'battery') return ev.pct < (t.below ?? 20) && ev.prev >= (t.below ?? 20);
    return true;
  },
  cond(r, d) {
    const c = r.condition;
    if (!c || c.type === 'none') return true;
    if (c.type === 'held') return !!d.pressed?.has(c.cid);
    if (c.type === 'setting') { const s = d.settings.find(x => x.desc.key === c.key); return !!s && JSON.stringify(s.value) === JSON.stringify(c.value); }
    return true;
  },
  describe(ev) {
    if (ev.type === 'button') return `${cidName(ev.cid)} pressed`;
    if (ev.type === 'release') return null;
    if (ev.type === 'gesture') return `${cidName(ev.cid)} gesture: ${ev.dir}`;
    if (ev.type === 'thumbwheel') return `thumb wheel ${ev.dir}`;
    if (ev.type === 'battery') return `battery ${ev.pct}%`;
    return 'connected';
  },
  async fire(d, ev) {
    const what = this.describe(ev);
    if (what && ev.type !== 'connect') this.note(`${d.title}: ${what}`);
    for (const r of this.rules) {
      if (!this.applies(r, d) || !this.matches(r.trigger, ev) || !this.cond(r, d)) continue;
      this.note(`  ↳ rule "${r.name || 'Untitled'}"`);
      for (const a of r.actions || []) { try { await this.run(d, a); } catch (e) { this.note(`  ✗ ${e.message}`); } }
    }
  },
  note(s) {
    this.activity.unshift(`${new Date().toLocaleTimeString()}  ${s}`);
    if (this.activity.length > 40) this.activity.length = 40;
    log('rules: ' + s);
    changed();
  },
  target(d, a) {
    if (!a.target || a.target === 'self') return d;
    const t = allDevices().find(x => x.key === a.target);
    if (!t || t.state !== 'ready' || !t.online) throw new Error('target device is not connected');
    return t;
  },
  async run(d, a) {
    if (a.type === 'notify') return desktopNotify(a.text || 'Rule triggered');
    if (a.type === 'sound') return beep();
    const t = this.target(d, a), s = t.settings.find(x => x.desc.key === a.key);
    if (!s) throw new Error(`${t.title} has no "${a.key}" setting`);
    if (a.type === 'setting') { let v = a.value; if (v === 'toggle') v = !s.value; if (v === undefined) return; return t.setSetting(s, v); }
    if (a.type === 'cycle') {
      const list = String(a.values || '').split(/[\s,]+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
      if (!list.length) return;
      const i = list.indexOf(s.value);
      return t.setSetting(s, list[(i + 1) % list.length]);
    }
  }
};
