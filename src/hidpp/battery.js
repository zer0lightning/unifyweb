// Battery parsing for features 0x1000, 0x1001 (voltage) and 0x1004 (unified battery).
export const VOLT = [[4186,100],[4067,90],[3989,80],[3922,70],[3859,60],[3811,50],[3778,40],[3751,30],[3717,20],[3671,10],[3646,5],[3579,2],[3500,0]];
export function voltPct(mv) {
  if (mv >= VOLT[0][0]) return 100;
  for (let i = 1; i < VOLT.length; i++) if (mv >= VOLT[i][0]) { const [v1,p1] = VOLT[i-1], [v2,p2] = VOLT[i]; return Math.round(p2 + (mv - v2) * (p1 - p2) / (v1 - v2)); }
  return 0;
}
export const UNI_STATUS = ['discharging','charging','charging (slow)','fully charged','charging error'];
export const BAT_STATUS = ['discharging','charging','almost full','fully charged','charging (slow)','invalid battery','thermal error'];
export function parseUnified(r) {
  const lvl = r[1] & 8 ? 'full' : r[1] & 4 ? 'good' : r[1] & 2 ? 'low' : r[1] & 1 ? 'critical' : '';
  return { pct: r[0] || null, level: lvl, status: UNI_STATUS[r[2]] || '', charging: r[2] === 1 || r[2] === 2 };
}
