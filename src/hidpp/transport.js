// WebHID transport: opens the HID++ collections, serialises requests and matches replies.
import { log } from '../core/log.js';
import { hexb, hx } from '../core/util.js';
import { ERR10, ERR20 } from './constants.js';
import { HidppError } from './errors.js';

export class Transport {
  constructor(hids) {
    this.hids = hids; this.out = {}; this.pending = []; this.listeners = new Set(); this.chain = Promise.resolve();
    for (const h of hids) for (const c of h.collections) for (const r of (c.outputReports || []))
      if ((r.reportId === 0x10 || r.reportId === 0x11) && !this.out[r.reportId]) this.out[r.reportId] = h;
    this.hasShort = !!this.out[0x10]; this.hasLong = !!this.out[0x11];
    this.onReport = this.onReport.bind(this);
  }
  get name() { return this.hids[0].productName || 'Logitech device'; }
  get pid() { return this.hids[0].productId; }
  async open() {
    for (const h of this.hids) { if (!h.opened) await h.open(); h.addEventListener('inputreport', this.onReport); }
  }
  async close() {
    for (const h of this.hids) { h.removeEventListener('inputreport', this.onReport); try { await h.close(); } catch {} }
    for (const p of this.pending) { clearTimeout(p.timer); p.reject(new HidppError('Connection closed', 'closed')); }
    this.pending = [];
  }
  write(bytes, long) {
    let id = (long || !this.hasShort) ? 0x11 : 0x10;
    if (!this.out[id]) id = id === 0x11 ? 0x10 : 0x11;
    const buf = new Uint8Array(id === 0x10 ? 6 : 19);
    buf.set(bytes.slice(0, buf.length));
    log(`→ ${hx(id)} ${hexb(buf)}`);
    return this.out[id].sendReport(id, buf);
  }
  // Requests are serialised so replies never get confused.
  request(devIdx, sub, addr, params = [], { long = false, timeout = 2500 } = {}) {
    const run = () => new Promise((resolve, reject) => {
      const p = { devIdx, sub, addr, resolve, reject };
      p.timer = setTimeout(() => { this.drop(p); reject(new HidppError('No reply — the device may be asleep or out of range', 'timeout')); }, timeout);
      this.pending.push(p);
      this.write([devIdx, sub, addr, ...params], long || params.length > 3).catch(e => { clearTimeout(p.timer); this.drop(p); reject(e); });
    });
    const r = this.chain.then(run, run);
    this.chain = r.catch(() => {});
    return r;
  }
  fire(devIdx, sub, addr, params = []) {
    const run = () => this.write([devIdx, sub, addr, ...params], params.length > 3).catch(e => log('send: ' + e.message));
    this.chain = this.chain.then(run, run);
    return this.chain;
  }
  drop(p) { this.pending = this.pending.filter(x => x !== p); }
  onReport(e) {
    if (e.reportId !== 0x10 && e.reportId !== 0x11) return;
    const b = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength).slice();
    log(`← ${hx(e.reportId)} ${hexb(b)}`);
    const [d, s, a] = b;
    if (s === 0x8f || s === 0xff) {
      const p = this.pending.find(x => x.devIdx === d && x.sub === b[2] && x.addr === b[3]);
      if (p) {
        clearTimeout(p.timer); this.drop(p);
        const v = s === 0xff ? 2 : 1, code = b[4];
        p.reject(new HidppError((v === 2 ? ERR20 : ERR10)[code] || `error 0x${hx(code)}`, code, v));
        return;
      }
    }
    const p = this.pending.find(x => x.devIdx === d && x.sub === s && x.addr === a);
    if (p) { clearTimeout(p.timer); this.drop(p); p.resolve(b.slice(3)); return; }
    for (const fn of this.listeners) { try { fn(b); } catch (err) { log('handler: ' + err.message); } }
  }
}
