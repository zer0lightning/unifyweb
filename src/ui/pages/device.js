// Device page: tabs for settings, buttons, lighting, profiles and info.
// ---------- device ----------
import { prefs } from '../../core/store.js';
import { esc, hx } from '../../core/util.js';
import { FEATURES, cidName } from '../../hidpp/constants.js';
import { EFFECTS, LOC } from '../../hidpp/settings/lighting.js';
import { GROUP_ORDER, battHtml, crumbs, devSub, emptyCard, hero, iconFor, kindLabel, opt, section, statusChip } from '../components.js';
import { ic } from '../icons.js';
import { profilesTab } from './profiles.js';

export function devTabs(d) {
  const has = g => d.settings.some(s => s.desc.group === g);
  const t = [['settings', 'Settings']];
  if (has('Buttons') || (d.keys || []).some(k => k.flags & 0x20)) t.push(['buttons', 'Buttons']);
  if (has('Lighting')) t.push(['lighting', 'Lighting']);
  if (d.has(0x8100)) t.push(['profiles', 'Profiles']);
  t.push(['info', 'Info']);
  return t;
}
export function stateCard(d) {
  if (d.state === 'loading') return `<div class="card state"><div class="spinner"></div><div><b>Reading device…</b><p class="muted">Getting features, battery and settings. This takes a few seconds.</p></div></div>`;
  if (d.state === 'error') return `<div class="card state"><div class="big-ico">${ic('warn')}</div><div><b>Couldn't read this device</b><p class="muted">${esc(d.error)}</p><button data-act="retry" data-id="${d.id}">Try again</button></div></div>`;
  return `<div class="card state"><div class="big-ico">${ic('sleep')}</div><div><b>Asleep or out of range</b><p class="muted">Move the mouse or press a key to wake it — it will show up here automatically.</p><button data-act="retry" data-id="${d.id}">Check again</button></div></div>`;
}
export function devicePage(d, tab) {
  let h = crumbs(...(d.receiver ? [`<a href="#/r/${d.receiver.id}">${esc(d.receiver.title)}</a>`] : []), `<b>${esc(d.title)}</b>`);
  const chips = statusChip(d) + battHtml(d.battery) + (d.protocol ? `<span class="chip tag" title="Protocol version">HID++ ${d.protocol}</span>` : '');
  const acts = (d.state === 'ready' ? `<button class="ghost" data-act="refresh" data-id="${d.id}" title="Re-read battery and settings">${ic('refresh')}Refresh</button>` : '')
    + (d.receiver ? `<button class="ghost danger" data-act="unpair" data-id="${d.id}">Unpair</button>` : `<button class="ghost" data-act="remove" data-id="${d.id}">Disconnect</button>`);
  h += hero(iconFor(d.kind), d.title, esc(devSub(d)), chips, acts);
  if (d.state !== 'ready') return h + stateCard(d);
  const tabs = devTabs(d), t = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  h += `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<a role="tab" aria-selected="${k === t}" class="tab${k === t ? ' active' : ''}" href="#/d/${d.id}/${k}">${l}</a>`).join('')}</div>`;
  if (t === 'settings') h += settingsTab(d);
  else if (t === 'buttons') h += buttonsTab(d);
  else if (t === 'lighting') h += groupTab(d, 'Lighting', 'No lighting controls.');
  else if (t === 'profiles') h += profilesTab(d);
  else h += infoTab(d);
  return h;
}
export function restoreNote() {
  return `<p class="fine">Changes apply instantly. ${prefs.restore ? 'They\'re remembered and re-applied whenever the device reconnects.' : 'They aren\'t re-applied after the device powers off.'} <a href="#/help">Change</a></p>`;
}
export function settingsTab(d) {
  const groups = {};
  d.settings.forEach((s, i) => { const g = s.desc.group || 'Other'; if (g === 'Lighting' || g === 'Buttons') return; (groups[g] = groups[g] || []).push(settingHtml(s, i)); });
  const order = GROUP_ORDER.filter(g => groups[g]);
  if (!order.length) return emptyCard(d.protocol < 2 ? 'This is an older HID++ 1.0 device. It has no adjustable settings, but pairing and battery work.' : 'No adjustable settings were found on this device.');
  return order.map(g => section(g, groups[g].join(''))).join('') + restoreNote();
}
export function groupTab(d, g, empty) {
  const rows = d.settings.map((s, i) => s.desc.group === g ? settingHtml(s, i) : '').join('');
  return rows ? section(g, rows) + restoreNote() : emptyCard(empty);
}
export function buttonsTab(d) {
  let h = '';
  const i = d.settings.findIndex(s => s.desc.key === 'remap');
  if (i >= 0) h += section('Buttons', settingHtml(d.settings[i], i));
  const div = (d.keys || []).filter(k => k.flags & 0x20);
  if (div.length) {
    const used = c => d.divert?.get(c) && d.divert.get(c) !== 'none';
    h += section('Use buttons in rules', `<p class="muted" style="margin:10px 0 4px">Make a button trigger a rule. While a rule uses it, the button stops doing its normal job.</p>`
      + div.map(k => `<div class="set"><div><div class="lb">${esc(cidName(k.cid))}</div><div class="hp">${k.addl & 1 ? 'Press, release or gesture' : 'Press or release'}${used(k.cid) ? '. <span class="ok-t">Used by a rule</span>' : ''}</div></div><div class="ctl"><button data-act="rule-from" data-cid="${k.cid}" data-id="${d.id}">${ic('plus')}New rule</button></div></div>`).join(''), '', 'rules');
  }
  return h || emptyCard('No programmable buttons were found.');
}
export function infoTab(d) {
  const b = d.battery;
  const kv = [['Name', d.title], ['Kind', kindLabel(d.kind)], ['Connection', d.receiver ? `${d.receiver.title}, slot ${d.idx}` : `Direct (${d.t.name})`],
    ['WPID / PID', d.wpid || hx(d.t.pid, 4)], ['Serial', d.serial || '—'], ...(d.modelId ? [['Model ID', d.modelId]] : []), ['Protocol', `HID++ ${d.protocol}`],
    ...(b ? [['Battery', [b.pct != null ? `${b.pct}%` : b.level, b.mv ? `${(b.mv / 1000).toFixed(2)} V` : '', b.status].filter(Boolean).join(', ')]] : []), ...d.fw];
  let h = section('Device', `<div class="kv">${kv.map(([k, v]) => `<div>${esc(k)}</div><div>${esc(v)}</div>`).join('')}</div>`, `<span class="grow"></span><button class="ghost" data-act="copy" data-id="${d.id}">Copy details</button>`, 'info');
  if (d.features.size) h += section('Supported features', `<table><tr><th>#</th><th>ID</th><th>Feature</th><th>Ver</th></tr>${[...d.features].map(([id, f]) => `<tr><td>${f.index}</td><td class="mono">${hx(id, 4)}</td><td>${esc(FEATURES[id] || 'Unknown')}${f.flags & 0x40 ? ' <span class="muted">(hidden)</span>' : ''}</td><td>${f.version}</td></tr>`).join('')}</table>`, `<span class="grow"></span><span class="fine">${d.features.size}</span>`, 'blocks');
  return h;
}

