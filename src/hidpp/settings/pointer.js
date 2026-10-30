/**
 * Pointer: onboard profile mode, DPI, pointer speed, report rate.
 * Each setting: { key, features[], label, help, setup(d,f) -> meta, read(d,f,meta) -> value, write(d,f,value,meta) }.
 * `features` lists HID++ feature IDs in order of preference; the first one the device supports is used.
 */

export function parseDpiList(bytes) {
  const out = []; let range = null;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const w = (bytes[i] << 8) | bytes[i + 1];
    if (!w) break;
    if ((w & 0xe000) === 0xe000) {
      const step = w & 0x1fff, max = (bytes[i + 2] << 8) | bytes[i + 3], min = out.pop();
      range = { min, max, step }; i += 2;
    } else out.push(w);
  }
  if (range) return { type: 'range', ...range, fmt: v => `${v} DPI` };
  return { type: 'choice', options: out.map(v => [v, `${v} DPI`]) };
}

export default [
  { key:'onboard', features:[0x8100], label:'Onboard profiles', help:'Gaming mice: switch to host mode so DPI and report-rate changes here take effect.',
    setup: async () => ({ type:'choice', options:[[1,'Onboard (stored on mouse)'],[2,'Host mode (controlled here)']] }),
    read: async (d, f) => (await d.call(f, 2))[0],
    write: (d, f, v) => d.call(f, 1, [v]) },
  { key:'dpi', features:[0x2201], label:'Sensitivity (DPI)', help:'Pointer resolution of the sensor.',
    setup: async (d, f) => parseDpiList((await d.call(f, 1, [0])).slice(1)),
    read: async (d, f) => { const r = await d.call(f, 2, [0]); return (r[1] << 8) | r[2]; },
    write: (d, f, v) => d.call(f, 3, [0, v >> 8, v & 0xff]) },
  { key:'pointer-speed', features:[0x2205], label:'Pointer speed', help:'Speed multiplier applied by the device (1.00× is the default).',
    setup: async () => ({ type:'range', min:46, max:511, step:1, fmt: v => `${(v / 256).toFixed(2)}×` }),
    read: async (d, f) => { const r = await d.call(f, 0); return (r[0] << 8) | r[1]; },
    write: (d, f, v) => d.call(f, 1, [v >> 8, v & 0xff]) },
  { key:'report-rate', features:[0x8060], label:'Report rate', help:'How often the device reports to the computer.',
    setup: async (d, f) => { const m = (await d.call(f, 0))[0]; const o = []; for (let i = 0; i < 8; i++) if (m & (1 << i)) o.push([i + 1, `${Math.round(1000 / (i + 1))} Hz`]); return { type:'choice', options:o }; },
    read: async (d, f) => (await d.call(f, 1))[0],
    write: (d, f, v) => d.call(f, 2, [v]) }
].map(s => ({ ...s, group: 'Pointer' }));
