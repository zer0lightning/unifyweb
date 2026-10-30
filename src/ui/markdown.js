// Minimal, safe Markdown → HTML for the bundled legal documents.
// Escapes all text first, then adds a small set of formatting. Links are limited to https:// and
// to the other legal documents; anything else is rendered as plain text.
import { esc } from '../core/util.js';

const DOCS = { 'PRIVACY.md': '#/legal/privacy', 'SUPPORT.md': '#/legal/support', 'DISCLAIMER.md': '#/legal/disclaimer', 'CREDITS.md': '#/legal/credits' };

function link(text, url, repo) {
  if (DOCS[url]) return `<a href="${DOCS[url]}">${text}</a>`;
  if (/^[A-Z]+\.md$/.test(url) && /^https:\/\//.test(repo)) url = `${repo}/blob/main/${url}`;
  if (/^https:\/\/[^\s"'<>]+$/.test(url)) return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  return text;
}

function inline(s, repo) {
  // s is already escaped
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => link(t, u.replace(/&amp;/g, '&'), repo));
}

/** Returns { title, html } — the first "# " heading becomes the title. */
export function renderMarkdown(md, repo = '') {
  const out = []; let title = '', list = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(esc(para.join(' ')), repo)}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul>${list.map(i => `<li>${inline(esc(i), repo)}</li>`).join('')}</ul>`); list = null; } };
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (/^# /.test(line)) { flushPara(); flushList(); title = line.slice(2); continue; }
    if (/^## /.test(line)) { flushPara(); flushList(); out.push(`<h3>${inline(esc(line.slice(3)), repo)}</h3>`); continue; }
    if (/^- /.test(line)) { flushPara(); (list = list || []).push(line.slice(2)); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (list) { list[list.length - 1] += ' ' + line.trim(); continue; }
    para.push(line.trim());
  }
  flushPara(); flushList();
  return { title, html: out.join('\n') };
}
