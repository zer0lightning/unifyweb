// Delegated event handlers for every button, field and link in the app.
// ---------- events (delegated) ----------
import { addDevice, removeRoot } from '../app/connect.js';
import { toast } from '../core/events.js';
import { clearLog, logLines } from '../core/log.js';
import { prefs } from '../core/store.js';
import { $ } from '../core/util.js';
import { Device } from '../hidpp/device.js';
import { decBtn, encBtn, prof } from '../hidpp/profiles.js';
import { engine } from '../rules/engine.js';
import { newRule, setPath } from './pages/rules.js';
import { ui } from './router.js';
import { sanitizeRules } from '../rules/schema.js';
import { checkForUpdate } from '../app/updates.js';
import { nextTheme, setTheme } from './theme.js';
import { renderThemeButton } from './shell.js';

export async function copyText(t, ok) { try { await navigator.clipboard.writeText(t); toast(ok); } catch { toast('Clipboard not available', 'err'); } }

/** Wire all UI interactions with three delegated listeners. */
export function bindEvents() {
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const a = b.dataset.act, o = ui.find(b.dataset.id || ui.route.id);
  switch (a) {
    case 'drawer': document.body.classList.toggle('drawer-open'); return;
    case 'add': document.body.classList.remove('drawer-open'); return addDevice();
    case 'pair': return o?.startPair();
    case 'cancel': return o?.cancelPair();
    case 'dismiss': return o?.endPair('idle');
    case 'bolt-pair': return o?.boltPair(b.dataset.key);
    case 'rescan':
      for (const d of o.devices.values()) if (d.state !== 'ready') d.state = 'new';
      try { await o.write(0x02, [0x02]); toast('Asked devices to report in'); } catch (err) { toast(err.message, 'err'); }
      return;
    case 'remove': return o && removeRoot(o);
    case 'unpair':
      if (!o || !confirm(`Unpair "${o.title}" from this receiver?`)) return;
      try { await o.unpair(); toast('Device unpaired'); } catch (err) { toast('Unpair failed: ' + err.message, 'err'); }
      return;
    case 'refresh': return o?.refresh();
    case 'retry': return o?.init().then(() => o.applySaved());
    case 'copy': return copyText(o.details(), 'Device details copied');
    case 'host': {
      const s = o.settings[+b.dataset.s], h = +b.dataset.host;
      if (h !== s.value && confirm(`Switch ${o.title} to channel ${h + 1}? It will disconnect from this computer.`)) o.setSetting(s, h);
      return;
    }
    case 'loadprof':
      o.profLoading = true; o.profError = ''; ui.update(true);
      try { o.prof = await prof.load(o); } catch (err) { o.profError = err.message; }
      o.profLoading = false; return ui.update(true);
    case 'ptab': o.prof.sel = +b.dataset.i; return ui.update(true);
    case 'revertprof': o.prof.entries.forEach(x => { x.bytes = x.orig.slice(); }); o.prof.dirty = o.prof.dirChanged = false; return ui.update(true);
    case 'saveprof':
      if (!confirm('Write these profiles to the mouse memory?')) return;
      b.disabled = true; b.textContent = 'Saving…';
      try { await prof.save(o, o.prof); toast('Profiles saved to the mouse'); } catch (err) { toast('Save failed: ' + err.message, 'err'); }
      return ui.update(true);
    case 'activeprof': {
      const s = o.prof.entries[o.prof.sel].sector;
      try { await o.call(0x8100, 3, [s >> 8, s & 255]); o.prof.active = s; toast('Profile activated'); } catch (err) { toast(err.message, 'err'); }
      return ui.update(true);
    }
    case 'rule-new': return newRule();
    case 'rule-from': return newRule({ device:o.key, trigger:{ type:'button', cid:+b.dataset.cid } });
    case 'rule-edit': ui.draft = JSON.parse(JSON.stringify(engine.rules[+b.dataset.i])); ui.draftIndex = +b.dataset.i; ui.update(true); window.scrollTo(0, 0); return;
    case 'rule-del': if (confirm('Delete this rule?')) { engine.rules.splice(+b.dataset.i, 1); engine.save(); ui.update(true); } return;
    case 'rule-cancel': ui.draft = null; return ui.update(true);
    case 'rule-save': {
      const r = ui.draft, t = r.trigger;
      if (['button', 'release', 'gesture'].includes(t.type) && t.cid == null) return toast('Choose a button for this rule', 'err');
      if (!['button', 'release', 'gesture'].includes(t.type)) delete t.cid;
      if (t.type !== 'gesture' && t.type !== 'thumbwheel') delete t.dir;
      r.name = (r.name || '').trim() || 'Untitled rule';
      if (ui.draftIndex == null) engine.rules.push(r); else engine.rules[ui.draftIndex] = r;
      ui.draft = null; engine.save(); toast('Rule saved'); return ui.update(true);
    }
    case 'act-add': ui.draft.actions.push({ type:'setting', target:'self' }); return ui.update(true);
    case 'act-del': ui.draft.actions.splice(+b.dataset.i, 1); return ui.update(true);
    case 'export': {
      const url = URL.createObjectURL(new Blob([JSON.stringify(engine.rules, null, 2)], { type:'application/json' }));
      const l = document.createElement('a'); l.href = url; l.download = 'unifyweb-rules.json'; l.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    case 'import': return $('ruleFile')?.click();
    case 'notif': if ('Notification' in window) await Notification.requestPermission(); return ui.update(true);
    case 'log-copy': return copyText(logLines.join('\n'), 'Log copied');
    case 'log-clear': clearLog(); return ui.update(true);
    case 'check-update': return checkForUpdate();
    case 'theme': nextTheme(); renderThemeButton(); return ui.update(true);
    case 'theme-set': setTheme(b.dataset.theme); renderThemeButton(); return ui.update(true);
    case 'reload': return location.reload();
    case 'update-dismiss': $('update').hidden = true; return;
  }
});

