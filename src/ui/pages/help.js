// Help, preferences and the protocol log.
// ---------- help ----------
import { prefs } from '../../core/store.js';
import { esc } from '../../core/util.js';
import { hero, section } from '../components.js';
import { BUILD, timeAgo } from '../../core/build.js';
import { updateState, canCheck } from '../../app/updates.js';
import { ic } from '../icons.js';
import { THEMES, getTheme } from '../theme.js';

export function helpPage() {
  const notif = !('Notification' in window) ? 'Not supported in this browser' : Notification.permission === 'granted' ? 'Allowed' : Notification.permission === 'denied' ? 'Blocked in browser settings' : 'Not yet allowed';
  let h = hero(null, 'Help & diagnostics', 'Setup tips, preferences and the raw protocol log.');
  h += section('Preferences', `
    <div class="set"><div><div class="lb">Re-apply saved settings</div><div class="hp">Remember each setting you change and put it back whenever the device reconnects.</div></div><div class="ctl"><label class="switch"><input type="checkbox" id="optRestore" ${prefs.restore ? 'checked' : ''}><span></span></label></div></div>
    <div class="set"><div><div class="lb">Theme</div><div class="hp">System follows your computer's light or dark setting.</div></div><div class="ctl"><div class="seg" role="radiogroup" aria-label="Theme">${THEMES.map(([k, l, icon]) => `<button class="${getTheme() === k ? 'on' : ''}" role="radio" aria-checked="${getTheme() === k}" data-act="theme-set" data-theme="${k}">${ic(icon)}${l}</button>`).join('')}</div></div></div>
    <div class="set"><div><div class="lb">Desktop notifications</div><div class="hp">Used by rules with a "Show a notification" action. Status: ${esc(notif)}.</div></div><div class="ctl">${'Notification' in window && Notification.permission === 'default' ? '<button data-act="notif">Allow</button>' : ''}</div></div>`, '', 'sliders');
  h += section('Getting started', `<ol class="steps" style="padding-bottom:12px">
    <li><b>Plug in your receiver</b> (Unifying, Bolt, Lightspeed or Nano), or connect a Logitech mouse or keyboard directly by USB cable or Bluetooth.</li>
    <li><b>Use Chrome or Edge</b> on a desktop computer. Firefox, Safari and phones don't support WebHID.</li>
    <li><b>Click "Add receiver or device"</b> and choose it in the browser's list. Allowed devices reconnect automatically next time.</li>
    <li><b>Open a receiver</b> to pair or unpair; <b>open a device</b> to see its battery and change settings.</li></ol>`, '', 'flag');
  h += section('Troubleshooting', `
    <div class="set col"><div><div class="lb">Linux: the receiver doesn't show up or won't open</div><div class="hp">Your user needs access to the hidraw device. Create <code>/etc/udev/rules.d/42-logitech.rules</code> containing <code>KERNEL=="hidraw*", ATTRS{idVendor}=="046d", MODE="0660", TAG+="uaccess"</code>, run <code>sudo udevadm control --reload</code>, then replug the receiver.</div></div></div>
    <div class="set col"><div><div class="lb">"Couldn't open" or no replies</div><div class="hp">Close Logi Options+, G HUB and Solaar — they can hold the receiver open. Then unplug and replug it.</div></div></div>
    <div class="set col"><div><div class="lb">Bluetooth devices</div><div class="hp">Pair them in your operating system first, then add them here. macOS may hide some Bluetooth HID interfaces from the browser.</div></div></div>
    <div class="set col"><div><div class="lb">Something still doesn't work</div><div class="hp">Copy the protocol log below and share it — it shows every message exchanged with the receiver.</div></div></div>`, '', 'wrench');
  const built = new Date(BUILD.time);
  const commit = BUILD.repo && /^[0-9a-f]{7,40}$/.test(BUILD.commitFull || '')
    ? `<a href="${esc(BUILD.repo)}/commit/${esc(BUILD.commitFull)}" target="_blank" rel="noopener noreferrer">${esc(BUILD.commit)}</a>` : `<span class="mono">${esc(BUILD.commit)}</span>`;
  const upd = !canCheck() ? 'Update checks need the hosted version (https).'
    : updateState.checking ? 'Checking…'
    : updateState.error ? `Couldn't check: ${updateState.error}`
    : updateState.latest ? (updateState.latest.id === BUILD.id ? `You're on the latest version. Checked ${timeAgo(updateState.checkedAt)}.` : `Version ${updateState.latest.version} is available. Reload to use it.`)
    : 'Not checked yet.';
  h += section('About this build', `<div class="kv">
    <div>Version</div><div>${esc(BUILD.version)}</div>
    <div>Commit</div><div>${commit}</div>
    <div>Built</div><div>${esc(built.toLocaleString())} <span class="muted">(${esc(timeAgo(BUILD.time))})</span></div>
    <div>Build ID</div><div class="mono">${esc(BUILD.id)}</div>
    <div>Updates</div><div>${esc(upd)}</div></div>`,
    `<span class="grow"></span><button class="ghost" data-act="check-update" ${canCheck() && !updateState.checking ? '' : 'disabled'}>${ic('refresh')}Check now</button>`, 'info');
  h += section('Protocol log', `<pre id="log"></pre>`, `<span class="grow"></span><button class="ghost" data-act="log-copy">Copy</button><button class="ghost" data-act="log-clear">Clear</button>`, 'terminal');
  return h;
}
