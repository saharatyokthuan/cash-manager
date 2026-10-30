/* ===================================================================
   store.js - ส่วนเก็บข้อมูลบน Cloud Firestore
   - เก็บสำเนาข้อมูลไว้ใน memory ให้ script.js อ่าน/เขียนได้ทันที (synchronous) เหมือนเดิม
   - เขียนขึ้น Firestore เฉพาะรายการที่เปลี่ยนจริง (ออฟไลน์ก็เขียนลงเครื่องก่อน แล้ว SDK ส่งต่อให้เอง)
   - ฟังการเปลี่ยนแปลงจากเครื่องอื่นด้วย onSnapshot
   - ย้ายข้อมูลเก่าจาก localStorage ขึ้นคลาวด์ตอนล็อกอินครั้งแรก
   รับฟังก์ชัน Firebase ผ่าน fb (ไม่ import ตรง ๆ) เพื่อให้ทดสอบกับ Emulator ด้วย npm firebase ได้
   =================================================================== */

import { COLLECTIONS, diffById, chunk, decideMigration, stripDoc, stableStringify } from './store-core.js';

const LOCAL_KEYS = {
  transactions: 'cft_transactions',
  loans: 'cft_loans',
  debts: 'cft_debts',
  recurring: 'cft_recurring',
  categories: 'cft_categories'
};

// error code ที่แปลว่าเปิด popup ไม่ได้ ให้เปลี่ยนไปล็อกอินแบบ redirect แทน
const POPUP_FALLBACK_CODES = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'];

