/**
 * Connection: Easy-Switch host channel (0x1814).
 * Each setting: { key, features[], label, help, setup(d,f) -> meta, read(d,f,meta) -> value, write(d,f,value,meta) }.
 * `features` lists HID++ feature IDs in order of preference; the first one the device supports is used.
 */
import { SW } from '../constants.js';

export default [
  { key:'host', features:[0x1814], label:'Easy-Switch channel', help:'Jump to another paired computer. The device disconnects from this one.', nosave:true,
    setup: async (d, f) => { const r = await d.call(f, 0); return { type:'host', count:r[0] }; },
    read: async (d, f) => (await d.call(f, 0))[1],
    write: (d, f, v) => d.t.fire(d.idx, d.features.get(f).index, (1 << 4) | SW, [v]) }
].map(s => ({ ...s, group: 'Connection' }));
