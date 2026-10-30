/* ===================================================================
   store-boot.js - โหลด Firebase SDK แล้วสร้าง window.cashStore ให้ script.js ใช้
   =================================================================== */

import { firebaseConfig } from './firebase-config.js';
import { createStore } from './store.js';

const FIREBASE = 'https://www.gstatic.com/firebasejs/10.14.1';

function showBootMessage(message) {
  document.getElementById('app-loading-text').textContent = message;
}

// IndexedDB ใช้ไม่ได้ในบางเบราว์เซอร์/โหมดไม่ระบุตัวตน ถ้าใช้ไม่ได้ต้องเก็บ cache ไว้ใน memory แทน
function canUseIndexedDb() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('cft-probe');
      req.onsuccess = () => { req.result.close(); resolve(true); };
      req.onerror = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

async function boot() {
  // Service Worker เก็บไฟล์แอปไว้ใช้ตอนออฟไลน์ (ใช้ได้เฉพาะ https/localhost)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('sw register:', err));
  }

  if (Object.values(firebaseConfig).some(v => String(v).includes('REPLACE_ME'))) {
    showBootMessage('ยังไม่ได้ตั้งค่า Firebase (ดู docs/firebase-setup.md)');
    return;
  }

  let appSdk, authSdk, firestoreSdk;
  try {
    [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import(`${FIREBASE}/firebase-app.js`),
      import(`${FIREBASE}/firebase-auth.js`),
      import(`${FIREBASE}/firebase-firestore.js`)
    ]);
  } catch (err) {
    console.error(err);
    showBootMessage('ต้องต่ออินเทอร์เน็ตครั้งแรกเพื่อเข้าสู่ระบบ');
    return;
  }

  const app = appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const offlineAvailable = await canUseIndexedDb();
  const db = firestoreSdk.initializeFirestore(app, {
    localCache: offlineAvailable
      ? firestoreSdk.persistentLocalCache({ tabManager: firestoreSdk.persistentMultipleTabManager() })
      : firestoreSdk.memoryLocalCache()
  });

  const store = createStore({ ...firestoreSdk, ...authSdk, db, auth }, {
    localStorage: window.localStorage,
    sanitize: window.cashSanitize,
    confirmMerge: () => confirm('พบข้อมูลเดิมในเครื่องนี้ที่ยังไม่อยู่บนคลาวด์\nกด "ตกลง" เพื่อรวมเข้ากับข้อมูลบนคลาวด์ หรือ "ยกเลิก" เพื่อข้าม (ข้อมูลในเครื่องยังเก็บไว้)')
  });
  window.cashStore = store;
  window.addEventListener('online', store.refreshStatus);
  window.addEventListener('offline', store.refreshStatus);
  store.onAuth(user => { if (user) store.start(user.uid); });
  document.dispatchEvent(new Event('cashstore:created'));

  if (!offlineAvailable) {
    store.onReady(() => showToast('เบราว์เซอร์นี้ใช้งานออฟไลน์ไม่ได้ (เช่น โหมดไม่ระบุตัวตน) แต่ออนไลน์ยังใช้ได้ปกติ'));
  }
}

boot();
