import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTIONS, diffById, chunk, decideMigration, recurringTxnId, stripDoc } from '../js/store-core.js';

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
