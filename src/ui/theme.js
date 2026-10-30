// Theme preference: 'system' (follow the operating system), 'light' or 'dark'.
import { store } from '../core/store.js';

export const THEMES = [['system', 'System', 'monitor'], ['light', 'Light', 'light'], ['dark', 'Dark', 'moon']];
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme() {
  const t = store.get('theme', 'system');
  return THEMES.some(([k]) => k === t) ? t : 'system';
}

/** Resolve a preference to the theme actually shown. */
export const resolveTheme = (pref, systemDark) => pref === 'dark' || (pref === 'system' && systemDark) ? 'dark' : 'light';

export function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(getTheme(), media().matches);
}

export function setTheme(t) {
  if (!THEMES.some(([k]) => k === t)) return;
  store.set('theme', t);
  applyTheme();
}

/** System → Light → Dark → System */
export function nextTheme() {
  const i = THEMES.findIndex(([k]) => k === getTheme());
  setTheme(THEMES[(i + 1) % THEMES.length][0]);
}

/** Follow OS changes while the preference is 'system'. */
export function watchSystemTheme(onChange) {
  media().addEventListener('change', () => { if (getTheme() === 'system') { applyTheme(); onChange?.(); } });
}
