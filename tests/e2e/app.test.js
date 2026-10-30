// End-to-end tests: the built app in headless Chromium, talking to a simulated receiver and mouse.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = new URL('../../dist/unifyweb.html', import.meta.url).href;
const MOCK = await readFile(new URL('../support/mock-receiver.js', import.meta.url), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const fire = (pg, sel, value) => pg.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles:true })); }, value);

let browser, pg, errors;
before(async () => {
  browser = await chromium.launch();
  pg = await (await browser.newContext({ viewport:{ width:1280, height:900 } })).newPage();
  errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  pg.on('dialog', d => d.accept());
  await pg.addInitScript(MOCK);
  await pg.goto(APP);
});
after(async () => { await browser.close(); assert.deepEqual(errors, [], 'no page errors'); });

test('welcome screen, then connecting the receiver lists the mouse', async () => {
  assert.ok(await pg.isVisible('.welcome'));
  await pg.click('.welcome button[data-act=add]'); await wait(2500);
  assert.match(await pg.textContent('#nav'), /MX Master 3/);
  assert.match(await pg.textContent('#nav'), /80% battery/);
});

test('device page shows tabs and grouped settings', async () => {
  await pg.click('.dcard >> text=MX Master 3'); await wait(300);
  assert.deepEqual(await pg.$$eval('.tab', e => e.map(x => x.textContent)), ['Settings', 'Buttons', 'Lighting', 'Profiles', 'Info']);
  assert.deepEqual(await pg.$$eval('.grp-h h2', e => e.map(x => x.textContent)), ['Pointer', 'Scrolling', 'Connection']);
});

test('changing DPI writes to the device', async () => {
  await fire(pg, '.set:has-text("Sensitivity") input[type=range]', '2400'); await wait(300);
  assert.equal(await pg.evaluate(() => __mock.slots[1].dpi), 2400);
});

test('lighting effect and backlight level are written', async () => {
  await pg.click('.tab >> text=Lighting'); await wait(300);
  await pg.selectOption('select[data-kind=light][data-lf=id]', '10'); await wait(300);
  await fire(pg, 'input[type=color][data-kind=light]', '#ff3366'); await wait(300);
  const led = await pg.evaluate(() => __mock.slots[1].led.at(-1));
  assert.deepEqual(led.slice(0, 5), [0, 3, 255, 51, 102]);
  await fire(pg, '.set:has-text("Backlight level") input[type=range]', '4'); await wait(300);
  assert.equal(await pg.evaluate(() => __mock.slots[1].bl[5]), 4);
});

test('onboard profiles: edit and save with valid checksums', async () => {
  await pg.click('.tab >> text=Profiles'); await pg.click('button[data-act=loadprof]'); await wait(2500);
  await fire(pg, 'input[data-pf=dpi3]', '6400'); await wait(150);
  await pg.selectOption('select[data-pb="5"][data-pk=kind]', 'key'); await wait(150);
  await pg.click('input[data-pb="5"][data-pk=mod][data-m="1"]', { force:true }); await wait(150);
  await pg.selectOption('select[data-pb="5"][data-pk=v]', String(0x06)); await wait(150);
  await pg.click('button[data-act=saveprof]'); await wait(3500);
  const m = await pg.evaluate(() => { const ok = s => { const b = __mock.mem[s]; return __mock.crc(b.slice(0, 253)) === ((b[253] << 8) | b[254]); };
    const b = __mock.mem[1]; return { ok:[0, 1, 2].map(ok), dpi3:b[9] | (b[10] << 8), btn:b.slice(52, 56) }; });
  assert.deepEqual(m.ok, [true, true, true]);
  assert.equal(m.dpi3, 6400);
  assert.deepEqual(m.btn, [0x80, 2, 1, 6]);   // Ctrl + C
});

