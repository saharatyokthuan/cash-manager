// ทดสอบ store.js กับ Firebase Emulator (Firestore + Auth)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as fsSdk from 'firebase/firestore';
import { createStore } from '../../js/store.js';

const PROJECT = 'demo-cash';
let env;

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    get data() { return data; }
  };
}

// sanitize แบบเดียวกับใน script.js (ย่อ) เพื่อทดสอบว่า migration เรียกใช้จริง
const sanitize = {
  transactions: t => (t && typeof t === 'object') ? { id: typeof t.id === 'string' && t.id ? t.id : 'gen_' + Math.random().toString(36).slice(2), date: String(t.date || ''), type: t.type === 'expense' ? 'expense' : 'income', category: String(t.category || ''), amount: Number(t.amount) || 0, note: String(t.note || '') } : null,
  loans: l => l, debts: d => d, recurring: r => r,
  categories: c => ({ income: (c && c.income) || [], expense: (c && c.expense) || [] })
};

// สร้าง client ใหม่ (เหมือนเปิดแอปบนอีกเครื่อง) ล็อกอินเป็น uid ที่กำหนด ผ่าน Security Rules จริง
function makeClient(uid, { local = {}, confirmMerge = () => false } = {}) {
  const db = env.authenticatedContext(uid).firestore();
  const localStorage = memoryStorage(local);
  const store = createStore({ ...fsSdk, db }, { localStorage, confirmMerge, sanitize });
  return { store, db, localStorage, uid };
}

async function startAndWait(client) {
  const ready = new Promise(resolve => client.store.onReady(resolve));
  await client.store.start(client.uid);
  await ready;
}

async function cloudDocs(db, uid, name) {
  const snap = await fsSdk.getDocs(fsSdk.collection(db, 'users', uid, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

const until = async (fn, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 50)); }
  throw new Error('timeout waiting for condition');
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await env.clearFirestore();
});
after(async () => { await env.cleanup(); });

test('ล็อกอินครั้งแรก: อัปโหลดข้อมูลเก่าพร้อม sanitize และไม่ลบของในเครื่อง', async () => {
  const local = { cft_transactions: JSON.stringify([
    { id: 'a1', date: '2026-10-01', type: 'income', category: 'เงินเดือน', amount: 100, note: '' },
    { date: '2026-10-02', type: 'expense', category: 'อาหาร', amount: '12.5', note: '' }
  ]) };
  const c = makeClient('mig1', { local });
  await startAndWait(c);
  await fsSdk.waitForPendingWrites(c.db);
  const docs = await cloudDocs(c.db, c.uid, 'transactions');
  assert.equal(docs.length, 2);
  assert.ok(docs.some(d => d.amount === 12.5));
  const profile = await fsSdk.getDoc(fsSdk.doc(c.db, 'users', c.uid, 'meta', 'profile'));
  assert.ok(profile.exists() && profile.data().migratedFromLocalAt);
  assert.ok(c.localStorage.getItem(`cft_migrated_${c.uid}`));
  assert.ok(c.localStorage.getItem('cft_transactions'));
  assert.equal(c.store.getTransactions().length, 2);
});

test('ข้อมูลเก่า JSON เสีย ไม่ทำให้ start พัง', async () => {
  const c = makeClient('broken1', { local: { cft_categories: '{not json', cft_transactions: 'oops' } });
  await startAndWait(c);
  assert.deepEqual(c.store.getTransactions(), []);
});

test('คลาวด์มีข้อมูลแล้ว + ผู้ใช้เลือกข้าม: คลาวด์ไม่เปลี่ยน', async () => {
  const first = makeClient('ask1');
  await startAndWait(first);
  first.store.setTransactions([{ id: 'cloud1', date: '2026-10-01', type: 'income', category: 'x', amount: 1, note: '' }]);
  await fsSdk.waitForPendingWrites(first.db);

  const local = { cft_transactions: JSON.stringify([{ id: 'local1', date: '2026-10-03', type: 'income', category: 'x', amount: 5, note: '' }]) };
  let asked = 0;
  const second = makeClient('ask1', { local, confirmMerge: () => { asked++; return false; } });
  await startAndWait(second);
  assert.equal(asked, 1);
  assert.deepEqual((await cloudDocs(second.db, second.uid, 'transactions')).map(d => d.id), ['cloud1']);
});

