// Receiver page: pairing flows (Unifying / Lightspeed / Bolt) and paired devices.
// ---------- receiver ----------
import { esc, hx } from '../../core/util.js';
import { KIND10 } from '../../hidpp/constants.js';
import { battHtml, crumbs, hero, iconFor, section, sortDevs, statusChip } from '../components.js';
import { ic } from '../icons.js';

export function pairCard(r) {
  const P = r.pair, full = r.devices.size >= r.maxDevices;
  const left = P.until ? Math.max(0, Math.ceil((P.until - Date.now()) / 1000)) : 0;
  const bar = tot => `<div class="bar"><i style="width:${Math.min(100, left / tot * 100)}%"></i></div><div class="fine">${left}s remaining</div>`;
  const btn = (act, label, cls = '') => `<button class="${cls}" data-act="${act}" data-id="${r.id}">${label}</button>`;
  switch (P.phase) {
    case 'lock': case 'starting':
      return `<div class="card pair live"><h3>Pairing mode is on</h3><ol class="steps"><li><b>Turn your device off, then back on</b> — or press its Connect button.</li><li>Already paired to another receiver? Unpair it there first.</li></ol>${bar(30)}<div class="row" style="margin-top:12px">${btn('cancel', 'Cancel')}</div></div>`;
    case 'discover': {
      const list = [...P.found.entries()].map(([k, e]) => `<div class="lrow"><span class="tile sm">${iconFor(KIND10[e.kind])}</span><span class="lr-t"><b>${esc(e.name || 'Unnamed device')}</b><small class="mono">${esc(k)}</small></span><button class="primary" data-act="bolt-pair" data-key="${k}" data-id="${r.id}">Pair</button></div>`).join('');
      return `<div class="card pair live"><h3>${P.discoverDone ? 'Search finished' : 'Looking for devices…'}</h3><ol class="steps"><li><b>Press and hold</b> the device's Easy-Switch or Connect button until its light <b>blinks quickly</b>.</li><li>Choose it below when it appears.</li></ol>${P.discoverDone ? '' : bar(30)}${list ? `<div class="card-b" style="padding:6px 0 0">${list}</div>` : ''}<div class="row" style="margin-top:12px">${btn('cancel', P.discoverDone ? 'Close' : 'Cancel')}${P.discoverDone ? btn('pair', 'Search again') : ''}</div></div>`;
    }
    case 'pairing':
      return `<div class="card pair live"><div class="row"><div class="spinner"></div><div><h3>Connecting to ${esc(P.target?.name || 'device')}…</h3><p class="muted">Keep the device close to the receiver.</p></div></div><div class="row" style="margin-top:12px">${btn('cancel', 'Cancel')}</div></div>`;
    case 'passkey': {
      const kb = P.target ? (P.target.auth & 1) : 1;
      const clicks = !kb && /^\d+$/.test(P.passkey) ? Number(P.passkey).toString(2).padStart(10, '0').split('').map(c => c === '0' ? 'L' : 'R').join(' ') : '';
      return `<div class="card pair live"><h3>Confirm it's your device</h3>${kb
        ? `<p class="muted">Type this code on the keyboard, then press <b>Enter</b>:</p><div class="passkey">${esc(P.passkey)}</div>`
        : `<p class="muted">Click the mouse buttons in this order (L = left, R = right), then press <b>both</b> together:</p><div class="passkey">${esc(clicks || P.passkey)}</div>`}${btn('cancel', 'Cancel')}</div>`;
    }
    case 'done':
      return `<div class="card pair done"><div class="big-ico">${ic('check')}</div><div><h3>${esc(P.msg || 'Device paired')}</h3><p class="muted">It now appears in the list below.</p></div>${btn('dismiss', 'Done', 'primary')}</div>`;
    case 'error':
      return `<div class="card pair err"><div class="big-ico">${ic('warn')}</div><div><h3>Pairing didn't work</h3><p class="muted">${esc(P.msg)}</p></div><div class="row">${btn('dismiss', 'Dismiss', 'ghost')}${btn('pair', 'Try again', 'primary')}</div></div>`;
    default:
      return `<div class="card pair"><div class="big-ico">${ic('pair')}</div><div><h3>Pair a new device</h3><p class="muted">${full ? 'All slots are in use. Unpair a device first.' : r.bolt ? 'Bolt devices pair securely with a short code.' : 'You\'ll be asked to switch your device off and on.'}</p></div><button class="primary" data-act="pair" data-id="${r.id}" ${full ? 'disabled' : ''}>Start pairing</button></div>`;
  }
}

export function receiverPage(r) {
  const used = r.devices.size;
  const meter = `<span class="slots" title="${used} of ${r.maxDevices} slots used">${Array.from({ length:r.maxDevices }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('')}</span>`;
  let h = crumbs(`<b>${esc(r.title)}</b>`);
  h += hero('receiver', r.title, esc(r.t.name), `<span class="chip">${meter}${used} of ${r.maxDevices} slots used</span>`,
    `<button class="ghost" data-act="rescan" data-id="${r.id}" title="Ask paired devices to report in">${ic('refresh')}Rescan</button><button class="ghost" data-act="remove" data-id="${r.id}">Disconnect</button>`);
  if (r.type === 'Nano') h += `<div class="callout warn">${ic('warn')}<span>Nano receivers come pre-paired with one device and usually can't pair anything else.</span></div>`;
  if (r.type === 'USB') h += `<div class="callout warn">${ic('warn')}<span>This receiver (PID ${hx(r.t.pid, 4)}) isn't recognised. Pairing may or may not work.</span></div>`;
  h += pairCard(r);
  const rows = sortDevs(r).map(d => `<a class="lrow" href="#/d/${d.id}"><span class="tile sm">${iconFor(d.kind)}</span><span class="lr-t"><b>${esc(d.title)}</b><small>Slot ${d.idx}${d.wpid ? ', WPID ' + d.wpid : ''}</small></span>${battHtml(d.battery)}${statusChip(d)}<span class="chev">${ic('chevron')}</span></a>`).join('');
  h += section('Paired devices', rows || '<div class="empty">No devices paired yet. Use Start pairing above.</div>', '', 'link');
  h += section('Receiver details', `<div class="kv"><div>Type</div><div>${esc(r.type)}</div><div>USB ID</div><div class="mono">046D:${hx(r.t.pid, 4)}</div><div>Serial</div><div class="mono">${esc(r.serial || '—')}</div><div>Firmware</div><div class="mono">${esc(r.fw || '—')}</div></div>`, '', 'info');
  return h;
}
