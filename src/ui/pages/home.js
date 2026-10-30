// Dashboard and the first-run welcome screen.
// ---------- dashboard ----------
import { allDevices, roots } from '../../core/registry.js';
import { esc } from '../../core/util.js';
import { Receiver } from '../../hidpp/receiver.js';
import { battHtml, devSub, emptyCard, hero, iconFor, statusChip } from '../components.js';
import { WELCOME_ART, ic } from '../icons.js';

export function homePage() {
  if (!roots.length) return `<div class="card welcome">
    ${WELCOME_ART}
    <h1>Pair, tune and automate your Logitech gear</h1>
    <p class="muted">Pair and unpair devices, check batteries, and change DPI, scrolling, lighting and buttons. No install: it talks to the receiver straight from Chrome or Edge.</p>
    <button class="primary lg" data-act="add">${ic('plus')}Add receiver or device</button>
    <ol class="steps">
      <li><b>Plug in</b> your Unifying, Bolt or Lightspeed receiver — or connect a device by cable or Bluetooth.</li>
      <li><b>Click Add</b> and pick it in the browser's list.</li>
      <li><b>That's it.</b> Next time it reconnects automatically.</li>
    </ol>
    <p class="fine">Chrome or Edge on Windows, macOS, Linux or ChromeOS. <a href="#/help">Trouble connecting?</a></p>
    <p class="fine">UnifyWeb is not made or supported by Logitech, and no support is offered. Use it at your own risk: see the <a href="#/legal/disclaimer">disclaimer</a>. It collects no data: see the <a href="#/legal/privacy">privacy policy</a>.</p></div>`;
  const devs = allDevices(), rxs = roots.filter(o => o instanceof Receiver);
  const online = devs.filter(d => d.online).length;
  const devCard = d => `<a class="dcard" href="#/d/${d.id}"><div class="tile">${iconFor(d.kind)}</div><div class="dc-body"><div class="dc-name">${esc(d.title)}</div><div class="dc-sub">${esc(devSub(d))}</div><div class="dc-foot">${statusChip(d)}${battHtml(d.battery)}</div></div><span class="chev">${ic('chevron')}</span></a>`;
  const rxCard = r => `<a class="dcard" href="#/r/${r.id}"><div class="tile">${ic('receiver')}</div><div class="dc-body"><div class="dc-name">${esc(r.title)}</div><div class="dc-sub">${r.devices.size} of ${r.maxDevices} slots used</div><div class="dc-foot"><span class="slots">${Array.from({ length:r.maxDevices }, (_, i) => `<i class="${i < r.devices.size ? 'on' : ''}"></i>`).join('')}</span>${r.pair.phase !== 'idle' ? '<span class="chip busy"><span class="dot busy"></span>Pairing</span>' : ''}</div></div><span class="chev">${ic('chevron')}</span></a>`;
  let h = hero(null, 'Dashboard', `${online} of ${devs.length} device${devs.length === 1 ? '' : 's'} connected right now.`);
  h += `<div class="h-sec"><h2>Your devices</h2></div>`;
  h += devs.length ? `<div class="grid">${devs.map(devCard).join('')}</div>` : emptyCard('No devices paired yet. Open a receiver below to pair one.');
  if (rxs.length) h += `<div class="h-sec"><h2>Receivers</h2></div><div class="grid">${rxs.map(rxCard).join('')}</div>`;
  return h;
}
