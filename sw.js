/* ===================================================================
   sw.js - Service Worker: เก็บไฟล์แอปและไลบรารีไว้ในเครื่อง
   เพื่อให้เปิดแอปได้แม้ไม่มีอินเทอร์เน็ต (ข้อมูลจริงอยู่ใน Firestore cache อีกชั้น)
   =================================================================== */

const CACHE = 'cash-manager-v1';
const FIREBASE = 'https://www.gstatic.com/firebasejs/10.14.1';

const PRECACHE = [
  './',
  'index.html',
  'css/style.css',
  'js/script.js',
  'js/store-boot.js',
  'js/store.js',
  'js/store-core.js',
  'js/firebase-config.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js'
];

// ไลบรารีจาก CDN ระบุเวอร์ชันตายตัว เนื้อหาไม่เปลี่ยน จึงใช้จาก cache ก่อนได้เลย
const IMMUTABLE_PREFIXES = [FIREBASE + '/', 'https://cdnjs.cloudflare.com/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // ไฟล์ใดโหลดไม่สำเร็จก็ไม่ให้การติดตั้งทั้งหมดล้ม (เช่น CDN ล่มชั่วคราว)
      .then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  if (IMMUTABLE_PREFIXES.some(p => url.startsWith(p))) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }))
    );
    return;
  }

  // ไฟล์ของแอปเอง: ใช้ของใหม่จากเน็ตก่อน ถ้าออฟไลน์ค่อยใช้จาก cache
  if (new URL(url).origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
  }
  // คำขออื่น ๆ (Firestore/Auth API) ไม่แตะ ให้ SDK จัดการเอง
});