export function createStore(fb, opts) {
  const { db } = fb;
  const storage = opts.localStorage;
  const cache = { transactions: [], loans: [], debts: [], recurring: [], categories: null };
  const listeners = { ready: [], change: [], status: [] };
  const pendingParts = new Set();
  const seenParts = new Set();
  const unsubscribes = [];
  let uid = null;
  let isReady = false;
  let status = 'synced';
  let errorMessage = '';

  const copy = value => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const userDoc = (...path) => fb.doc(db, 'users', uid, ...path);
  const emit = (name, ...args) => listeners[name].forEach(cb => cb(...args));

  /* ---------- สถานะซิงก์ ---------- */

  function refreshStatus() {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const next = errorMessage ? 'error' : (pendingParts.size > 0 || offline ? 'pending' : 'synced');
    if (next !== status) {
      status = next;
      emit('status', status, errorMessage || undefined);
    }
  }

  function reportError(err) {
    console.error('store error:', err);
    errorMessage = (err && (err.code || err.message)) || 'unknown error';
    refreshStatus();
  }

  /* ---------- การเขียน ---------- */

  // ตัด id และค่า undefined ออก (Firestore ไม่รับ undefined) แล้วเติมเวลาที่แก้ไขล่าสุด
  function toDocData(item) {
    const { id, ...data } = copy(item);
    return { ...data, updatedAt: fb.serverTimestamp() };
  }

  // ops คือฟังก์ชันที่รับ batch ไปใส่คำสั่ง; แบ่งเป็นชุดละไม่เกิน 500 ตามข้อจำกัดของ Firestore
  // ไม่ต้อง await ตอนใช้งานปกติ เพราะตอนออฟไลน์ promise จะค้างจนกว่าจะมีเน็ต
  function commit(ops) {
    if (ops.length === 0) return Promise.resolve();
    const commits = chunk(ops).map(group => {
      const batch = fb.writeBatch(db);
      group.forEach(op => op(batch));
      return batch.commit();
    });
    return Promise.all(commits).then(() => {
      if (errorMessage) { errorMessage = ''; refreshStatus(); }
    }, err => { reportError(err); throw err; });
  }

  function listOps(name, newList) {
    const { upserts, deletes } = diffById(cache[name], newList);
    cache[name] = copy(newList);
    return [
      ...upserts.map(item => batch => batch.set(userDoc(name, item.id), toDocData(item))),
      ...deletes.map(id => batch => batch.delete(userDoc(name, id)))
    ];
  }

  function categoriesOp(cats) {
    return batch => batch.set(userDoc('meta', 'categories'), { ...copy(cats), updatedAt: fb.serverTimestamp() });
  }

  const setList = name => list => { commit(listOps(name, list)).catch(() => {}); };

  function setCategories(cats) {
    cache.categories = copy(cats);
    commit([categoriesOp(cats)]).catch(() => {});
  }

  // แทนที่ข้อมูลทั้งหมด (ใช้กับ Import และล้างข้อมูล) categories เป็น null = ลบหมวดหมู่ทิ้ง
  function replaceAll(data) {
    const ops = COLLECTIONS.flatMap(name => listOps(name, data[name] || []));
    cache.categories = copy(data.categories || null);
    ops.push(data.categories ? categoriesOp(data.categories) : batch => batch.delete(userDoc('meta', 'categories')));
    return commit(ops);
  }

  /* ---------- การอ่านจาก Firestore ---------- */

  function markSeen(part) {
    seenParts.add(part);
    if (!isReady && seenParts.size === COLLECTIONS.length + 1) {
      isReady = true;
      emit('ready');
    }
  }

  // อัปเดต cache เมื่อข้อมูลต่างจริง (กันเสียงสะท้อนจากการเขียนของตัวเองที่ทำให้วาดหน้าจอซ้ำ)
  function applySnapshot(part, value, hasPendingWrites) {
    if (hasPendingWrites) pendingParts.add(part); else pendingParts.delete(part);
    const sortById = list => list.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const same = part === 'categories'
      ? stableStringify(value) === stableStringify(cache.categories)
      : stableStringify(sortById(value)) === stableStringify(sortById(cache[part]));
    if (!same) {
      cache[part] = value;
      if (isReady) emit('change');
    }
    refreshStatus();
    markSeen(part);
  }

  function subscribe() {
    const options = { includeMetadataChanges: true };
    COLLECTIONS.forEach(name => {
      unsubscribes.push(fb.onSnapshot(fb.collection(db, 'users', uid, name), options, snap => {
        applySnapshot(name, snap.docs.map(d => stripDoc(d.id, d.data())), snap.metadata.hasPendingWrites);
      }, reportError));
    });
    unsubscribes.push(fb.onSnapshot(userDoc('meta', 'categories'), options, snap => {
      const value = snap.exists() ? (({ updatedAt, ...rest }) => rest)(snap.data()) : null;
      applySnapshot('categories', value, snap.metadata.hasPendingWrites);
    }, reportError));
  }

  /* ---------- ย้ายข้อมูลเก่าจาก localStorage ---------- */

  function readLocal() {
    const parse = key => {
      try { return JSON.parse(storage.getItem(key)); } catch (err) { return null; }
    };
    const local = {};
    COLLECTIONS.forEach(name => {
      const raw = parse(LOCAL_KEYS[name]);
      local[name] = Array.isArray(raw) ? raw.map(opts.sanitize[name]).filter(Boolean) : [];
    });
    const rawCats = parse(LOCAL_KEYS.categories);
    local.categories = rawCats && typeof rawCats === 'object' ? opts.sanitize.categories(rawCats) : null;
    local.hasData = COLLECTIONS.some(name => local[name].length > 0) || !!local.categories;
    return local;
  }

  async function cloudHasData() {
    if ((await fb.getDoc(userDoc('meta', 'profile'))).exists()) return true;
    if ((await fb.getDoc(userDoc('meta', 'categories'))).exists()) return true;
    for (const name of COLLECTIONS) {
      const snap = await fb.getDocs(fb.query(fb.collection(db, 'users', uid, name), fb.limit(1)));
      if (!snap.empty) return true;
    }
    return false;
  }

  // รวมหมวดหมู่จากเครื่องเข้ากับของบนคลาวด์ โดยไม่เพิ่มชื่อซ้ำ
  function mergeCategories(cloud, local) {
    if (!cloud) return local;
    const merged = copy(cloud);
    ['income', 'expense'].forEach(type => {
      merged[type] = merged[type] || [];
      (local[type] || []).forEach(c => {
        if (!merged[type].some(m => m.name === c.name)) merged[type].push(c);
      });
    });
    return merged;
  }

  async function migrate() {
    const local = readLocal();
    if (!local.hasData) return;
    const flagKey = `cft_migrated_${uid}`;
    const decision = decideMigration({
      cloudHasData: await cloudHasData(),
      localHasData: true,
      alreadyHandled: !!storage.getItem(flagKey)
    });
    if (decision === 'none') return;

    if (decision === 'upload' || opts.confirmMerge()) {
      // อัปโหลดแบบ upsert อย่างเดียว ไม่ลบอะไรบนคลาวด์
      const ops = COLLECTIONS.flatMap(name =>
        local[name].map(item => batch => batch.set(userDoc(name, item.id), toDocData(item))));
      if (local.categories) {
        const cloudCats = await fb.getDoc(userDoc('meta', 'categories'));
        const cats = mergeCategories(cloudCats.exists() ? cloudCats.data() : null, local.categories);
        delete cats.updatedAt;
        ops.push(categoriesOp(cats));
      }
      ops.push(batch => batch.set(userDoc('meta', 'profile'), { migratedFromLocalAt: fb.serverTimestamp() }, { merge: true }));
      await commit(ops);
    }
    // ไม่ลบข้อมูลเดิมในเครื่อง เก็บไว้เป็นสำเนาสำรองจนกว่าผู้ใช้จะกดล้างเอง
    storage.setItem(flagKey, new Date().toISOString());
  }

  /* ---------- API ---------- */

  return {
    getTransactions: () => copy(cache.transactions),
    getLoans: () => copy(cache.loans),
    getDebts: () => copy(cache.debts),
    getRecurring: () => copy(cache.recurring),
    getCategories: () => copy(cache.categories),
    setTransactions: setList('transactions'),
    setLoans: setList('loans'),
    setDebts: setList('debts'),
    setRecurring: setList('recurring'),
    setCategories,
    replaceAll,

    onAuth: cb => fb.onAuthStateChanged(fb.auth, cb),
    onReady: cb => { if (isReady) cb(); else listeners.ready.push(cb); },
    onChange: cb => listeners.change.push(cb),
    onSyncStatus: cb => listeners.status.push(cb),
    getSyncStatus: () => status,
    refreshStatus,

    async start(userId) {
      uid = userId;
      try {
        await migrate();
      } catch (err) {
        // ย้ายข้อมูลไม่สำเร็จก็ยังให้ใช้แอปต่อได้ ข้อมูลเดิมยังอยู่ในเครื่อง (ไม่ได้ตั้ง flag)
        reportError(err);
      }
      subscribe();
    },

    async signIn() {
      const provider = new fb.GoogleAuthProvider();
      try {
        await fb.signInWithPopup(fb.auth, provider);
      } catch (err) {
        if (!POPUP_FALLBACK_CODES.includes(err && err.code)) throw err;
        await fb.signInWithRedirect(fb.auth, provider);
      }
    },

    async signOut() {
      unsubscribes.splice(0).forEach(unsub => unsub());
      await fb.signOut(fb.auth);
      await fb.terminate(db);
      await fb.clearIndexedDbPersistence(db);
    }
  };
}
