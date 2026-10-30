// Rules page and the rule editor.
// ---------- rules ----------
import { allDevices } from '../../core/registry.js';
import { esc } from '../../core/util.js';
import { cidName } from '../../hidpp/constants.js';
import { settingLabel } from '../../hidpp/settings/index.js';
import { ACTIONS, DIRS, TRIGGERS, engine } from '../../rules/engine.js';
import { hero, section } from '../components.js';
import { ic } from '../icons.js';
import { ui } from '../router.js';

export function devName(k) { if (k === 'any') return 'Any device'; const d = allDevices().find(x => x.key === k); return d ? d.title : 'Disconnected device'; }
export const cidN = c => c == null ? 'a button' : cidName(c);
export function ruleSummary(r) {
  const t = r.trigger;
  const T = { button:`${cidN(t.cid)} pressed`, release:`${cidN(t.cid)} released`, gesture:`${cidN(t.cid)} ${t.dir === 'click' ? 'clicked' : 'swiped ' + (t.dir || '')}`, thumbwheel:`Thumb wheel ${t.dir || ''}`, connect:'Device connects', battery:`Battery below ${t.below ?? 20}%` }[t.type] || t.type;
  const c = r.condition?.type === 'held' ? ` while ${cidN(r.condition.cid)} is held` : r.condition?.type === 'setting' ? ` if ${settingLabel(r.condition.key)} = ${JSON.stringify(r.condition.value)}` : '';
  const A = (r.actions || []).map(a => a.type === 'notify' ? 'show a notification' : a.type === 'sound' ? 'play a sound' : a.type === 'cycle' ? `cycle ${settingLabel(a.key)} through ${a.values || '…'}` : a.value === 'toggle' ? `toggle ${settingLabel(a.key)}` : `set ${settingLabel(a.key)} to ${JSON.stringify(a.value)}`).join(', ');
  return `${devName(r.device)}: when ${T}${c}, ${A || 'do nothing'}`;
}
export function setPath(o, p, v) {
  const ks = p.split('.'); let x = o;
  for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (x[k] == null) x[k] = {}; x = x[k]; }
  const last = ks[ks.length - 1];
  if (v === undefined) delete x[last]; else x[last] = v;
}
export function sel(path, opts, v) {
  if (opts.length && !opts.some(([o]) => JSON.stringify(o) === JSON.stringify(v))) { v = opts[0][0]; setPath(ui.draft, path, v); }
  return `<select data-f="${path}" data-json>${opts.map(([o, l]) => `<option value="${esc(JSON.stringify(o))}" ${JSON.stringify(o) === JSON.stringify(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
export function keyOpts(devKey, gesture) {
  const m = new Map();
  for (const d of allDevices()) if (d.keys && (devKey === 'any' || d.key === devKey))
    for (const k of d.keys) if ((k.flags & 0x20) && (!gesture || (k.addl & 1))) m.set(k.cid, cidName(k.cid));
  return [...m];
}
export function settingCatalog(devKey) {
  const m = new Map();
  for (const d of allDevices()) {
    if (d.state !== 'ready' || (devKey && devKey !== 'any' && d.key !== devKey)) continue;
    for (const s of d.settings) if (['toggle', 'choice', 'range', 'host'].includes(s.meta.type) && !m.has(s.desc.key)) m.set(s.desc.key, { label:s.desc.label, meta:s.meta });
  }
  return m;
}
export function valueCtl(path, meta, v, allowToggle) {
  if (!meta) return '';
  if (meta.type === 'range') {
    if (typeof v !== 'number') { v = meta.min; setPath(ui.draft, path, v); }
    return `<input type="number" data-f="${path}" data-num min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${Number(v)}" style="width:110px">`;
  }
  let opts = meta.type === 'toggle' ? [[true, 'On'], [false, 'Off']] : meta.type === 'host' ? Array.from({ length:meta.count }, (_, h) => [h, `Channel ${h + 1}`]) : meta.options;
  if (allowToggle && meta.type === 'toggle') opts = [['toggle', 'Toggle on/off'], ...opts];
  return sel(path, opts, v);
}
export function ruleEditor(devs) {
  const r = ui.draft, t = r.trigger, c = r.condition || (r.condition = { type:'none' });
  const devOpts = [['any', 'Any device'], ...devs.map(d => [d.key, d.title])];
  if (r.device !== 'any' && !devOpts.some(([k]) => k === r.device)) devOpts.push([r.device, '(not connected)']);
  let f = `<label>Name</label><input type="text" data-f="name" value="${esc(r.name)}" placeholder="e.g. Gesture up → high DPI">
    <label>Device</label>${sel('device', devOpts, r.device)}
    <label>When</label>${sel('trigger.type', TRIGGERS, t.type)}`;
  if (['button', 'release', 'gesture'].includes(t.type)) {
    const ko = keyOpts(r.device, t.type === 'gesture');
    f += `<label>Button</label>${ko.length ? sel('trigger.cid', ko, t.cid) : `<span class="warn-t">No ${t.type === 'gesture' ? 'gesture-capable ' : ''}programmable buttons on the connected device${r.device === 'any' ? 's' : ''}.</span>`}`;
  }
  if (t.type === 'gesture') f += `<label>Direction</label>${sel('trigger.dir', DIRS, t.dir)}`;
  if (t.type === 'thumbwheel') f += `<label>Direction</label>${sel('trigger.dir', [['left', 'Left / back'], ['right', 'Right / forward']], t.dir)}`;
  if (t.type === 'battery') f += `<label>Below</label><span class="row"><input type="number" data-f="trigger.below" data-num min="1" max="99" value="${Number.isInteger(t.below) ? t.below : 20}" style="width:90px"> %</span>`;
  f += `<label>Only if</label>${sel('condition.type', [['none', 'Always'], ['held', 'Another button is held'], ['setting', 'A setting has a value']], c.type)}`;
  if (c.type === 'held') { const ko = keyOpts(r.device, false); f += `<label>Held button</label>${ko.length ? sel('condition.cid', ko, c.cid) : '<span class="warn-t">No programmable buttons found.</span>'}`; }
  if (c.type === 'setting') {
    const cat = settingCatalog(r.device), keys = [...cat].map(([k, x]) => [k, x.label]);
    f += keys.length ? `<label>Setting</label>${sel('condition.key', keys, c.key)}<label>Equals</label>${valueCtl('condition.value', cat.get(c.key)?.meta, c.value, false)}` : `<label></label><span class="warn-t">No settings available.</span>`;
  }
  f += `<label class="full" style="margin-top:6px;color:var(--text);font-weight:500">Then do</label><div class="full">`;
  (r.actions || (r.actions = [])).forEach((a, i) => {
    f += `<div class="action"><span class="num">${i + 1}</span>${sel(`actions.${i}.type`, ACTIONS, a.type)}`;
    if (a.type === 'setting' || a.type === 'cycle') {
      const tg = [['self', r.device === 'any' ? 'on the device that triggered' : 'on this device'], ...devs.filter(d => d.key !== r.device).map(d => [d.key, `on ${d.title}`])];
      f += sel(`actions.${i}.target`, tg, a.target || 'self');
      const cat = settingCatalog(a.target && a.target !== 'self' ? a.target : r.device);
      const keys = [...cat].filter(([, x]) => a.type === 'setting' || ['choice', 'range', 'host'].includes(x.meta.type)).map(([k, x]) => [k, x.label]);
      if (keys.length) {
        f += sel(`actions.${i}.key`, keys, a.key);
        const meta = cat.get(a.key)?.meta;
        f += a.type === 'setting' ? valueCtl(`actions.${i}.value`, meta, a.value, true) : `<input type="text" data-f="actions.${i}.values" placeholder="e.g. 800, 1600, 3200" value="${esc(a.values || '')}">`;
      } else f += `<span class="warn-t">Connect a device with adjustable settings first.</span>`;
    }
    if (a.type === 'notify') f += `<input type="text" data-f="actions.${i}.text" placeholder="Message to show" value="${esc(a.text || '')}">`;
    f += `<span class="grow"></span><button class="ghost" data-act="act-del" data-i="${i}" title="Remove this action" aria-label="Remove action">${ic('close')}</button></div>`;
  });
  f += `<button class="ghost" data-act="act-add">${ic('plus')}Add another action</button></div>`;
  const warn = ['button', 'release', 'gesture'].includes(t.type) ? `<div class="callout warn" style="margin:0 0 14px">${ic('warn')}<span>While this rule is on, the chosen button stops doing its normal job and only triggers the rule.</span></div>` : '';
  return `<section class="card editor card-b" style="margin-bottom:28px"><header class="grp-h">${ic('edit')}<h2>${ui.draftIndex == null ? 'New rule' : 'Edit rule'}</h2></header><div><div class="form">${f}</div>${warn}<div class="row" style="padding-bottom:12px"><button class="primary" data-act="rule-save">Save rule</button><button class="ghost" data-act="rule-cancel">Cancel</button></div></div></section>`;
}
export function rulesPage() {
  const devs = allDevices().filter(d => d.state === 'ready');
  const active = engine.rules.filter(r => r.enabled).length;
  let h = hero(null, 'Rules', 'Turn buttons, gestures and the thumb wheel into shortcuts for device actions.',
    `<span class="chip ${active ? 'ok' : ''}"><span class="dot ${active ? 'on' : ''}"></span>${active} of ${engine.rules.length} rule${engine.rules.length === 1 ? '' : 's'} on</span>`,
    `<button class="primary" data-act="rule-new">${ic('plus')}New rule</button><button class="ghost" data-act="import">Import</button><button class="ghost" data-act="export" ${engine.rules.length ? '' : 'disabled'}>Export</button>`);
  h += `<input type="file" id="ruleFile" accept="application/json,.json" data-import-file hidden>`;
  h += `<div class="callout">${ic('tip')}<span>Rules run <b>while this page is open</b>. A web page can't type into other apps or see which app is active, so actions change device settings (DPI, scroll mode, lighting, Easy-Switch…), show a notification or play a sound. For buttons that send <b>keyboard shortcuts</b>, use a gaming mouse's <b>Profiles</b> tab — those run on the mouse itself.</span></div>`;
  if (ui.draft) h += ruleEditor(devs);
  const list = engine.rules.map((r, i) => `<div class="rule ${r.enabled ? '' : 'off'}"><label class="switch"><input type="checkbox" data-ren="${i}" ${r.enabled ? 'checked' : ''} aria-label="Enable ${esc(r.name || 'rule')}"><span></span></label><div><div class="lb">${esc(r.name || 'Untitled rule')}</div><div class="sum">${esc(ruleSummary(r))}</div></div><div class="hero-a"><button class="ghost" data-act="rule-edit" data-i="${i}">Edit</button><button class="ghost danger" data-act="rule-del" data-i="${i}">Delete</button></div></div>`).join('');
  h += section('Your rules', list || `<div class="empty">No rules yet. Click <b>New rule</b>, or open a device's <b>Buttons</b> tab and pick a button.</div>`, '', 'list');
  h += section('Recent activity', `<div class="activity">${esc(engine.activity.join('\n') || 'Nothing yet. Press a button that a rule uses and it shows up here.')}</div>`, '', 'clock');
  return h;
}
export function newRule(preset = {}) {
  const devs = allDevices().filter(d => d.state === 'ready');
  ui.draft = { name:'', enabled:true, device: preset.device || devs[0]?.key || 'any', trigger: preset.trigger || { type:'button' }, condition:{ type:'none' }, actions:[{ type:'setting', target:'self' }] };
  ui.draftIndex = null;
  ui.go('#/rules');
}
