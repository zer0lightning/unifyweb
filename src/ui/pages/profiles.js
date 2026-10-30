// Onboard profile editor (gaming mice).
// ---------- profiles ----------
import { esc, hx } from '../../core/util.js';
import { HIDKEYS, MBTN, MEDIA, MODS, PFN, RATES, decBtn, prof } from '../../hidpp/profiles.js';
import { opt, section } from '../components.js';
import { ic } from '../icons.js';

export function btnEditor(i, o, lock) {
  const kinds = [['mouse', 'Mouse button'], ['key', 'Keyboard shortcut'], ['media', 'Media key'], ['fn', 'DPI / profile function'], ['none', 'Disabled']];
  const a = `data-pb="${i}" ${lock}`;
  const kindSel = `<select ${a} data-pk="kind" aria-label="Button ${i + 1} type">${o.k === 'raw' ? '<option value="raw" selected>Macro / other (unchanged)</option>' + kinds.map(([k, l]) => `<option value="${k}">${l}</option>`).join('') : opt(kinds, o.k)}</select>`;
  let extra = '';
  if (o.k === 'mouse') extra = `<select ${a} data-pk="v">${opt(MBTN, o.v)}</select>`;
  if (o.k === 'media') extra = `<select ${a} data-pk="v">${opt(MEDIA, o.v)}</select>`;
  if (o.k === 'fn') extra = `<select ${a} data-pk="v">${opt(PFN, o.v)}</select>`;
  if (o.k === 'key') extra = MODS.map(([m, l]) => `<label class="pill-chk"><input type="checkbox" ${a} data-pk="mod" data-m="${m}" ${o.mod & m ? 'checked' : ''}><span>${l}</span></label>`).join('') + `<select ${a} data-pk="v">${opt(HIDKEYS, o.v)}</select>`;
  return `<span class="row">${kindSel}${extra}</span>`;
}
export function profilesTab(d) {
  const P = d.prof;
  if (!P) return section('Onboard profiles', `<p class="muted" style="margin:10px 0 14px">Gaming mice keep DPI levels, report rate and button assignments in their own memory. Buttons set here can send <b>keyboard shortcuts</b> and <b>media keys</b>, and they work on any computer — even without this page open.</p><div class="row" style="padding-bottom:14px"><button class="primary" data-act="loadprof" data-id="${d.id}" ${d.profLoading ? 'disabled' : ''}>${d.profLoading ? 'Reading mouse memory…' : 'Load profiles from mouse'}</button></div>${d.profError ? `<div class="callout warn">${ic('warn')}<span>${esc(d.profError)}</span></div>` : ''}`, '', 'chip');
  const e = P.entries[P.sel], b = e.bytes, lock = e.crcOk ? '' : 'disabled';
  const dpis = [0, 1, 2, 3, 4].map(i => { const v = b[3 + 2 * i] | (b[4 + 2 * i] << 8); return v === 0xffff ? 0 : v; });
  const lv = dpis.map((v, i) => [i, `Level ${i + 1} — ${v ? v + ' DPI' : 'unused'}`]);
  let h = `<div class="seg" style="margin-bottom:16px" role="tablist">${P.entries.map((x, i) => `<button class="${i === P.sel ? 'on' : ''}" data-act="ptab" data-i="${i}">${esc(prof.name(x) || 'Profile ' + (i + 1))}${x.sector === P.active ? ' <span class="dot on" title="Active"></span>' : ''}</button>`).join('')}</div>`;
  if (!e.crcOk) h += `<div class="callout warn">${ic('warn')}<span>This profile failed its checksum, so editing is turned off to protect the mouse.</span></div>`;
  if (P.rom) h += `<div class="callout">${ic('info')}<span>These are the <b>factory profiles</b>. Saving copies them into the mouse's writable memory; the originals stay untouched.</span></div>`;
  h += section('Profile', `<div class="form">
    <label>Name</label><input type="text" data-pf="name" maxlength="24" value="${esc(prof.name(e))}" placeholder="Profile ${P.sel + 1}" ${lock}>
    <label>Enabled</label><label class="switch"><input type="checkbox" data-pf="enabled" ${e.enabled ? 'checked' : ''} ${lock}><span></span></label>
    <label>Report rate</label><select data-pf="rate" ${lock}>${opt(RATES, b[0])}</select>
    <label>DPI levels</label><div class="row">${dpis.map((v, i) => `<input type="number" data-pf="dpi${i}" min="0" max="25600" step="50" value="${v}" style="width:96px" aria-label="DPI level ${i + 1}" ${lock}>`).join('')}<span class="fine">0 = unused</span></div>
    <label>Default level</label><select data-pf="dflt" ${lock}>${opt(lv, b[1])}</select>
    <label>DPI shift level</label><select data-pf="shift" ${lock}>${opt(lv, b[2])}</select>
    <label>Profile color</label><input type="color" data-pf="color" value="#${hx(b[13])}${hx(b[14])}${hx(b[15])}" ${lock}></div>`,
    `<span class="grow"></span>${e.sector === P.active ? '<span class="chip ok"><span class="dot on"></span>Active</span>' : `<button class="ghost" data-act="activeprof" data-id="${d.id}">Make active</button>`}`, 'chip');
  let rows = '';
  for (let i = 0; i < Math.min(P.info.buttons, 16); i++) rows += `<div class="maprow"><span>Button ${i + 1}</span><span class="arrow">${ic('arrow')}</span>${btnEditor(i, decBtn(b.slice(32 + 4 * i, 36 + 4 * i)), lock)}</div>`;
  h += section('Button assignments', `<p class="fine" style="margin:8px 0 0">Numbers follow the mouse's internal order — usually 1 left, 2 right, 3 middle, 4 back, 5 forward, then DPI and extra buttons.</p><div class="maplist" style="padding-bottom:14px">${rows}</div>`, '', 'button');
  if (P.dirty || P.dirChanged) h += `<div class="savebar"><b>Unsaved changes</b><span class="grow"></span><button class="ghost" data-act="revertprof" data-id="${d.id}">Revert</button><button class="primary" data-act="saveprof" data-id="${d.id}">Save to mouse</button></div>`;
  return h;
}
