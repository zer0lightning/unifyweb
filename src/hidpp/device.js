// A HID++ device (behind a receiver, or connected directly): features, identity, battery, settings.
import { changed, toast } from '../core/events.js';
import { log } from '../core/log.js';
import { prefs, store } from '../core/store.js';
import { dec, hexs, hx, nextId } from '../core/util.js';
import { BAT_STATUS, parseUnified, voltPct } from './battery.js';
import { FEATURES, KIND20, SW } from './constants.js';
import { SETTINGS } from './settings/index.js';
import { isValidValue } from './settings/validate.js';
import { engine } from '../rules/engine.js';

export class Device {
  constructor(t, idx, receiver, info = {}) {
    Object.assign(this, { t, idx, receiver, id: nextId('d'), wpid: info.wpid || '', kind: info.kind || '', serial: info.serial || '', name: info.name || '' });
    this.online = receiver ? null : true;
    this.features = new Map(); this.byIndex = new Map(); this.settings = []; this.fw = [];
    this.state = 'new'; this.protocol = null; this.battery = null; this.error = '';
    if (!receiver) t.listeners.add(b => { if (b[0] === 0xff) this.onEvent(b); });
  }
  get key() { return `dev:${this.wpid || hx(this.t.pid, 4)}:${this.serial || this.unitId || this.name}`; }
  get title() { return this.name || (this.kind ? this.kind[0].toUpperCase() + this.kind.slice(1) : 'Device') + (this.wpid ? ` ${this.wpid}` : ''); }
  req(fi, fn, params = [], timeout = 3000) { return this.t.request(this.idx, fi, (fn << 4) | SW, params, { timeout }); }
  call(fid, fn, params = []) { const f = this.features.get(fid); if (!f) return Promise.reject(new Error('feature not supported')); return this.req(f.index, fn, params); }
  has(fid) { return this.features.has(fid); }

  async ping() {
    try { const r = await this.req(0, 1, [0, 0, 0x5a], 2500); return r[0] + r[1] / 10; }
    catch (e) { if (e.v === 1 && e.code === 1) return 1.0; throw e; }
  }

  setOnline(on) {
    const was = this.online; this.online = on;
    if (!on) engine.reset(this);
    if (on && (this.state === 'new' || this.state === 'error')) this.init().then(() => this.applySaved());
    else if (on && was === false && this.state === 'ready') this.refresh(true).then(() => this.applySaved());
    changed();
  }

  async init() {
    if (this.state === 'loading') return;
    this.state = 'loading'; this.error = ''; changed();
    try {
      this.protocol = await this.ping();
      if (this.protocol >= 2) {
        await this.enumFeatures();
        await this.readIdentity();
        await this.readFirmware();
        await this.readBattery();
        await this.loadKeys();
        await this.loadSettings();
      } else {
        await this.readBattery10();
      }
      this.online = true; this.state = 'ready';
    } catch (e) {
      if (e.offline) { this.online = false; this.state = 'new'; }
      else { this.state = 'error'; this.error = e.message; }
      log(`${this.title}: ${e.message}`);
    }
    changed();
  }

  async enumFeatures() {
    this.features.clear(); this.byIndex.clear();
    this.features.set(0x0000, { index: 0, flags: 0, version: 0 });
    const fs = (await this.req(0, 0, [0x00, 0x01]))[0];
    if (!fs) throw new Error('feature set not available');
    this.features.set(0x0001, { index: fs, flags: 0, version: 0 });
    const n = Math.min((await this.req(fs, 0))[0], 128);
    for (let i = 1; i <= n; i++) {
      const r = await this.req(fs, 1, [i]);
      const id = (r[0] << 8) | r[1];
      this.features.set(id, { index: i, flags: r[2], version: r[3] });
      this.byIndex.set(i, id);
    }
  }

