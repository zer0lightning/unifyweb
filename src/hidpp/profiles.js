// Onboard profiles (0x8100): read and write the mouse memory, CRC, and button encoding.
import { log } from '../core/log.js';
import { hx } from '../core/util.js';

export const HIDKEYS = (() => {
  const k = [[0, '(none)']];
  for (let i = 0; i < 26; i++) k.push([4 + i, String.fromCharCode(65 + i)]);
  '1234567890'.split('').forEach((c, i) => k.push([0x1e + i, c]));
  [[0x28,'Enter'],[0x29,'Esc'],[0x2a,'Backspace'],[0x2b,'Tab'],[0x2c,'Space'],[0x2d,'-'],[0x2e,'='],[0x2f,'['],[0x30,']'],[0x31,'\\'],[0x33,';'],[0x34,"'"],[0x35,'`'],[0x36,','],[0x37,'.'],[0x38,'/'],[0x39,'Caps Lock']].forEach(x => k.push(x));
  for (let i = 0; i < 12; i++) k.push([0x3a + i, 'F' + (i + 1)]);
  [[0x46,'Print Screen'],[0x47,'Scroll Lock'],[0x48,'Pause'],[0x49,'Insert'],[0x4a,'Home'],[0x4b,'Page Up'],[0x4c,'Delete'],[0x4d,'End'],[0x4e,'Page Down'],[0x4f,'Right arrow'],[0x50,'Left arrow'],[0x51,'Down arrow'],[0x52,'Up arrow']].forEach(x => k.push(x));
  for (let i = 0; i < 12; i++) k.push([0x68 + i, 'F' + (13 + i)]);
  return k;
})();
export const MODS = [[1,'Ctrl'],[2,'Shift'],[4,'Alt'],[8,'Win/⌘']];
export const MEDIA = [[0xcd,'Play/Pause'],[0xb5,'Next track'],[0xb6,'Previous track'],[0xb7,'Stop'],[0xe2,'Mute'],[0xe9,'Volume up'],[0xea,'Volume down'],[0x192,'Calculator'],[0x18a,'Mail'],[0x221,'Search'],[0x223,'Browser home'],[0x224,'Browser back'],[0x225,'Browser forward']];
export const MBTN = [[1,'Left click'],[2,'Right click'],[4,'Middle click'],[8,'Back'],[16,'Forward'],[32,'Button 6'],[64,'Button 7'],[128,'Button 8']];
export const PFN = [[1,'Scroll left'],[2,'Scroll right'],[3,'DPI up'],[4,'DPI down'],[5,'DPI cycle'],[6,'DPI default'],[7,'DPI shift (hold)'],[8,'Next profile'],[9,'Previous profile'],[10,'Cycle profiles'],[11,'G-Shift'],[12,'Show battery'],[15,'Host switch']];
export const RATES = [[1,'1000 Hz'],[2,'500 Hz'],[4,'250 Hz'],[8,'125 Hz']];
export const eqBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export function crc16(a) { // CRC-16/CCITT-FALSE
  let c = 0xffff;
  for (const x of a) { c ^= x << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
  return c;
}
export function decBtn(b) {
  if (b[0] === 0x80) { if (b[1] === 1) return { k:'mouse', v:(b[2] << 8) | b[3] }; if (b[1] === 2) return { k:'key', mod:b[2], v:b[3] }; if (b[1] === 3) return { k:'media', v:(b[2] << 8) | b[3] }; if (b[1] === 0) return { k:'none' }; }
  if (b[0] === 0x90) return { k:'fn', v:b[1] };
  if (b[0] === 0xff && b[1] === 0xff) return { k:'none' };
  return { k:'raw' };
}
export function encBtn(o) {
  switch (o.k) {
    case 'mouse': return [0x80, 1, o.v >> 8, o.v & 255];
    case 'key': return [0x80, 2, o.mod || 0, o.v];
    case 'media': return [0x80, 3, o.v >> 8, o.v & 255];
    case 'fn': return [0x90, o.v, 0, 0];
    default: return [0x80, 0, 0, 0];
  }
}
export const prof = {
  async readSector(d, s, size) {
    const buf = new Uint8Array(size);
    for (let o = 0; o < size; o += 16) { const off = Math.min(o, size - 16); const r = await d.call(0x8100, 5, [s >> 8, s & 255, off >> 8, off & 255]); buf.set(r.slice(0, 16), off); }
    return buf;
  },
  async writeSector(d, s, bytes) {
    const size = bytes.length, c = crc16(bytes.subarray(0, size - 2));
    bytes[size - 2] = c >> 8; bytes[size - 1] = c & 255;
    await d.call(0x8100, 6, [s >> 8, s & 255, 0, 0, size >> 8, size & 255]);
    for (let o = 0; o < size; o += 16) { const ch = Array.from(bytes.slice(o, o + 16)); while (ch.length < 16) ch.push(0xff); await d.call(0x8100, 7, ch); }
    await d.call(0x8100, 8);
  },
  async load(d) {
    const r = await d.call(0x8100, 0);
    const info = { mem:r[0], fmt:r[1], count:r[3], buttons:r[5], size:(r[7] << 8) | r[8] };
    if (info.mem !== 1 || info.fmt < 1 || info.fmt > 5 || info.size < 220 || info.size > 4096 || info.count > 16 || info.buttons > 16) throw new Error(`This mouse uses a profile layout this page doesn't support (memory ${info.mem}, format ${info.fmt}).`);
    let base = 0x0000, rom = false;
    const first = await d.call(0x8100, 5, [0, 0, 0, 0]).catch(() => null);
    if (!first || first.slice(0, 4).every(x => x === 0) || (first[0] === 0xff && first[1] === 0xff)) { base = 0x0100; rom = true; }
    const entries = [];
    for (let i = 0; i < info.count; i++) {
      const off = i * 4, x = await d.call(0x8100, 5, [base >> 8, base & 255, off >> 8, off & 255]);
      const sector = (x[0] << 8) | x[1]; if (sector === 0xffff || sector === 0) break;
      const bytes = await this.readSector(d, sector, info.size);
      const crcOk = crc16(bytes.subarray(0, info.size - 2)) === ((bytes[info.size - 2] << 8) | bytes[info.size - 1]);
      if (!crcOk) log(`profile sector ${hx(sector, 4)}: checksum mismatch`);
      entries.push({ sector, enabled:x[2], bytes, orig:bytes.slice(), crcOk });
    }
    if (!entries.length) throw new Error('No profiles found in the mouse memory.');
    let active = null; try { const a = await d.call(0x8100, 4); active = (a[0] << 8) | a[1]; } catch {}
    return { info, rom, entries, active, sel:Math.max(0, entries.findIndex(e => e.sector === active)), dirty:false, dirChanged:false };
  },
  name(e) { let s = ''; for (let i = 0; i < 48; i += 2) { const c = e.bytes[160 + i] | (e.bytes[161 + i] << 8); if (c === 0 || c === 0xffff) break; s += String.fromCharCode(c); } return s; },
  setName(e, s) { for (let i = 0; i < 24; i++) { const c = i < s.length ? s.charCodeAt(i) : 0; e.bytes[160 + 2 * i] = c & 255; e.bytes[161 + 2 * i] = c >> 8; } },
  async writeDir(d, P) {
    const dir = new Uint8Array(P.info.size).fill(0xff);
    P.entries.forEach((e, i) => { dir[i * 4] = e.sector >> 8; dir[i * 4 + 1] = e.sector & 255; dir[i * 4 + 2] = e.enabled; dir[i * 4 + 3] = 0; });
    await this.writeSector(d, 0x0000, dir);
  },
  async save(d, P) {
    const oldActive = P.entries.findIndex(e => e.sector === P.active);
    if (P.rom) {
      // Factory profiles live in read-only memory: copy them into user sectors 1..n and create a directory.
      P.entries.forEach((e, i) => { e.sector = i + 1; });
      for (const e of P.entries) await this.writeSector(d, e.sector, e.bytes);
      await this.writeDir(d, P);
      P.rom = false;
    } else {
      for (const e of P.entries) if (!eqBytes(e.bytes, e.orig)) await this.writeSector(d, e.sector, e.bytes);
      if (P.dirChanged) await this.writeDir(d, P);
    }
    P.entries.forEach(e => { e.orig = e.bytes.slice(); });
    P.dirty = P.dirChanged = false;
    const act = P.entries[oldActive >= 0 ? oldActive : P.sel];
    try { await d.call(0x8100, 3, [act.sector >> 8, act.sector & 255]); P.active = act.sector; } catch (e) { log('reload profile: ' + e.message); }
  }
};
