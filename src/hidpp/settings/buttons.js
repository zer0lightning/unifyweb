/**
 * Buttons: re-assigning controls through reprogrammable keys v4 (0x1B04).
 * Each setting: { key, features[], label, help, setup(d,f) -> meta, read(d,f,meta) -> value, write(d,f,value,meta) }.
 * `features` lists HID++ feature IDs in order of preference; the first one the device supports is used.
 */

export default [
  { key:'remap', features:[0x1b04], label:'Button & key assignments', help:'Re-assign buttons to other built-in functions. These reset when the device powers off, so keep "Re-apply saved settings" on.',
    setup: async (d, f) => {
      const keys = d.keys || [];
      const rows = keys.filter(k => (k.flags & 0x10) && k.gmask).map(k => ({ cid:k.cid,
        targets:[k.cid, ...keys.filter(t => t.cid !== k.cid && t.group && (k.gmask & (1 << (t.group - 1)))).map(t => t.cid)] })).filter(r => r.targets.length > 1);
      if (!rows.length) throw new Error('no remappable keys');
      return { type:'keys', rows };
    },
    read: async (d, f, m) => { const v = {}; for (const r of m.rows) { const x = await d.call(f, 2, [r.cid >> 8, r.cid & 0xff]); v[r.cid] = ((x[3] << 8) | x[4]) || r.cid; } return v; },
    write: async (d, f, v, m) => { for (const r of m.rows) { const t = v[r.cid] ?? r.cid; await d.call(f, 3, [r.cid >> 8, r.cid & 0xff, 0, t >> 8, t & 0xff]); } } }
].map(s => ({ ...s, group: 'Buttons' }));
