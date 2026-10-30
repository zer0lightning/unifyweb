// Strict validation for rules coming from files or storage (UW-01, UW-02).
// Builds fresh plain objects, so unknown properties (including __proto__) never survive.
import { SETTINGS } from '../hidpp/settings/index.js';

export const LIMITS = { rules: 200, actions: 10, name: 80, text: 200, key: 200, values: 200 };
const TRIGGER_TYPES = new Set(['button', 'release', 'gesture', 'thumbwheel', 'connect', 'battery']);
const DIRS = { gesture: new Set(['click', 'up', 'down', 'left', 'right']), thumbwheel: new Set(['left', 'right']) };
const COND_TYPES = new Set(['none', 'held', 'setting']);
const ACTION_TYPES = new Set(['setting', 'cycle', 'notify', 'sound']);
const SETTING_KEYS = new Set(SETTINGS.map(s => s.key));

class RuleError extends Error {}
const fail = (where, what) => { throw new RuleError(`${where}: ${what}`); };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max, where) => {
  if (typeof v !== 'string') fail(where, 'must be text');
  if (v.length > max) fail(where, `is longer than ${max} characters`);
  return v;
};
const cid = (v, where) => (Number.isInteger(v) && v >= 0 && v <= 0xffff) ? v : fail(where, 'must be a control ID between 0 and 65535');
const settingKey = (v, where) => (typeof v === 'string' && SETTING_KEYS.has(v)) ? v : fail(where, 'is not a known setting');
/** A setting value as stored in a rule: a number, true/false, or 'toggle'. Device-specific limits are checked again before writing. */
const value = (v, where, allowToggle) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 0xffff) return v;
  if (allowToggle && v === 'toggle') return v;
  return fail(where, 'must be a number, true/false or "toggle"');
};

function trigger(t, w) {
  if (!isObj(t) || !TRIGGER_TYPES.has(t.type)) fail(w, 'has an unknown trigger');
  const out = { type: t.type };
  if (['button', 'release', 'gesture'].includes(t.type)) out.cid = cid(t.cid, `${w} button`);
  if (DIRS[t.type]) { if (!DIRS[t.type].has(t.dir)) fail(w, 'has an unknown direction'); out.dir = t.dir; }
  if (t.type === 'battery') {
    const b = t.below ?? 20;
    if (!Number.isInteger(b) || b < 1 || b > 99) fail(w, 'battery level must be 1–99');
    out.below = b;
  }
  return out;
}

function condition(c, w) {
  if (c == null) return { type: 'none' };
  if (!isObj(c) || !COND_TYPES.has(c.type)) fail(w, 'has an unknown condition');
  if (c.type === 'held') return { type: 'held', cid: cid(c.cid, `${w} held button`) };
  if (c.type === 'setting') return { type: 'setting', key: settingKey(c.key, `${w} condition`), value: value(c.value, `${w} condition value`, false) };
  return { type: 'none' };
}

function action(a, w) {
  if (!isObj(a) || !ACTION_TYPES.has(a.type)) fail(w, 'has an unknown action');
  const out = { type: a.type };
  if (a.type === 'setting' || a.type === 'cycle') {
    out.target = a.target == null ? 'self' : str(a.target, LIMITS.key, `${w} target`);
    out.key = settingKey(a.key, `${w} setting`);
  }
  if (a.type === 'setting' && a.value !== undefined) out.value = value(a.value, `${w} value`, true);
  if (a.type === 'cycle') {
    const v = str(a.values ?? '', LIMITS.values, `${w} values`);
    if (!/^[\d\s,]*$/.test(v)) fail(`${w} values`, 'may only contain numbers and commas');
    out.values = v;
  }
  if (a.type === 'notify') out.text = str(a.text ?? '', LIMITS.text, `${w} message`);
  return out;
}

/** Validate and rebuild one rule. Throws a RuleError that says what is wrong. */
export function sanitizeRule(r, i = 0) {
  const w = `Rule ${i + 1}`;
  if (!isObj(r)) fail(w, 'is not an object');
  const actions = r.actions ?? [];
  if (!Array.isArray(actions)) fail(w, 'actions must be a list');
  if (actions.length > LIMITS.actions) fail(w, `has more than ${LIMITS.actions} actions`);
  return {
    name: str(r.name ?? 'Untitled rule', LIMITS.name, `${w} name`),
    enabled: r.enabled !== false,
    device: str(r.device ?? 'any', LIMITS.key, `${w} device`),
    trigger: trigger(r.trigger, w),
    condition: condition(r.condition, w),
    actions: actions.map((a, j) => action(a, `${w}, action ${j + 1}`))
  };
}

/** Validate a whole rules list (from a file). Throws on the first problem. */
export function sanitizeRules(data) {
  if (!Array.isArray(data)) throw new RuleError('The file does not contain a list of rules.');
  if (data.length > LIMITS.rules) throw new RuleError(`The file has more than ${LIMITS.rules} rules.`);
  return data.map(sanitizeRule);
}

/** Like sanitizeRules, but for stored data: drops bad rules instead of failing. */
export function loadRules(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const [i, r] of data.slice(0, LIMITS.rules).entries()) { try { out.push(sanitizeRule(r, i)); } catch { /* skip tampered entry */ } }
  return out;
}
