/**
 * Scrolling: SmartShift, wheel force, hi-res wheel, scroll direction, thumb wheel.
 * Each setting: { key, features[], label, help, setup(d,f) -> meta, read(d,f,meta) -> value, write(d,f,value,meta) }.
 * `features` lists HID++ feature IDs in order of preference; the first one the device supports is used.
 */

export const ssRead = (d, f) => d.call(f, f === 0x2111 ? 1 : 0);
export const ssWrite = (d, f, p) => d.call(f, f === 0x2111 ? 2 : 1, p);

export default [
  { key:'smartshift-mode', features:[0x2111, 0x2110], label:'Scroll wheel mode', help:'Ratchet (clicky) or free-spinning.',
    setup: async () => ({ type:'choice', options:[[2,'Ratchet'],[1,'Free-spin']] }),
    read: async (d, f) => (await ssRead(d, f))[0],
    write: (d, f, v) => ssWrite(d, f, [v, 0, 0]) },
  { key:'smartshift', features:[0x2111, 0x2110], label:'SmartShift sensitivity', help:'How fast you must flick the wheel before it switches to free-spin. 50 = never switch.',
    setup: async () => ({ type:'range', min:1, max:50, step:1, fmt: v => v >= 50 ? 'Off (always ratchet)' : String(v) }),
    read: async (d, f) => { const v = (await ssRead(d, f))[1]; return v >= 50 ? 50 : (v || 1); },
    write: (d, f, v) => ssWrite(d, f, [0, v >= 50 ? 0xff : v, 0]) },
  { key:'smartshift-torque', features:[0x2111], label:'Scroll wheel force', help:'Ratchet resistance (MX Master 3 and newer).',
    setup: async (d, f) => { const r = await ssRead(d, f); if (!r[2]) throw new Error('no torque'); return { type:'range', min:1, max:100, step:1, fmt: v => `${v}%` }; },
    read: async (d, f) => (await ssRead(d, f))[2],
    write: (d, f, v) => ssWrite(d, f, [0, 0, v]) },
  { key:'hires', features:[0x2121], label:'High-resolution scrolling', help:'Smoother, finer-grained wheel scrolling (some apps scroll faster).',
    setup: async () => ({ type:'toggle' }),
    read: async (d, f) => !!((await d.call(f, 1))[0] & 0x02),
    write: async (d, f, v) => { const m = (await d.call(f, 1))[0] & ~0x01; return d.call(f, 2, [v ? (m | 0x02) : (m & ~0x02)]); } },
  { key:'wheel-invert', features:[0x2121], label:'Reverse scroll direction', help:'"Natural" scrolling for the main wheel.',
    setup: async () => ({ type:'toggle' }),
    read: async (d, f) => !!((await d.call(f, 1))[0] & 0x04),
    write: async (d, f, v) => { const m = (await d.call(f, 1))[0] & ~0x01; return d.call(f, 2, [v ? (m | 0x04) : (m & ~0x04)]); } },
  { key:'thumb-invert', features:[0x2150], label:'Reverse thumb wheel', help:'Invert the horizontal thumb wheel.',
    setup: async () => ({ type:'toggle' }),
    read: async (d, f) => !!(await d.call(f, 1))[1],
    write: (d, f, v) => d.call(f, 2, [d.thumbDiv ? 1 : 0, v ? 1 : 0]) }
].map(s => ({ ...s, group: 'Scrolling' }));