document.addEventListener('change', async e => {
  const x = e.target;
  if (x.id === 'optRestore') { prefs.restore = x.checked; return; }
  if (x.dataset.f !== undefined && ui.draft) {
    let v = x.value;
    if ('json' in x.dataset) v = JSON.parse(v); else if ('num' in x.dataset) v = Number(v);
    const p = x.dataset.f; setPath(ui.draft, p, v);
    if (/\.target$/.test(p)) setPath(ui.draft, p.replace(/target$/, 'key'), undefined);
    if (/\.(key|target)$/.test(p)) setPath(ui.draft, p.replace(/(key|target)$/, 'value'), undefined);
    if (x.tagName === 'SELECT') ui.update(true);   // text/number fields don't change the form's shape
    return;
  }
  if (x.dataset.ren !== undefined) { engine.rules[+x.dataset.ren].enabled = x.checked; engine.save(); return ui.update(true); }
  if ('importFile' in x.dataset) {
    const f = x.files[0]; if (!f) return;
    try {
      if (f.size > 512 * 1024) throw new Error('the file is larger than 512 KB');
      let raw;
      try { raw = JSON.parse(await f.text()); } catch { throw new Error('the file is not valid JSON'); }
      const data = sanitizeRules(raw);
      if (engine.rules.length && !confirm(`Replace your ${engine.rules.length} rule(s) with ${data.length} imported rule(s)?`)) return;
      // UW-12: imported rules start switched off so they can be reviewed before they touch a device.
      for (const r of data) r.enabled = false;
      engine.rules = data; engine.save(); toast(`Imported ${data.length} rule(s), switched off. Review them, then turn them on.`); ui.update(true);
    } catch (err) { toast('Import failed: ' + err.message, 'err'); }
    finally { x.value = ''; }
    return;
  }
  const o = ui.find(ui.route.id);
  if (!(o instanceof Device)) return;
  if (x.dataset.pf !== undefined) {
    const P = o.prof, en = P.entries[P.sel], b = en.bytes, f = x.dataset.pf;
    if (f === 'name') prof.setName(en, x.value);
    else if (f === 'enabled') { en.enabled = x.checked ? 1 : 0; P.dirChanged = true; }
    else if (f === 'rate') b[0] = +x.value;
    else if (f === 'dflt') b[1] = +x.value;
    else if (f === 'shift') b[2] = +x.value;
    else if (f === 'color') { b[13] = parseInt(x.value.slice(1, 3), 16); b[14] = parseInt(x.value.slice(3, 5), 16); b[15] = parseInt(x.value.slice(5, 7), 16); }
    else if (f.startsWith('dpi')) { const i = +f.slice(3), v = Math.max(0, Math.min(65535, Math.round(+x.value || 0))); b[3 + 2 * i] = v & 255; b[4 + 2 * i] = v >> 8; }
    P.dirty = true; return ui.update(true);
  }
  if (x.dataset.pb !== undefined) {
    const P = o.prof, b = P.entries[P.sel].bytes, i = +x.dataset.pb, off = 32 + 4 * i, k = x.dataset.pk;
    let cur = decBtn(b.slice(off, off + 4));
    if (k === 'kind') { if (x.value === 'raw') return; cur = { k:x.value, v:{ mouse:1, key:4, media:0xcd, fn:3, none:0 }[x.value], mod:0 }; }
    else if (k === 'v') cur.v = +x.value;
    else if (k === 'mod') cur.mod = x.checked ? ((cur.mod || 0) | +x.dataset.m) : ((cur.mod || 0) & ~+x.dataset.m);
    b.set(encBtn(cur), off); P.dirty = true; return ui.update(true);
  }
  if (x.dataset.s === undefined) return;
  const s = o.settings[+x.dataset.s]; if (!s) return;
  switch (x.dataset.kind) {
    case 'toggle': return o.setSetting(s, x.checked);
    case 'choice': case 'range': return o.setSetting(s, Number(x.value));
    case 'flag': { let v = 0; $('main').querySelectorAll(`[data-s="${x.dataset.s}"][data-kind=flag]`).forEach(c => { if (c.checked) v |= +c.dataset.flag; }); return o.setSetting(s, v); }
    case 'key': return o.setSetting(s, { ...s.value, [+x.dataset.key]: Number(x.value) });
    case 'light': {
      const z = +x.dataset.lz, zone = s.meta.zones.find(q => q.zone === z), cur = { ...(s.value || {}) };
      const st = { id:zone.effects[0].id, color:'#ffffff', period:5000, ...(cur[z] || {}) };
      st[x.dataset.lf] = x.dataset.lf === 'color' ? x.value : Number(x.value);
      cur[z] = st; return o.setSetting(s, cur);
    }
  }
});

document.addEventListener('input', e => {
  const x = e.target;
  if (x.dataset.kind !== 'range') return;
  const o = ui.find(ui.route.id), s = o?.settings?.[+x.dataset.s], out = $(`s${x.dataset.s}v`);
  if (s && out) out.textContent = s.meta.fmt ? s.meta.fmt(+x.value) : x.value;
});
}