  async readIdentity() {
    if (this.has(0x0005)) {
      try {
        const len = Math.min((await this.call(0x0005, 0))[0], 64); let s = [];
        while (s.length < len) { const r = await this.call(0x0005, 1, [s.length]); const chunk = Array.from(r.slice(0, len - s.length)); if (!chunk.length) break; s = s.concat(chunk); }
        if (s.length) this.name = dec(s);
        const k = KIND20[(await this.call(0x0005, 2))[0]]; if (k) this.kind = k;
      } catch (e) { log('name: ' + e.message); }
    }
  }

  async readFirmware() {
    this.fw = [];
    if (!this.has(0x0003)) return;
    try {
      const r0 = await this.call(0x0003, 0);
      this.unitId = hexs(r0.slice(1, 5)); this.modelId = hexs(r0.slice(7, 13));
      if (!this.serial && this.unitId !== '00000000') this.serial = this.unitId;
      const kinds = ['Firmware','Bootloader','Hardware','Touchpad','Optical sensor','Softdevice','RF compatibility','Easy-pairing'];
      for (let i = 0; i < Math.min(r0[0], 16); i++) {
        const r = await this.call(0x0003, 1, [i]);
        const kind = kinds[r[0] & 0x0f] || `Entity ${r[0]}`;
        const v = (r[0] & 0x0f) === 2 ? String(r[1]) : `${dec(r.slice(1, 4))} ${hx(r[4])}.${hx(r[5])}.B${hx(r[6])}${hx(r[7])}`.trim();
        this.fw.push([kind, v]);
      }
    } catch (e) { log('firmware: ' + e.message); }
  }

  async readBattery() {
    try {
      if (this.has(0x1004)) this.battery = parseUnified(await this.call(0x1004, 1));
      else if (this.has(0x1000)) { const r = await this.call(0x1000, 0); this.battery = { pct: r[0], status: BAT_STATUS[r[2]] || '', charging: [1, 2, 4].includes(r[2]) }; }
      else if (this.has(0x1001)) { const r = await this.call(0x1001, 0); const mv = (r[0] << 8) | r[1]; this.battery = { pct: voltPct(mv), mv, charging: !!(r[2] & 0x80), status: r[2] & 0x80 ? 'charging' : 'discharging' }; }
    } catch (e) { log('battery: ' + e.message); }
  }

  async readBattery10() {
    try { const r = await this.t.request(this.idx, 0x81, 0x0d); this.battery = { pct: r[0], status: '' }; return; } catch {}
    try { const r = await this.t.request(this.idx, 0x81, 0x07); this.battery = { pct: null, level: `level ${r[0]} of 7`, status: '' }; } catch {}
  }

  async loadKeys() {
    this.keys = [];
    if (!this.has(0x1b04)) return;
    try {
      const n = Math.min((await this.call(0x1b04, 0))[0], 64);
      for (let i = 0; i < n; i++) { const r = await this.call(0x1b04, 1, [i]); this.keys.push({ cid:(r[0] << 8) | r[1], flags:r[4], group:r[6], gmask:r[7], addl:r[8] }); }
    } catch (e) { log('keys: ' + e.message); }
  }

  async loadSettings() {
    this.settings = [];
    for (const desc of SETTINGS) {
      const fid = desc.features.find(f => this.has(f));
      if (fid == null) continue;
      try {
        const meta = await desc.setup(this, fid);
        const value = await desc.read(this, fid, meta);
        this.settings.push({ desc, fid, meta, value });
      } catch (e) { log(`setting ${desc.key}: ${e.message}`); }
    }
  }

  async refresh(quiet) {
    try {
      if (this.protocol >= 2) { await this.readBattery(); for (const s of this.settings) s.value = await s.desc.read(this, s.fid, s.meta); }
      else await this.readBattery10();
      if (!quiet) toast('Refreshed');
    } catch (e) { if (!quiet) toast(e.message, 'err'); }
    changed();
  }

