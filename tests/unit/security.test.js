// Regression tests for the security review findings (docs/security-review.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRules, loadRules, LIMITS } from '../../src/rules/schema.js';
import { isValidValue } from '../../src/hidpp/settings/validate.js';
import { timeAgo } from '../../src/core/build.js';

const good = { name:'Up', enabled:true, device:'any', trigger:{ type:'gesture', cid:0xc3, dir:'up' }, condition:{ type:'none' }, actions:[{ type:'setting', target:'self', key:'dpi', value:3200 }] };

test('UW-01: rules with markup or wrong types in numeric fields are rejected', () => {
  const evil = structuredClone(good); evil.trigger = { type:'battery', below:'"><img src=x onerror=alert(1)>' };
  assert.throws(() => sanitizeRules([evil]), /battery level/);
  const evil2 = structuredClone(good); evil2.actions[0].value = '<svg onload=alert(1)>';
  assert.throws(() => sanitizeRules([evil2]), /must be a number/);
  const evil3 = structuredClone(good); evil3.trigger.cid = '<b>';
  assert.throws(() => sanitizeRules([evil3]), /control ID/);
});

test('UW-01: unknown properties and prototype keys are dropped', () => {
  const r = JSON.parse(JSON.stringify(good).replace('{"name"', '{"__proto__":{"polluted":true},"extra":1,"name"'));
  const [clean] = sanitizeRules([r]);
  assert.equal(clean.extra, undefined);
  assert.equal(({}).polluted, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['actions', 'condition', 'device', 'enabled', 'name', 'trigger']);
});

test('UW-01: limits on size and lengths', () => {
  assert.throws(() => sanitizeRules(Array(LIMITS.rules + 1).fill(good)), /more than/);
  assert.throws(() => sanitizeRules([{ ...good, name:'x'.repeat(LIMITS.name + 1) }]), /longer than/);
  assert.throws(() => sanitizeRules([{ ...good, actions:Array(LIMITS.actions + 1).fill(good.actions[0]) }]), /more than/);
  assert.throws(() => sanitizeRules([{ ...good, actions:[{ type:'cycle', key:'dpi', values:'800,<x>' }] }]), /numbers and commas/);
  assert.throws(() => sanitizeRules([{ ...good, actions:[{ type:'setting', key:'not-a-setting', value:1 }] }]), /known setting/);
  assert.throws(() => sanitizeRules({ rules:[] }), /list of rules/);
});

test('UW-02: tampered stored rules are skipped, valid ones kept', () => {
  const out = loadRules([good, { trigger:{ type:'battery', below:'<x>' }, actions:[] }, 'nope', null]);
  assert.equal(out.length, 1);
  assert.deepEqual(loadRules('not an array'), []);
});

test('UW-04: values are checked against device metadata before writing', () => {
  const range = { type:'range', min:200, max:4000, step:50 };
  assert.ok(isValidValue(range, 1600));
  assert.ok(!isValidValue(range, 65535)); assert.ok(!isValidValue(range, 1625)); assert.ok(!isValidValue(range, '1600'));
  const choice = { type:'choice', options:[[1, 'a'], [2, 'b']] };
  assert.ok(isValidValue(choice, 2)); assert.ok(!isValidValue(choice, 3));
  assert.ok(isValidValue({ type:'toggle' }, true)); assert.ok(!isValidValue({ type:'toggle' }, 'toggle'));
  assert.ok(isValidValue({ type:'host', count:3 }, 2)); assert.ok(!isValidValue({ type:'host', count:3 }, 3));
  const flags = { type:'flags', options:[[1, 'Caps'], [4, 'Scroll']] };
  assert.ok(isValidValue(flags, 5)); assert.ok(!isValidValue(flags, 2));
  const keys = { type:'keys', rows:[{ cid:0x53, targets:[0x53, 0x56] }] };
  assert.ok(isValidValue(keys, { 83:0x56 })); assert.ok(!isValidValue(keys, { 83:0x50 })); assert.ok(!isValidValue(keys, { 99:0x53 }));
  const light = { type:'lighting', zones:[{ zone:0, effects:[{ id:1 }, { id:10 }] }] };
  assert.ok(isValidValue(light, { 0:{ id:10, color:'#ff3366', period:5000 } }));
  assert.ok(!isValidValue(light, { 0:{ id:1, color:'red;}</style>' } }));
  assert.ok(!isValidValue(light, { 0:{ id:99 } }));
  assert.ok(!isValidValue(undefined, 1));
});

test('build time indicator', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  assert.equal(timeAgo('2026-10-29T11:59:30Z', now), 'just now');
  assert.equal(timeAgo('2026-10-29T09:00:00Z', now), '3 hours ago');
  assert.equal(timeAgo('2026-10-28T12:00:00Z', now), '1 day ago');
  assert.equal(timeAgo('garbage', now), 'unknown');
});
