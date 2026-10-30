// Small pure helpers shared across modules.
export const $ = id => document.getElementById(id);
export const hx = (n, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');
export const hexb = a => Array.from(a, b => hx(b)).join(' ');
export const hexs = a => Array.from(a, b => hx(b)).join('');
export const dec = a => new TextDecoder().decode(Uint8Array.from(a)).replace(/\0/g, '').trim();
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export let uid = 0;
export const nextId = prefix => prefix + (++uid);
