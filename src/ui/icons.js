// Icon sprite (built from src/icons/*.svg), app mark, favicon and the welcome illustration.

import ICONS from 'virtual:icons';
// The app mark: a "U" that doubles as a receiver's two prongs, with a signal arc above.
export const MARK_INNER = '<rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M12.75 10.5V6.75h6.5v3.75" fill="none" stroke="var(--accent-ink)" stroke-width="2" stroke-linejoin="round"/><path d="M15 8.6h.01M17 8.6h.01" stroke="var(--accent-ink)" stroke-width="1.6" stroke-linecap="round"/><path d="M9.5 10.5v8.25a6.5 6.5 0 0 0 13 0V10.5" fill="none" stroke="var(--accent-ink)" stroke-width="2.6" stroke-linecap="round"/>';
export const MARK = `<svg viewBox="0 0 32 32" aria-hidden="true">${MARK_INNER}</svg>`;
export const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${MARK_INNER.replaceAll('var(--accent-ink)', '#ffffff').replaceAll('var(--accent)', '#12694B')}</svg>`);
// Welcome illustration: keyboard + mouse talking to a receiver.
export const WELCOME_ART = `<svg viewBox="0 0 240 120" class="art" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <g stroke="var(--line2)" stroke-width="1.5" stroke-dasharray="2 5"><path d="M86 50c14-18 40-26 62-18"/><path d="M180 66c-4-16-14-26-28-30"/></g>
  <g stroke="var(--muted)" stroke-width="2"><rect x="14" y="58" width="96" height="44" rx="9" fill="var(--panel2)"/>
    <path d="M28 72h.01M40 72h.01M52 72h.01M64 72h.01M76 72h.01M88 72h.01M96 72h.01M34 82h.01M46 82h.01M58 82h.01M70 82h.01M82 82h.01M94 82h.01M40 92h44"/></g>
  <g stroke="var(--muted)" stroke-width="2"><rect x="168" y="52" width="40" height="58" rx="20" fill="var(--panel2)"/><path d="M188 52v12"/><rect x="185" y="64" width="6" height="11" rx="3" fill="var(--panel)"/></g>
  <g stroke="var(--accent)" stroke-width="2.2"><rect x="138" y="14" width="22" height="30" rx="6" fill="color-mix(in srgb, var(--accent) 14%, var(--panel))"/><path d="M142 14V6h14v8"/><path d="M144.5 30a6 6 0 0 1 9 0"/><circle cx="149" cy="35" r="1" fill="var(--accent)"/></g>
</svg>`;
export const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${n}"/></svg>`;
/** Adds the SVG sprite, the favicon and the header logo to the page. */
export function injectIcons() {
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</defs></svg>`;
  document.body.insertAdjacentHTML('afterbegin', sprite);
  const link = document.createElement('link'); link.rel = 'icon'; link.href = FAVICON; document.head.appendChild(link);
  const m = document.getElementById('mark'); if (m) m.innerHTML = MARK;
}
