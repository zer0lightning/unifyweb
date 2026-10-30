// Unit tests for the pure protocol helpers (no browser needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, decBtn, encBtn } from '../../src/hidpp/profiles.js';
import { parseDpiList } from '../../src/hidpp/settings/pointer.js';
import { effectParams } from '../../src/hidpp/settings/lighting.js';
import { voltPct, parseUnified } from '../../src/hidpp/battery.js';
import { hx, hexs, dec, esc } from '../../src/core/util.js';

test('crc16 matches CRC-16/CCITT-FALSE check value', () => {
  assert.equal(crc16(new TextEncoder().encode('123456789')), 0x29b1);
});

test('button encoding round-trips for every kind', () => {
  for (const o of [{ k:'mouse', v:8 }, { k:'key', mod:3, v:0x06 }, { k:'media', v:0xcd }, { k:'fn', v:5 }]) {
    const back = decBtn(encBtn(o));
    assert.equal(back.k, o.k); assert.equal(back.v, o.v);
    if (o.mod) assert.equal(back.mod, o.mod);
  }
  assert.equal(decBtn([0x80, 0, 0, 0]).k, 'none');
  assert.equal(decBtn([0x00, 0x12, 0x00, 0x40]).k, 'raw');   // macros are kept as-is
});

test('DPI list: discrete values and step ranges', () => {
  assert.deepEqual(parseDpiList([0x01, 0x90, 0x03, 0x20, 0, 0]).options.map(o => o[0]), [400, 800]);
  const r = parseDpiList([0x00, 0xc8, 0xe0, 0x32, 0x0f, 0xa0, 0, 0]);
  assert.equal(r.type, 'range'); assert.deepEqual([r.min, r.max, r.step], [200, 4000, 50]);
});

test('lighting effect parameters are always 10 bytes', () => {
  const p = effectParams(0x0a, '#ff3366', 5000);
  assert.equal(p.length, 10); assert.deepEqual(p.slice(0, 5), [255, 51, 102, 0x13, 0x88]);
  assert.deepEqual(effectParams(0, '#000000', 0), Array(10).fill(0));
});

test('battery helpers', () => {
  assert.equal(voltPct(4200), 100); assert.equal(voltPct(3400), 0);
  assert.ok(voltPct(3811) === 50);
  const u = parseUnified([80, 4, 1, 0]);
  assert.equal(u.pct, 80); assert.equal(u.level, 'good'); assert.equal(u.charging, true);
});

test('formatting helpers', () => {
  assert.equal(hx(10), '0A'); assert.equal(hx(0xc52b, 4), 'C52B');
  assert.equal(hexs([0xaa, 0x01]), 'AA01');
  assert.equal(dec([72, 105, 0, 0]), 'Hi');
  assert.equal(esc('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
});

test('theme preference resolves to the shown theme', async () => {
  const { resolveTheme } = await import('../../src/ui/theme.js');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});