export function settingHtml(s, i) {
  const m = s.meta, v = s.value;
  const L = `<div><div class="lb">${esc(s.desc.label)}</div><div class="hp">${esc(s.desc.help)}</div></div>`;
  let c = '';
  if (m.type === 'toggle') c = `<label class="switch"><input type="checkbox" data-s="${i}" data-kind="toggle" ${v ? 'checked' : ''} aria-label="${esc(s.desc.label)}"><span></span></label>`;
  else if (m.type === 'choice') c = `<select data-s="${i}" data-kind="choice" aria-label="${esc(s.desc.label)}">${opt(m.options, v)}</select>`;
  else if (m.type === 'range') c = `<input type="range" data-s="${i}" data-kind="range" min="${m.min}" max="${m.max}" step="${m.step}" value="${Number(v)}" aria-label="${esc(s.desc.label)}"><output id="s${i}v">${esc(m.fmt ? m.fmt(v) : v)}</output>`;
  else if (m.type === 'flags') c = m.options.map(([b, l]) => `<label class="pill-chk danger"><input type="checkbox" data-s="${i}" data-kind="flag" data-flag="${b}" ${v & b ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('');
  else if (m.type === 'host') c = `<div class="seg">${Array.from({ length:m.count }, (_, h) => `<button class="${h === v ? 'on' : ''}" data-act="host" data-s="${i}" data-host="${h}" title="${h === v ? 'This computer' : 'Switch to channel ' + (h + 1)}">${h + 1}</button>`).join('')}</div>`;
  else if (m.type === 'keys') return `<div class="set col">${L}<div class="maplist">${m.rows.map(r => `<div class="maprow"><span>${esc(cidName(r.cid))}</span><span class="arrow">${ic('arrow')}</span><select data-s="${i}" data-kind="key" data-key="${r.cid}" aria-label="${esc(cidName(r.cid))} action">${r.targets.map(t => `<option value="${t}" ${t === v[r.cid] ? 'selected' : ''}>${esc(t === r.cid ? `Default (${cidName(t)})` : cidName(t))}</option>`).join('')}</select></div>`).join('')}</div></div>`;
  else if (m.type === 'lighting') return `<div class="set col">${L}<div class="maplist">${m.zones.map(z => {
    const saved = v[z.zone] || {}, st = { id: Number(saved.id ?? z.effects[0].id), color: /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : '#ffffff', period: Number.isInteger(saved.period) ? saved.period : 5000 }, a = `data-s="${i}" data-kind="light" data-lz="${z.zone}"`;
    return `<div class="maprow"><span>${esc(LOC[z.loc] || 'Zone ' + (z.zone + 1))}</span><span class="arrow">${ic('arrow')}</span><span class="row"><select ${a} data-lf="id">${z.effects.map(e => `<option value="${e.id}" ${e.id === st.id ? 'selected' : ''}>${EFFECTS[e.id]}</option>`).join('')}</select>${[1, 2, 0x0a].includes(st.id) ? `<input type="color" ${a} data-lf="color" value="${esc(st.color)}" aria-label="Color">` : ''}${[3, 0x0a].includes(st.id) ? `<input type="range" class="sm" min="1000" max="20000" step="500" value="${st.period}" ${a} data-lf="period" title="Speed — slower to the right" aria-label="Speed">` : ''}</span></div>`;
  }).join('')}</div></div>`;
  return `<div class="set">${L}<div class="ctl">${c}</div></div>`;
}
