// The legal-page Markdown renderer must never produce markup from its input.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../../src/ui/markdown.js';

test('headings, lists, bold, code and safe links', () => {
  const { title, html } = renderMarkdown('# Title\n\nText **bold** `code`.\n\n## Sub\n\n- one\n- two [GH](https://github.com)\n\nSee [policy](SUPPORT.md).');
  assert.equal(title, 'Title');
  assert.match(html, /<p>Text <strong>bold<\/strong> <code>code<\/code>\.<\/p>/);
  assert.match(html, /<h3>Sub<\/h3>/);
  assert.match(html, /<li>two <a href="https:\/\/github.com" target="_blank" rel="noopener noreferrer">GH<\/a><\/li>/);
  assert.match(html, /<a href="#\/legal\/support">policy<\/a>/);
});

test('raw HTML and unsafe links are rendered as text', () => {
  const { html } = renderMarkdown('<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](http://plain.example) [z](https://a.b/"onmouseover=1)');
  assert.doesNotMatch(html, /<img|href="javascript|href="http:|onmouseover="/);
  assert.match(html, /&lt;img/);
});