test('a gesture rule diverts the button and runs its action', async () => {
  await pg.click('.tab >> text=Buttons'); await wait(200);
  await pg.click('.set:has-text("Gesture Button") button[data-act=rule-from]'); await wait(300);
  await pg.selectOption('select[data-f="trigger.type"]', JSON.stringify('gesture')); await wait(150);
  await pg.selectOption('select[data-f="trigger.dir"]', JSON.stringify('up')); await wait(150);
  await pg.selectOption('select[data-f="actions.0.key"]', JSON.stringify('dpi')); await wait(150);
  await fire(pg, 'input[data-f="actions.0.value"]', '3200'); await wait(150);
  await pg.click('button[data-act=rule-save]'); await wait(800);
  assert.equal(await pg.evaluate(() => __mock.slots[1].divert[0xc3] & 0x11), 0x11);
  await pg.evaluate(async () => { const rx = __mock.rx, fi = __mock.FEATS.indexOf(0x1b04), z = Array(14).fill(0);
    rx.emit([1, fi, 0x00, 0x00, 0xc3, ...z]); await new Promise(r => setTimeout(r, 50));
    rx.emit([1, fi, 0x10, 0x00, 0x05, 0xff, 0x38, ...z]); await new Promise(r => setTimeout(r, 50));
    rx.emit([1, fi, 0x00, 0x00, 0x00, ...z]); });
  await wait(800);
  assert.equal(await pg.evaluate(() => __mock.slots[1].dpi), 3200);
});

test('pairing a new device and unpairing it', async () => {
  await pg.click('#nav >> text=Unifying receiver'); await wait(200);
  await pg.click('button[data-act=pair]'); await wait(1600);
  assert.match(await pg.textContent('.pair'), /M720 Triathlon paired/);
  await pg.click('#nav >> text=M720 Triathlon'); await wait(300);
  await pg.click('button[data-act=unpair]'); await wait(500);
  assert.deepEqual(await pg.evaluate(() => Object.keys(__mock.slots)), ['1']);
  assert.match(await pg.evaluate(() => location.hash), /^#\/r\//);   // lands back on the receiver
});

test('browser back button navigates', async () => {
  await pg.click('#nav >> text=Help'); await wait(200);
  await pg.goBack(); await wait(200);
  assert.match(await pg.evaluate(() => location.hash), /^#\/r\//);
});

test('theme toggle cycles, persists across reloads, and Help shows the choice', async () => {
  const theme = () => pg.evaluate(() => document.documentElement.dataset.theme);
  const pref = () => pg.evaluate(() => localStorage.getItem('uweb:theme'));
  await pg.click('#themeBtn'); assert.equal(await pref(), '"light"'); assert.equal(await theme(), 'light');
  await pg.click('#themeBtn'); assert.equal(await pref(), '"dark"'); assert.equal(await theme(), 'dark');
  await pg.reload(); await wait(400);
  assert.equal(await theme(), 'dark');
  assert.match(await pg.getAttribute('#themeBtn', 'aria-label'), /Theme: Dark/);
  await pg.evaluate(() => { location.hash = '#/help'; }); await wait(200);
  await pg.click('button[data-act=theme-set][data-theme=light]'); await wait(100);
  assert.equal(await theme(), 'light');
  assert.equal(await pg.getAttribute('button[data-theme=light]', 'aria-checked'), 'true');
});

test('privacy, support and disclaimer pages are reachable from the rail', async () => {
  await pg.click('.legal-links >> text=Support'); await wait(200);
  assert.match(await pg.textContent('.prose h2'), /Support/);
  assert.match(await pg.textContent('.prose'), /No support is offered/);
  await pg.click('.tab >> text=Disclaimer'); await wait(150);
  assert.match(await pg.textContent('.prose'), /not made, endorsed, sponsored or supported by Logitech/);
  await pg.click('.tab >> text=Privacy'); await wait(150);
  assert.match(await pg.textContent('.prose'), /does not collect, send, sell or share personal data/);
  await pg.click('.tab >> text=Credits'); await wait(150);
  assert.match(await pg.textContent('.prose'), /Solaar/);
  const ext = await pg.$$eval('.prose a[target=_blank]', a => a.map(x => [x.href, x.rel]));
  assert.ok(ext.length > 0 && ext.every(([h, r]) => h.startsWith('https://') && r.includes('noopener')));
});
