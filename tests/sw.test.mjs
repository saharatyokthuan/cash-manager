// ตรวจว่า Service Worker เก็บทุกไฟล์ที่ต้องใช้ตอนเปิดแอปแบบออฟไลน์
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const precache = new Function(`${sw.match(/const PRECACHE = \[[\s\S]*?\];/)[0]}; return PRECACHE;`)();
const normalize = u => u.replace(/^\.\//, '');

test('PRECACHE มีทุก script/stylesheet ใน index.html', () => {
  const refs = [...html.matchAll(/<(?:script[^>]*src|link[^>]*href)="([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length > 0);
  for (const ref of refs) assert.ok(precache.map(normalize).includes(normalize(ref)), ref);
});

test('PRECACHE มีไฟล์ store และ Firebase SDK 10.14.1', () => {
  const list = precache.map(normalize);
  for (const f of ['index.html', 'js/store-boot.js', 'js/store.js', 'js/store-core.js', 'js/firebase-config.js']) {
    assert.ok(list.includes(f), f);
  }
  for (const mod of ['app', 'auth', 'firestore']) {
    assert.ok(list.includes(`https://www.gstatic.com/firebasejs/10.14.1/firebase-${mod}.js`), mod);
  }
});
