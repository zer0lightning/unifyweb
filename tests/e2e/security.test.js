// End-to-end security regression tests (docs/security-review.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = new URL('../../dist/unifyweb.html', import.meta.url).href;
const MOCK = await readFile(new URL('../support/mock-receiver.js', import.meta.url), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const PAYLOAD = '<img src=x onerror="window.__pwned=1">';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function page(init = '') {
  const pg = await (await browser.newContext()).newPage();
  const errors = [], csp = [];
  pg.on('pageerror', e => errors.push(e.message));
  pg.on('console', m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  pg.on('dialog', d => d.accept());
  await pg.addInitScript(MOCK + '\n' + init);
  await pg.goto(APP);
  return { pg, errors, csp };
}

test('UW-03: a strict CSP is present and the app runs under it', async () => {
  const { pg, errors, csp } = await page();
  const policy = await pg.$eval('meta[http-equiv="Content-Security-Policy"]', m => m.content);
  assert.match(policy, /default-src 'none'/);
  assert.match(policy, /script-src 'sha256-/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  await pg.click('.welcome button[data-act=add]'); await wait(2500);
  assert.match(await pg.textContent('#nav'), /MX Master 3/);
  assert.deepEqual(errors, []); assert.deepEqual(csp, []);
});

test('UW-01/02: hostile device names are rendered as text, never as markup', async () => {
  const { pg, errors } = await page(`__mock.slots[1].name = ${JSON.stringify(PAYLOAD)};`);
  await pg.click('.welcome button[data-act=add]'); await wait(2500);
  for (const route of ['#/rules', '#/help', '#/']) { await pg.evaluate(r => { location.hash = r; }, route); await wait(200); }
  await pg.click('.dcard >> nth=0'); await wait(300);
  for (const tab of ['Settings', 'Buttons', 'Info']) { await pg.click(`.tab >> text=${tab}`); await wait(150); }
  assert.equal(await pg.evaluate(() => window.__pwned), undefined);
  assert.equal(await pg.$$eval('img[src=x]', e => e.length), 0);
  assert.match(await pg.textContent('.hero h1'), /<img src=x/);
  assert.deepEqual(errors, []);
});

test('UW-01: a malicious rules file is refused and nothing renders', async () => {
  const { pg } = await page();
  const evil = [{ name:'x', trigger:{ type:'battery', below:'"><img src=x onerror="window.__pwned=1">' }, actions:[] }];
  const file = join(tmpdir(), 'evil-rules.json'); await writeFile(file, JSON.stringify(evil));
  await pg.evaluate(() => { location.hash = '#/rules'; }); await wait(200);
  await pg.setInputFiles('#ruleFile', file); await wait(400);
  assert.match(await pg.textContent('#toast'), /Import failed: Rule 1: battery level/);
  assert.equal(await pg.$$eval('.rule', e => e.length), 0);
  assert.equal(await pg.evaluate(() => window.__pwned), undefined);
});

test('UW-12: imported rules arrive switched off', async () => {
  const { pg } = await page();
  const file = join(tmpdir(), 'good-rules.json');
  await writeFile(file, JSON.stringify([{ name:'Beep on connect', enabled:true, device:'any', trigger:{ type:'connect' }, actions:[{ type:'sound' }] }]));
  await pg.evaluate(() => { location.hash = '#/rules'; }); await wait(200);
  await pg.setInputFiles('#ruleFile', file); await wait(400);
  assert.deepEqual(await pg.$$eval('[data-ren]', e => e.map(x => x.checked)), [false]);
  assert.match(await pg.textContent('#toast'), /switched off/);
});

test('UW-02: tampered rules in storage are dropped at load', async () => {
  const { pg } = await page(`try { localStorage.setItem('uweb:rules', JSON.stringify([{ name:'bad', trigger:{ type:'battery', below:${JSON.stringify(PAYLOAD)} }, actions:[] }, { name:'ok', trigger:{ type:'connect' }, actions:[{ type:'sound' }] }])); } catch {}`);
  await pg.evaluate(() => { location.hash = '#/rules'; }); await wait(300);
  assert.deepEqual(await pg.$$eval('.rule .lb', e => e.map(x => x.textContent)), ['ok']);
  assert.equal(await pg.evaluate(() => window.__pwned), undefined);
});

test('UW-04: an out-of-range saved value is never written to the device', async () => {
  const { pg } = await page(`try { localStorage.setItem('uweb:dev:4082:11223301', JSON.stringify({ dpi: 65535, host: 9 })); } catch {}`);
  await pg.click('.welcome button[data-act=add]'); await wait(2500);
  assert.equal(await pg.evaluate(() => __mock.slots[1].dpi), 1000);
});

test('UW-05: the app refuses to run inside a frame', async () => {
  const host = join(tmpdir(), 'uw-frame-host.html');
  await writeFile(host, `<!doctype html><iframe src="${APP}" width="800" height="400"></iframe>`);
  const pg = await (await browser.newContext()).newPage();
  await pg.goto('file://' + host); await wait(1000);
  const frame = pg.frames().find(f => f.url().endsWith('unifyweb.html'));
  assert.ok(frame, 'frame loaded');
  assert.match(await frame.textContent('main'), /only runs in its own tab/);
  assert.equal(await frame.$$eval('[data-act=add]', e => e.filter(b => b.closest('main')).length), 0);
});

test('UW-06: no third-party requests', async () => {
  const pg = await (await browser.newContext()).newPage();
  const urls = []; pg.on('request', r => urls.push(r.url()));
  await pg.addInitScript(MOCK); await pg.goto(APP); await wait(500);
  assert.deepEqual(urls.filter(u => !u.startsWith('file:') && !u.startsWith('data:')), []);
});

test('build info is shown in the rail and on the Help page', async () => {
  const { pg } = await page();
  assert.match(await pg.textContent('.build'), /UnifyWeb \d+\.\d+\.\d+/);
  assert.match(await pg.textContent('.build'), /Built (just now|\d+ \w+ ago)/);
  await pg.evaluate(() => { location.hash = '#/help'; }); await wait(200);
  const about = await pg.textContent('.grp:has(h2:text("About this build"))');
  assert.match(about, /Build ID[0-9a-f-]{36}/);
});
