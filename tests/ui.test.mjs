// ทดสอบหน้าจอ (index.html + script.js) กับ store ปลอม
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createFakeStore } from './helpers/fake-store.mjs';

const html = fs.readFileSync('index.html', 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const scriptJs = fs.readFileSync('js/script.js', 'utf8');
const frame = () => new Promise(r => setTimeout(r, 40));
// ปิดหน้าเว็บจำลองทุกหน้าหลังจบ ไม่อย่างนั้นแอนิเมชันอนุภาคจะทำให้ Node ไม่จบการทำงาน
const windows = [];
after(() => windows.forEach(w => w.close()));

function boot({ ready = true, user = { uid: 'u1', email: 'u1@x.test' } } = {}) {
  const errors = [];
  const confirms = [];
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  windows.push(w);
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
  const charts = [];
  w.Chart = function (ctx, cfg) { charts.push(cfg); this.destroy = () => {}; };
  w.Chart.defaults = {};
  w.scrollTo = () => {};
  w.confirmAnswer = true;
  w.confirm = msg => { confirms.push(msg); return w.confirmAnswer; };
  w.addEventListener('error', e => errors.push(e.error ? e.error.stack : e.message));
  w.console.error = (...a) => errors.push(a.map(String).join(' '));
  w.eval(scriptJs);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const store = createFakeStore();
  w.cashStore = store;
  w.document.dispatchEvent(new w.Event('cashstore:created'));
  if (user !== undefined) store.emitAuth(user);
  if (ready) store.emitReady();
  const $ = id => w.document.getElementById(id);
  const visible = el => !el.hidden && !el.classList.contains('hidden');
  return { w, $, store, errors, confirms, charts, visible };
}

function addTxn(ctx, type, amount) {
  const { w, $ } = ctx;
  w.document.querySelector(`#txn-type-toggle [data-type="${type}"]`).click();
  $('txn-amount').value = String(amount);
  $('transaction-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
}

test('ก่อน store พร้อม: แสดงหน้าโหลดและซ่อนเนื้อหา', () => {
  const ctx = boot({ ready: false, user: undefined });
  assert.ok(ctx.visible(ctx.$('app-loading')));
  assert.ok(!ctx.visible(ctx.w.document.querySelector('.content')));
});

test('ยังไม่ล็อกอิน: แสดงหน้าล็อกอิน และปุ่มเรียก signIn', () => {
  const ctx = boot({ ready: false, user: null });
  assert.ok(ctx.visible(ctx.$('login-screen')));
  assert.ok(!ctx.visible(ctx.$('app-loading')));
  ctx.$('login-btn').click();
  assert.equal(ctx.store.calls.signIn, 1);
});

test('พร้อมแล้ว: เพิ่มรายรับ/รายจ่าย ยอดถูกและไปที่ store ไม่ใช่ localStorage', () => {
  const ctx = boot();
  assert.ok(!ctx.visible(ctx.$('app-loading')));
  assert.ok(ctx.visible(ctx.w.document.querySelector('.content')));
  addTxn(ctx, 'income', 1000);
  addTxn(ctx, 'expense', 250.5);
  assert.equal(ctx.$('topbar-balance').textContent, '฿749.50');
  assert.equal(ctx.store.data.transactions.length, 2);
  assert.equal(ctx.w.localStorage.getItem('cft_transactions'), null);
  assert.deepEqual(ctx.errors, []);
});

test('ข้อมูลจากเครื่องอื่นเข้ามาระหว่างแก้ไข: ฟอร์มและตัวกรองไม่ถูกล้าง', async () => {
  const ctx = boot();
  const { $, w, store } = ctx;
  addTxn(ctx, 'income', 1000);
  $('home-month-filter').value = 'all';
  $('home-month-filter').dispatchEvent(new w.Event('change'));
  w.document.querySelector('[data-action="edit-txn"]').click();
  $('txn-amount').value = '1234';
  store.data.transactions.push({ id: 'remote1', date: '2020-01-01', type: 'expense', category: 'อาหาร', amount: 50, note: 'จากมือถือ' });
  store.emitChange();
  await frame();
  assert.equal($('txn-amount').value, '1234');
  assert.equal($('txn-submit-btn').textContent.trim(), 'บันทึกการแก้ไข');
  assert.equal($('home-month-filter').value, 'all');
  assert.equal(w.document.querySelectorAll('#transaction-list .list-item').length, 2);
});

test('รายการประจำสร้าง transaction ด้วย id แบบกำหนดได้', () => {
  const ctx = boot({ ready: false });
  ctx.store.data.recurring = [{ id: 'r1', name: 'ค่าเน็ต', type: 'expense', category: 'สาธารณูปโภค', amount: 599, day: 1, note: '', generatedMonths: [] }];
  ctx.store.emitReady();
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  assert.ok(ctx.store.data.transactions.some(t => t.id === `rec_r1_${ym}`));
});

test('Import json เรียก replaceAll ครั้งเดียว และเตือนว่ามีผลทุกเครื่อง', async () => {
  const ctx = boot();
  const { w, $ } = ctx;
  const file = new w.File([JSON.stringify({ transactions: [{ id: 'i1', date: '2026-10-01', type: 'income', category: 'x', amount: 9 }], loans: [] })], 'b.json', { type: 'application/json' });
  Object.defineProperty($('import-json-file'), 'files', { value: [file], configurable: true });
  $('import-json-file').dispatchEvent(new w.Event('change'));
  await new Promise(r => setTimeout(r, 100));
  assert.equal(ctx.store.calls.replaceAll, 1);
  assert.ok(ctx.confirms.some(m => m.includes('ทุกเครื่อง')));
  assert.equal(ctx.store.data.transactions[0].id, 'i1');
});

test('ออกจากระบบตอนยังไม่ซิงก์: เตือน และยกเลิกได้', () => {
  const ctx = boot();
  ctx.store.setStatus('pending');
  ctx.w.confirmAnswer = false;
  ctx.$('logout-btn').click();
  assert.ok(ctx.confirms.some(m => m.includes('ยังไม่ได้ซิงก์')));
  assert.equal(ctx.store.calls.signOut, 0);
});

test('ไอคอนสถานะซิงก์เปลี่ยนตามสถานะ', () => {
  const ctx = boot();
  for (const s of ['synced', 'pending', 'error']) {
    ctx.store.setStatus(s, s === 'error' ? 'permission-denied' : undefined);
    assert.ok(ctx.$('sync-status').classList.contains(s), s);
  }
});

test('กดทุกเมนูและแดชบอร์ด ไม่มี error และสร้างกราฟ', () => {
  const ctx = boot();
  addTxn(ctx, 'expense', 100);
  ctx.w.document.querySelectorAll('.nav-btn').forEach(b => b.click());
  ctx.w.document.querySelector('.nav-btn[data-page="dashboard"]').click();
  assert.ok(ctx.charts.length > 0);
  assert.deepEqual(ctx.errors, []);
});

test('เชื่อมฐานข้อมูลไม่ได้ก่อนพร้อม: หน้าโหลดบอกสาเหตุ ไม่หมุนค้างเงียบ ๆ', () => {
  const ctx = boot({ ready: false });
  ctx.store.setStatus('error', 'permission-denied');
  const text = ctx.$('app-loading-text').textContent;
  assert.ok(text.includes('permission-denied'), text);
  assert.ok(text.includes('docs/firebase-setup.md'), text);
});
