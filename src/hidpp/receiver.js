// A Logitech receiver: Unifying / Lightspeed lock-based pairing, Bolt passkey pairing, slots and notifications.
import { changed, emit, toast } from '../core/events.js';
import { log } from '../core/log.js';
import { dec, hexs, hx, nextId } from '../core/util.js';
import { BOLT_ERR, KIND10, PAIR_ERR, RECEIVERS } from './constants.js';
import { Device } from './device.js';

export class Receiver {
  constructor(t) {
    this.t = t; this.id = nextId('r');
    this.type = RECEIVERS[t.pid] || 'USB';
    this.bolt = this.type === 'Bolt';
    this.devices = new Map(); this.pair = { phase: 'idle' };
    this.maxDevices = this.type === 'Nano' ? 1 : 6;
    t.listeners.add(b => this.onNote(b));
  }
  get title() { return `${this.type} receiver`; }
  read(a, p = []) { return this.t.request(0xff, 0x81, a, p); }
  write(a, p = []) { return this.t.request(0xff, 0x80, a, p); }
  readLong(a, p = []) { return this.t.request(0xff, 0x83, a, p); }
  writeLong(a, p = []) { return this.t.request(0xff, 0x82, a, p, { long: true }); }

  async init() {
    try { await this.write(0x00, [0x00, 0x09, 0x00]); } catch (e) { log('notifications: ' + e.message); }
    try { const a = await this.read(0xf1, [0x01]), b = await this.read(0xf1, [0x02]); this.fw = `${hx(a[1])}.${hx(a[2])}.B${hx(b[1])}${hx(b[2])}`; } catch {}
    try { const s = await this.readLong(0xb5, [0x03]); this.serial = hexs(s.slice(1, 5)); if (s[6] >= 1 && s[6] <= 6) this.maxDevices = s[6]; } catch {}
    for (let n = 1; n <= 6; n++) { const info = await this.slotInfo(n); if (info) this.addDevice(n, info); }
    changed();
    try { await this.write(0x02, [0x02]); } catch (e) { log('connection-state: ' + e.message); }
  }

  async slotInfo(n) {
    try {
      if (this.bolt) {
        const pi = await this.readLong(0xb5, [0x50 + n]);
        const wpid = hx(pi[3]) + hx(pi[2]); if (wpid === '0000') return null;
        let name = ''; try { const nm = await this.readLong(0xb5, [0x60 + n, 0x01]); name = dec(nm.slice(3, 3 + nm[2])); } catch {}
        return { wpid, kind: KIND10[pi[1] & 0x0f] || '', serial: hexs(pi.slice(4, 8)), name };
      }
      const pi = await this.readLong(0xb5, [0x20 + n - 1]);
      const wpid = hx(pi[3]) + hx(pi[4]); if (wpid === '0000') return null;
      let name = '', serial = '';
      try { const nm = await this.readLong(0xb5, [0x40 + n - 1]); name = dec(nm.slice(2, 2 + Math.min(nm[1], 14))); } catch {}
      try { const ex = await this.readLong(0xb5, [0x30 + n - 1]); serial = hexs(ex.slice(1, 5)); } catch {}
      return { wpid, kind: KIND10[pi[7] & 0x0f] || '', serial, name };
    } catch { return null; }
  }

  addDevice(n, info) { const d = new Device(this.t, n, this, info); this.devices.set(n, d); return d; }

  async onConnect(slot, addr, data) {
    const online = !(data[0] & 0x40);
    let d = this.devices.get(slot);
    if (!d) {
      const info = (await this.slotInfo(slot)) || { wpid: hx(data[2]) + hx(data[1]), kind: KIND10[addr & 0x0f] || '' };
      d = this.addDevice(slot, info);
      if (this.pair.phase !== 'idle' && this.pair.phase !== 'done') { this.endPair('done', `${d.title} paired.`); toast(`${d.title} paired`); }
    }
    d.setOnline(online);
  }