  async setSetting(s, value) {
    if (!isValidValue(s.meta, value)) { toast(`${s.desc.label}: that value isn't valid for this device`, 'err'); log(`rejected ${s.desc.key}=${JSON.stringify(value)}`); return; }
    try {
      await s.desc.write(this, s.fid, value, s.meta);
      if (s.desc.key === 'host') { toast(`Switching to channel ${value + 1}…`); return; }
      s.value = await s.desc.read(this, s.fid, s.meta);
      if (!s.desc.nosave) { const saved = store.get(this.key, {}); saved[s.desc.key] = s.value; store.set(this.key, saved); }
      toast(`${s.desc.label} updated`);
    } catch (e) { toast(`${s.desc.label}: ${e.message}`, 'err'); }
    changed(true);
  }

  async applySaved() {
    if (this.state !== 'ready') return;
    if (prefs.restore) await this.restoreSettings();
    engine.reset(this);
    await engine.sync(this);
    engine.fire(this, { type: 'connect' });
  }

  async restoreSettings() {
    const saved = store.get(this.key, {}); let n = 0;
    for (const s of this.settings) {
      if (s.desc.nosave || !(s.desc.key in saved)) continue;
      const v = saved[s.desc.key];
      if (JSON.stringify(v) === JSON.stringify(s.value)) continue;
      if (!isValidValue(s.meta, v)) { log(`skipped invalid saved ${s.desc.key}`); continue; }
      try { await s.desc.write(this, s.fid, v, s.meta); s.value = await s.desc.read(this, s.fid, s.meta); n++; }
      catch (e) { log(`re-apply ${s.desc.key}: ${e.message}`); }
    }
    if (n) { log(`${this.title}: re-applied ${n} saved setting(s)`); changed(); }
  }

  onEvent(b) {
    const fid = this.byIndex.get(b[1]); if (fid == null || (b[2] & 0x0f) !== 0) return;
    const fn = b[2] >> 4, r = b.slice(3);
    if (engine.event(this, fid, fn, r)) return;
    const prev = this.battery?.pct;
    this.batteryEvent(fid, fn, r);
    if (prev != null && this.battery?.pct != null && this.battery.pct < prev) engine.fire(this, { type: 'battery', pct: this.battery.pct, prev });
  }

  batteryEvent(fid, fn, r) {
    if (fid === 0x1004 && fn === 0) this.battery = parseUnified(r);
    else if (fid === 0x1000 && fn === 0) this.battery = { pct: r[0], status: BAT_STATUS[r[2]] || '', charging: [1, 2, 4].includes(r[2]) };
    else if (fid === 0x1001 && fn === 0) { const mv = (r[0] << 8) | r[1]; this.battery = { pct: voltPct(mv), mv, charging: !!(r[2] & 0x80), status: r[2] & 0x80 ? 'charging' : 'discharging' }; }
    else return;
    changed();
  }

  /** Remove this device from its receiver. The UI asks for confirmation first. */
  async unpair() {
    if (!this.receiver) return;
    try { await this.receiver.unpair(this.idx); toast('Device unpaired'); }
    catch (e) { toast('Unpair failed: ' + e.message, 'err'); }
  }

  details() {
    const L = [`${this.title}`, `  Slot/index: ${this.idx === 0xff ? 'direct' : this.idx}`, `  Kind: ${this.kind}`, `  WPID: ${this.wpid}`, `  Serial: ${this.serial}`, `  Protocol: HID++ ${this.protocol ?? '?'}`];
    if (this.modelId) L.push(`  Model ID: ${this.modelId}`);
    for (const [k, v] of this.fw) L.push(`  ${k}: ${v}`);
    if (this.battery) L.push(`  Battery: ${this.battery.pct ?? ''}${this.battery.pct != null ? '%' : ''} ${this.battery.level || ''} ${this.battery.status || ''}`.trimEnd());
    L.push(`  Features:`);
    for (const [id, f] of this.features) L.push(`    ${String(f.index).padStart(2)}: ${hx(id, 4)} ${FEATURES[id] || ''}${f.version ? ' v' + f.version : ''}`);
    L.push(`  Settings:`);
    for (const s of this.settings) L.push(`    ${s.desc.label}: ${JSON.stringify(s.value)}`);
    return L.join('\n');
  }
}
