// Checks a value against a setting's metadata before it is written to a device (UW-04).
// Values come from the UI, rules, saved settings or imported files; only valid ones reach the hardware.
const isInt = v => Number.isInteger(v);
const COLOR = /^#[0-9a-f]{6}$/i;

export function isValidValue(meta, v) {
  switch (meta?.type) {
    case 'toggle': return typeof v === 'boolean';
    case 'choice': return meta.options.some(([o]) => o === v);
    case 'range': return typeof v === 'number' && Number.isFinite(v) && v >= meta.min && v <= meta.max && isInt((v - meta.min) / meta.step);
    case 'flags': { const mask = meta.options.reduce((m, [b]) => m | b, 0); return isInt(v) && v >= 0 && (v & ~mask) === 0; }
    case 'host': return isInt(v) && v >= 0 && v < meta.count;
    case 'keys': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      return Object.entries(v).every(([k, t]) => { const row = meta.rows.find(r => r.cid === Number(k)); return !!row && row.targets.includes(t); });
    }
    case 'lighting': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      return Object.entries(v).every(([z, s]) => {
        const zone = meta.zones.find(q => q.zone === Number(z));
        return !!zone && s && typeof s === 'object' && zone.effects.some(e => e.id === s.id)
          && (s.color === undefined || (typeof s.color === 'string' && COLOR.test(s.color)))
          && (s.period === undefined || (isInt(s.period) && s.period >= 500 && s.period <= 60000));
      });
    }
    default: return false;
  }
}
