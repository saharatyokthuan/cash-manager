import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cash',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

after(async () => { await env.cleanup(); });

test('เจ้าของอ่าน/เขียนข้อมูลตัวเองได้', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(db, 'users/alice/transactions/t1'), { amount: 1 }));
  await assertSucceeds(getDoc(doc(db, 'users/alice/transactions/t1')));
});

test('บัญชีอื่นอ่าน/เขียนข้อมูลของคนอื่นไม่ได้', async () => {
  const db = env.authenticatedContext('bob').firestore();
  await assertFails(getDoc(doc(db, 'users/alice/transactions/t1')));
  await assertFails(setDoc(doc(db, 'users/alice/transactions/t1'), { amount: 2 }));
});

test('ไม่ล็อกอินอ่านไม่ได้', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'users/alice/meta/categories')));
});

test('เขียนนอก users/{uid} ไม่ได้', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(db, 'other/x'), { a: 1 }));
});
