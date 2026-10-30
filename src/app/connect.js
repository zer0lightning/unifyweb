// Finding, opening and closing receivers and devices through WebHID.
import { toast } from '../core/events.js';
import { log } from '../core/log.js';
import { roots } from '../core/registry.js';
import { hx } from '../core/util.js';
import { RECEIVERS, VID } from '../hidpp/constants.js';
import { Device } from '../hidpp/device.js';
import { Receiver } from '../hidpp/receiver.js';
import { Transport } from '../hidpp/transport.js';
import { banner } from '../ui/feedback.js';
import { ui } from '../ui/router.js';

export const openHids = new Set();
export function hasHidpp(h) { return h.collections.some(c => (c.outputReports || []).some(r => r.reportId === 0x10 || r.reportId === 0x11)); }

export async function addHids(list) {
  const groups = new Map();
  for (const h of list) {
    if (h.vendorId !== VID || openHids.has(h) || !hasHidpp(h)) continue;
    const k = `${h.productId}|${h.productName}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(h);
  }
  for (const hids of groups.values()) {
    const t = new Transport(hids);
    try { await t.open(); } catch (e) {
      banner(`Couldn't open ${t.name}: ${e.message}.` + (/linux/i.test(navigator.userAgent) ? ' On Linux, check the udev rule in Help.' : ' Close Logi Options+/Solaar if they are running, then try again.'));
      continue;
    }
    hids.forEach(h => openHids.add(h));
    log(`opened ${t.name} (046D:${hx(t.pid, 4)})`);
    const isRx = RECEIVERS[t.pid] || /receiver/i.test(t.name);
    if (isRx) {
      const r = new Receiver(t); roots.push(r); ui.update();
      await r.init();
    } else {
      const d = new Device(t, 0xff, null, { name: t.name }); roots.push(d); ui.update();
      await d.init(); await d.applySaved();
    }
    ui.update();
  }
}

export async function removeRoot(o) {
  if (o instanceof Receiver && o.pair.phase !== 'idle') await o.cancelPair();
  await o.t.close(); o.t.hids.forEach(h => openHids.delete(h));
  roots.splice(roots.indexOf(o), 1);
  if (ui.route.id && !ui.find(ui.route.id)) ui.go('#/'); else ui.update(true);
}

/** Ask the browser for a device, then open it and its sibling interfaces. */
export async function addDevice() {
  banner('');
  if (!('hid' in navigator)) return banner('This browser does not support WebHID. Open this page in Chrome or Edge on a desktop computer.');
  try {
    const picked = await navigator.hid.requestDevice({ filters: [{ vendorId: VID, usagePage: 0xff00 }, { vendorId: VID, usagePage: 0xff43 }] });
    if (!picked.length) return;
    // Pull in sibling interfaces of the same physical device (Windows splits them).
    const all = await navigator.hid.getDevices();
    const sel = new Set(picked.map(h => `${h.productId}|${h.productName}`));
    await addHids(all.filter(h => sel.has(`${h.productId}|${h.productName}`)).concat(picked));
  } catch (e) {
    if (e.name === 'NotAllowedError' || /permissions policy/i.test(e.message)) banner('WebHID is blocked here. Download this page and open the file directly in Chrome or Edge.');
    else banner('Could not connect: ' + e.message);
  }
}

/** Reconnect to previously allowed devices and follow plug / unplug events. */
export function startHid() {
  if (!('hid' in navigator)) {
    banner('This browser does not support WebHID. Open UnifyWeb in Chrome or Edge on a desktop computer (not on a phone).');
    return;
  }
  navigator.hid.addEventListener('disconnect', e => {
    const r = roots.find(o => o.t.hids.includes(e.device));
    if (r) { removeRoot(r); toast(`${r.title} was unplugged`, 'err'); }
  });
  navigator.hid.addEventListener('connect', e => addHids([e.device]));
  navigator.hid.getDevices().then(addHids);
}
