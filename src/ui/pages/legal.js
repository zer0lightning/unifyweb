// Privacy policy, support statement, disclaimer and credits. The text comes from PRIVACY.md, SUPPORT.md,
// DISCLAIMER.md and CREDITS.md in the repository root, so the app and GitHub always show the same words.
import privacy from '../../../PRIVACY.md';
import support from '../../../SUPPORT.md';
import disclaimer from '../../../DISCLAIMER.md';
import credits from '../../../CREDITS.md';
import { BUILD } from '../../core/build.js';
import { renderMarkdown } from '../markdown.js';
import { hero } from '../components.js';

export const LEGAL = [['privacy', 'Privacy', privacy], ['support', 'Support', support], ['disclaimer', 'Disclaimer', disclaimer], ['credits', 'Credits', credits]];

export function legalPage(tab) {
  const t = LEGAL.some(([k]) => k === tab) ? tab : 'privacy';
  const [, , md] = LEGAL.find(([k]) => k === t);
  const doc = renderMarkdown(md, BUILD.repo);
  let h = hero(null, 'Privacy & legal', 'How UnifyWeb treats your data, what support to expect, the terms you use it under, and who made it possible.');
  h += `<div class="tabs" role="tablist">${LEGAL.map(([k, l]) => `<a role="tab" aria-selected="${k === t}" class="tab${k === t ? ' active' : ''}" href="#/legal/${k}">${l}</a>`).join('')}</div>`;
  h += `<article class="card card-b prose"><h2>${doc.title}</h2>${doc.html}</article>`;
  return h;
}
