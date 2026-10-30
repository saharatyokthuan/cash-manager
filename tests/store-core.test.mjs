import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTIONS, diffById, chunk, decideMigration, recurringTxnId, stripDoc, stableStringify } from '../js/store-core.js';

test('COLLECTIONS ครบ 4 ชนิด', () => {
  assert.deepEqual(COLLECTIONS, ['transactions', 'loans', 'debts', 'recurring']);
});

test('diffById: รายการใหม่ถูก upsert', () => {
  const a = { id: 'a', amount: 1 };
  assert.deepEqual(diffById([], [a]), { upserts: [a], deletes: [] });
});

test('diffById: รายการที่แก้ถูก upsert', () => {
  const a2 = { id: 'a', amount: 2 };
  assert.deepEqual(diffById([{ id: 'a', amount: 1 }], [a2]), { upserts: [a2], deletes: [] });
});

test('diffById: รายการที่หายไปถูก delete', () => {
  assert.deepEqual(diffById([{ id: 'a', amount: 1 }], []), { upserts: [], deletes: ['a'] });
});

test('diffById: ไม่เปลี่ยนแปลง ไม่มีอะไรต้องเขียน', () => {
  assert.deepEqual(diffById([{ id: 'a', amount: 1 }], [{ id: 'a', amount: 1 }]), { upserts: [], deletes: [] });
});

test('chunk แบ่งชุดละ 500', () => {
  const arr = Array.from({ length: 1200 }, (_, i) => i);
  assert.deepEqual(chunk(arr).map(c => c.length), [500, 500, 200]);
  assert.deepEqual(chunk([]), []);
});

test('decideMigration ครบทุกกรณี', () => {
  assert.equal(decideMigration({ cloudHasData: false, localHasData: true, alreadyHandled: false }), 'upload');
  assert.equal(decideMigration({ cloudHasData: true, localHasData: true, alreadyHandled: false }), 'ask');
  assert.equal(decideMigration({ cloudHasData: true, localHasData: true, alreadyHandled: true }), 'none');
  assert.equal(decideMigration({ cloudHasData: false, localHasData: false, alreadyHandled: false }), 'none');
  assert.equal(decideMigration({ cloudHasData: false, localHasData: true, alreadyHandled: true }), 'upload');
});

test('recurringTxnId สร้าง id แบบกำหนดได้', () => {
  assert.equal(recurringTxnId('id_x', '2026-10'), 'rec_id_x_2026-10');
});

test('stripDoc เติม id และตัด updatedAt', () => {
  assert.deepEqual(stripDoc('a', { amount: 1, updatedAt: {} }), { id: 'a', amount: 1 });
});

test('stableStringify ไม่สนลำดับ key', () => {
  assert.equal(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } }), stableStringify({ a: { c: [3, { e: 0, f: 1 }], d: 2 }, b: 1 }));
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
});

test('diffById: ลำดับ key ต่างกันไม่ถือว่าแก้ไข', () => {
  assert.deepEqual(diffById([{ id: 'a', amount: 1, note: '' }], [{ note: '', amount: 1, id: 'a' }]), { upserts: [], deletes: [] });
});
