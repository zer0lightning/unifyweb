/**
 * Lighting: keyboard backlight (0x1982), brightness (0x8040), LED effects (0x8070 / 0x8071).
 * Each setting: { key, features[], label, help, setup(d,f) -> meta, read(d,f,meta) -> value, write(d,f,value,meta) }.
 * `features` lists HID++ feature IDs in order of preference; the first one the device supports is used.
 */
// Backlight 2 (0x1982) config block, little-endian fields
import { store } from '../../core/store.js';

export async function bl2(d) { const r = await d.call(0x1982, 0); return { en:r[0], opt:r[1], sup:r[2], lvl:r[5], dho:r[6] | (r[7] << 8), dhi:r[8] | (r[9] << 8), dpow:r[10] | (r[11] << 8) }; }
export function bl2w(d, c) { return d.call(0x1982, 1, [c.en, c.opt, 0xff, c.lvl, c.dho & 255, c.dho >> 8, c.dhi & 255, c.dhi >> 8, c.dpow & 255, c.dpow >> 8]); }

// Lighting (0x8070 color LED effects / 0x8071 RGB effects)
export const LOC = {1:'Primary',2:'Logo',3:'Left side',4:'Right side',5:'Combined',6:'Primary 1',7:'Primary 2',8:'Primary 3',9:'Primary 4',10:'Primary 5',11:'Primary 6'};
export const EFFECTS = {0:'Off',1:'Static color',2:'Pulse',3:'Color cycle',0x0a:'Breathe'};
export async function lightZones(d, f) {
  const zones = [];
  const info = async (z, e) => { const x = f === 0x8070 ? await d.call(f, 2, [z, e]) : await d.call(f, 0, [z, e, 0]); return { index:e, id:(x[2] << 8) | x[3], period:(x[6] << 8) | x[7] }; };
  const n = f === 0x8070 ? (await d.call(f, 0))[0] : (await d.call(f, 0, [0xff, 0xff, 0]))[2];
  for (let z = 0; z < Math.min(n, 8); z++) {
    const r = f === 0x8070 ? await d.call(f, 1, [z]) : await d.call(f, 0, [z, 0xff, 0]);
    const loc = f === 0x8070 ? (r[1] << 8) | r[2] : (r[2] << 8) | r[3], cnt = f === 0x8070 ? r[3] : r[4];
    const effects = [];
    for (let e = 0; e < Math.min(cnt, 16); e++) effects.push(await info(z, e));
    zones.push({ zone:z, loc, effects: effects.filter(e => e.id in EFFECTS) });
  }
  return zones.filter(z => z.effects.length);
}
export function effectParams(id, color, period) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) || 0);
  const p = id === 1 ? [r, g, b, 0] : id === 2 ? [r, g, b, 0x50] : id === 3 ? [0, 0, 0, 0, 0, period >> 8, period & 255, 100] : id === 0x0a ? [r, g, b, period >> 8, period & 255, 0, 100] : [];
  return [...p, ...Array(10).fill(0)].slice(0, 10);
}

export default [
  { key:'backlight', features:[0x1982], label:'Keyboard backlight', help:'Off, automatic (uses the ambient light sensor) or a fixed manual level.',
    setup: async d => { const c = await bl2(d); const o = [[0xff,'Off'],[0,'On']]; if (c.sup & 0x08) o.push([1,'Automatic']); o.push([3,'Manual level']); return { type:'choice', options:o }; },
    read: async d => { const c = await bl2(d); return c.en ? (c.opt >> 3) & 3 : 0xff; },
    write: async (d, f, v) => { const c = await bl2(d); if (v === 0xff) c.en = 0; else { c.en = 1; c.opt = (c.opt & 0x07) | (v << 3); } return bl2w(d, c); } },
  { key:'backlight-level', features:[0x1982], label:'Backlight level', help:'Brightness used in manual mode (setting this switches to manual).',
    setup: async d => { let n = 8; try { n = (await d.call(0x1982, 2))[0] || 8; } catch {} return { type:'range', min:0, max:n - 1, step:1 }; },
    read: async d => (await bl2(d)).lvl,
    write: async (d, f, v) => { const c = await bl2(d); c.en = 1; c.opt = (c.opt & 0x07) | (3 << 3); c.lvl = v; return bl2w(d, c); } },
  { key:'backlight-timeout', features:[0x1982], label:'Backlight timeout', help:'Turn the backlight off this long after your hands leave the keyboard.',
    setup: async () => ({ type:'range', min:1, max:60, step:1, fmt: v => v * 5 >= 60 ? `${+(v * 5 / 60).toFixed(1)} min` : `${v * 5} s` }),
    read: async d => Math.max(1, Math.min(60, (await bl2(d)).dho)),
    write: async (d, f, v) => { const c = await bl2(d); c.dho = v; return bl2w(d, c); } },
  { key:'brightness', features:[0x8040], label:'Lighting brightness', help:'Overall brightness of the device lighting.',
    setup: async (d, f) => { const r = await d.call(f, 0); const max = ((r[0] << 8) | r[1]) || 100; return { type:'range', min:0, max, step:1, fmt: v => `${Math.round(v / max * 100)}%` }; },
    read: async (d, f) => { const r = await d.call(f, 1); return (r[0] << 8) | r[1]; },
    write: (d, f, v) => d.call(f, 2, [v >> 8, v & 0xff]) },
  { key:'lighting', features:[0x8071, 0x8070], label:'Lighting effects', help:'Effect and color for each lighting zone. The device can\'t report its current effect, so this shows what you last chose here.',
    setup: async (d, f) => { const zones = await lightZones(d, f); if (!zones.length) throw new Error('no usable lighting zones'); return { type:'lighting', zones }; },
    read: async d => d.light || store.get(d.key, {}).lighting || {},
    write: async (d, f, v, m) => {
      for (const z of m.zones) {
        const s = v[z.zone]; if (!s) continue;
        const e = z.effects.find(x => x.id === s.id); if (!e) continue;
        const params = effectParams(s.id, s.color || '#ffffff', s.period || e.period || 5000);
        await d.call(f, f === 0x8070 ? 3 : 1, [z.zone, e.index, ...params, 0x01]);
      }
      d.light = v;
    } }
].map(s => ({ ...s, group: 'Lighting' }));