  onNote(b) {
    const [d, s, a] = b, data = b.slice(3);
    if (d >= 1 && d <= 6) {
      if (s === 0x41) return void this.onConnect(d, a, data);
      if (s === 0x40) { if (a === 0x02 || this.bolt) this.removed(d); return; }
      const dev = this.devices.get(d);
      if (dev && s < 0x40) dev.onEvent(b);
      if (![0x4a, 0x4d, 0x4e, 0x4f, 0x53, 0x54].includes(s)) return;
    }
    const P = this.pair;
    switch (s) {
      case 0x4a: { // Unifying / Lightspeed lock status
        const open = !!(a & 1), err = data[0];
        if (open) { if (P.phase === 'starting') P.phase = 'lock'; }
        else if (P.phase === 'lock' || P.phase === 'starting') this.endPair(err ? 'error' : 'idle', err ? (PAIR_ERR[err] || `Pairing error ${err}`) : '');
        break;
      }
      case 0x53: // Bolt discovery status
        if (a !== 0 && P.phase === 'discover') { P.discoverDone = true; if (!P.found.size) this.endPair('error', data[0] ? 'Discovery failed.' : 'No devices found. Put the device in pairing mode (Easy-Switch light blinking fast) and try again.'); }
        break;
      case 0x4f: { // Bolt device discovered
        if (P.phase !== 'discover') break;
        if (data[1] === 0) {
          const k = hexs(data.slice(6, 12));
          P.found.set(k, Object.assign(P.found.get(k) || {}, { kind: data[3], address: Array.from(data.slice(6, 12)), auth: data[14] }));
          P.last = k;
        } else if (data[1] === 1 && P.last) {
          P.found.get(P.last).name = dec(data.slice(3, 3 + data[2]));
        }
        break;
      }
      case 0x4d: // Bolt passkey
        P.passkey = dec(data.slice(0, 6)); P.phase = 'passkey';
        break;
      case 0x54: { // Bolt pairing status
        const err = data[0];
        if (a === 0x00 && !err) { if (P.phase !== 'passkey') P.phase = 'pairing'; }
        else if (a === 0x02 && !err) { this.endPair('done', 'Device paired.'); toast('Device paired'); }
        else if (err) this.endPair('error', BOLT_ERR[err] || `Pairing error ${err}`);
        else if (P.phase !== 'done') this.endPair('idle');
        break;
      }
    }
    changed();
  }

  async startPair() {
    clearInterval(this.pair.timer);
    if (this.bolt) {
      this.pair = { phase: 'discover', found: new Map(), until: Date.now() + 30000 };
      try { await this.write(0xc0, [30, 0x01]); } catch (e) { return this.endPair('error', 'Could not start discovery: ' + e.message); }
    } else {
      this.pair = { phase: 'starting', until: Date.now() + 30000 };
      try { await this.write(0xb2, [0x01, 0x00, 30]); if (this.pair.phase === 'starting') this.pair.phase = 'lock'; }
      catch (e) { return this.endPair('error', 'Could not enter pairing mode: ' + e.message); }
    }
    this.pair.timer = setInterval(() => {
      if (Date.now() > this.pair.until + 4000 && ['lock', 'starting', 'discover'].includes(this.pair.phase)) this.endPair(this.pair.phase === 'discover' && this.pair.found.size ? 'discover' : 'idle');
      changed();
    }, 1000);
    changed();
  }

  async boltPair(key) {
    const e = this.pair.found.get(key); if (!e) return;
    try { await this.write(0xc0, [0, 0x02]); } catch {}
    clearInterval(this.pair.timer);
    this.pair = { phase: 'pairing', target: e, until: Date.now() + 60000 };
    try { await this.writeLong(0xc1, [0x01, 0x00, ...e.address, e.auth, (e.auth & 1) ? 20 : 10]); }
    catch (err) { this.endPair('error', 'Pairing failed: ' + err.message); }
    changed();
  }

  async cancelPair() {
    try {
      if (this.bolt) { if (this.pair.phase === 'discover') await this.write(0xc0, [0, 0x02]); else await this.writeLong(0xc1, [0x02]); }
      else await this.write(0xb2, [0x02, 0x00, 0x00]);
    } catch (e) { log('cancel: ' + e.message); }
    this.endPair('idle');
  }

  endPair(phase, msg = '') {
    clearInterval(this.pair.timer);
    if (phase === 'discover') { this.pair.phase = 'discover'; this.pair.discoverDone = true; }
    else this.pair = { phase, msg };
    changed();
  }

  async unpair(slot) {
    if (this.bolt) await this.writeLong(0xc1, [0x03, slot]);
    else await this.write(0xb2, [0x03, slot, 0x00]);
    this.removed(slot);
  }

  removed(slot) {
    const dev = this.devices.get(slot);
    this.devices.delete(slot);
    emit('device-removed', { device: dev, receiver: this });
    changed(true);
  }
}
