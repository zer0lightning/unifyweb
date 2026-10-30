/**
 * Keyboard: Fn-key inversion and disabling individual keys.
 * Each setting: { key, features[], label, help, setup(d,f) -> meta, read(d,f,meta) -> value, write(d,f,value,meta) }.
 * `features` lists HID++ feature IDs in order of preference; the first one the device supports is used.
 */
export default [
  { key:'fn-swap', features:[0x40a3, 0x40a2, 0x40a0], label:'F1–F12 as standard keys', help:'On: F-keys act as F1–F12, hold Fn for media functions. Off: the reverse.',
    setup: async () => ({ type:'toggle' }),
    read: async (d, f) => f === 0x40a3 ? !!((await d.call(f, 0, [0xff]))[1] & 1) : !!((await d.call(f, 0))[0] & 1),
    write: (d, f, v) => f === 0x40a3 ? d.call(f, 1, [0xff, v ? 1 : 0]) : d.call(f, 1, [v ? 1 : 0]) },
  { key:'disable-keys', features:[0x4521], label:'Disable keys', help:'Turn off keys you hit by accident.',
    setup: async (d, f) => { const m = (await d.call(f, 0))[0]; const names = ['Caps Lock','Num Lock','Scroll Lock','Insert','Windows/⌘'];
      return { type:'flags', options: names.map((n, i) => [1 << i, n]).filter(([b]) => m & b) }; },
    read: async (d, f) => (await d.call(f, 1))[0],
    write: (d, f, v) => d.call(f, 2, [v]) }
].map(s => ({ ...s, group: 'Keyboard' }));
