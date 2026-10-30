// Everything currently connected: receivers and directly connected devices.
export const roots = [];
/** Every device, whether behind a receiver or connected directly. */
export function allDevices() {
  const out = [];
  for (const r of roots) { if (r.devices) out.push(...r.devices.values()); else out.push(r); }
  return out;
}