test('คลาวด์มีข้อมูลแล้ว + ผู้ใช้เลือกรวม: รายการในเครื่องถูกเพิ่ม', async () => {
  const local = { cft_transactions: JSON.stringify([{ id: 'local2', date: '2026-10-03', type: 'income', category: 'x', amount: 5, note: '' }]) };
  const c = makeClient('ask1', { local, confirmMerge: () => true });
  await startAndWait(c);
  await fsSdk.waitForPendingWrites(c.db);
  const ids = (await cloudDocs(c.db, c.uid, 'transactions')).map(d => d.id).sort();
  assert.deepEqual(ids, ['cloud1', 'local2']);
});

test('setTransactions เขียนเฉพาะส่วนที่ต่าง (เพิ่ม/แก้/ลบ)', async () => {
  const c = makeClient('diff1');
  await startAndWait(c);
  const base = [
    { id: 'k1', date: '2026-10-01', type: 'income', category: 'x', amount: 1, note: '' },
    { id: 'k2', date: '2026-10-01', type: 'income', category: 'x', amount: 2, note: '' }
  ];
  c.store.setTransactions(base);
  c.store.setTransactions([{ ...base[0], amount: 10 }, { id: 'k3', date: '2026-10-02', type: 'expense', category: 'y', amount: 3, note: '' }]);
  await fsSdk.waitForPendingWrites(c.db);
  const docs = await cloudDocs(c.db, c.uid, 'transactions');
  assert.deepEqual(docs.map(d => d.id).sort(), ['k1', 'k3']);
  assert.equal(docs.find(d => d.id === 'k1').amount, 10);
  assert.ok(!('id' in (await fsSdk.getDoc(fsSdk.doc(c.db, 'users', c.uid, 'transactions', 'k1'))).data()));
});

test('replaceAll 1,200 รายการ แบ่ง batch และลบรายการเก่า', async () => {
  const c = makeClient('big1');
  await startAndWait(c);
  c.store.setTransactions([{ id: 'old', date: '2026-01-01', type: 'income', category: 'x', amount: 1, note: '' }]);
  const many = Array.from({ length: 1200 }, (_, i) => ({ id: 't' + i, date: '2026-10-01', type: 'expense', category: 'x', amount: i, note: '' }));
  await c.store.replaceAll({ transactions: many, loans: [], debts: [], recurring: [], categories: { income: [], expense: [] } });
  await fsSdk.waitForPendingWrites(c.db);
  const docs = await cloudDocs(c.db, c.uid, 'transactions');
  assert.equal(docs.length, 1200);
  assert.ok(!docs.some(d => d.id === 'old'));
});

test('สองเครื่องสร้างรายการประจำเดือนเดียวกัน ได้รายการเดียว', async () => {
  const a = makeClient('rec1');
  const b = makeClient('rec1');
  await startAndWait(a);
  await startAndWait(b);
  const item = { date: '2026-10-05', type: 'expense', category: 'ค่าเช่า', amount: 5000, note: '[ประจำ] ค่าเช่า' };
  a.store.setTransactions([...a.store.getTransactions(), { id: 'rec_r1_2026-10', ...item }]);
  b.store.setTransactions([...b.store.getTransactions(), { id: 'rec_r1_2026-10', ...item }]);
  await fsSdk.waitForPendingWrites(a.db);
  await fsSdk.waitForPendingWrites(b.db);
  const docs = await cloudDocs(a.db, a.uid, 'transactions');
  assert.equal(docs.filter(d => d.id === 'rec_r1_2026-10').length, 1);
  assert.equal(docs.length, 1);
});

test('เครื่อง A เขียน → เครื่อง B ได้ onChange และเห็นข้อมูล', async () => {
  const a = makeClient('sync1');
  const b = makeClient('sync1');
  await startAndWait(a);
  await startAndWait(b);
  let changes = 0;
  b.store.onChange(() => { changes++; });
  a.store.setLoans([{ id: 'L1', name: 'สมชาย', date: '2026-10-01', amount: 300, status: 'borrowing', note: '' }]);
  await until(() => b.store.getLoans().length === 1);
  assert.ok(changes >= 1);
  assert.equal(b.store.getLoans()[0].name, 'สมชาย');
});

test('onChange ไม่ถูกเรียกจากเสียงสะท้อนของการเขียนตัวเอง', async () => {
  const c = makeClient('echo1');
  await startAndWait(c);
  let changes = 0;
  c.store.onChange(() => { changes++; });
  c.store.setDebts([{ id: 'D1', name: 'บัตร A', limit: 1000, balance: 100, interest: 0, dueDay: 5, minPayment: 0 }]);
  await fsSdk.waitForPendingWrites(c.db);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(changes, 0);
});
