# Firebase Cloud Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้ายที่เก็บข้อมูลของ cash-manager จาก `localStorage` ไป Cloud Firestore พร้อม Google sign-in, ใช้ออฟไลน์ได้ และย้ายข้อมูลเก่าอัตโนมัติ

**Architecture:** `js/store.js` export `createStore(fb, opts)` ที่รับฟังก์ชัน Firebase เข้ามา (dependency injection) เพื่อให้ทดสอบด้วย npm `firebase` + Emulator ได้ ส่วน `js/store-boot.js` import SDK จาก gstatic แล้วสร้าง store เปิดไว้ที่ `window.cashStore`; `script.js` เปลี่ยนแค่ storage helpers, จุดเริ่มต้น และ import/clear. ฟังก์ชันบริสุทธิ์อยู่ใน `js/store-core.js`

**Tech Stack:** Vanilla JS (ES modules ฝั่ง store, classic script ฝั่ง UI), Firebase JS SDK 10.14.1 (modular), Firestore persistent local cache, Service Worker, Node 22 `node --test`, Firebase Emulator Suite, `@firebase/rules-unit-testing`, jsdom 24

**Spec:** `docs/superpowers/specs/2026-10-30-firebase-cloud-storage-design.md`

## Global Constraints

- Firebase SDK เวอร์ชันตายตัว `10.14.1` ทั้ง gstatic (`https://www.gstatic.com/firebasejs/10.14.1/firebase-*.js`) และ npm (devDependency สำหรับทดสอบ)
- ไม่มี build step — ไฟล์ใน `js/` ต้องรันในเบราว์เซอร์ได้ตรงๆ
- path ข้อมูล: `users/{uid}/{transactions|loans|debts|recurring}/{id}`, `users/{uid}/meta/categories`, `users/{uid}/meta/profile`
- ชื่อ doc = `id` ของแอป; ฟิลด์ `id` ไม่เก็บซ้ำใน doc; ทุก doc ที่เขียนมี `updatedAt: serverTimestamp()` ซึ่ง store ตัดออกตอนอ่าน
- id รายการที่สร้างจากรายการประจำ: `rec_{recurringId}_{YYYY-MM}`
- `writeBatch` ไม่เกิน 500 operations ต่อชุด
- `localStorage` เก็บเฉพาะ `cft_theme` และ flag `cft_migrated_<uid>`; ไม่ลบ `cft_*` เดิมอัตโนมัติ
- ข้อความ UI เป็นภาษาไทย สไตล์ตามธีม neon เดิม (ใช้ตัวแปร CSS `--accent`, `--accent2`)
- คอมเมนต์ในโค้ดเป็นภาษาไทย ตามสไตล์ไฟล์เดิม
- ต้องเปิดผ่าน HTTPS หรือ `localhost`

## Review Focus

1. ข้อมูลเก่าใน `localStorage` ที่ผิดรูป (amount เป็น string, ไม่มี id, JSON เสีย) — migration ต้อง sanitize และไม่พัง → test ใน Task 3
2. ข้อมูลจากเครื่องอื่นเข้ามาระหว่างผู้ใช้กำลังแก้ฟอร์ม — render ใหม่ต้องไม่ล้างฟอร์มหรือตัวกรองเดือน → test ใน Task 4
3. Import ไฟล์ใหญ่ (> 500 รายการ) — ต้องแบ่ง batch และขึ้นครบ → test ใน Task 3 (1,200 รายการ)
4. สองไคลเอนต์สร้างรายการประจำเดือนเดียวกัน — ต้องได้รายการเดียว → test ใน Task 3
5. ออกจากระบบขณะมีข้อมูลยังไม่ขึ้นคลาวด์ — ต้องเตือนก่อน → test ใน Task 4

---

### Task 1: Test tooling + `store-core.js`

**Files:**
- Create: `package.json`, `.gitignore`, `js/store-core.js`, `tests/store-core.test.mjs`

**Interfaces:**
- Produces (ES module `js/store-core.js`):
  - `COLLECTIONS = ['transactions', 'loans', 'debts', 'recurring']`
  - `diffById(oldList: object[], newList: object[]) -> { upserts: object[], deletes: string[] }` — เทียบด้วย `id`; upsert เมื่อไม่มีใน old หรือ `JSON.stringify` ต่างกัน
  - `chunk(arr: any[], size = 500) -> any[][]`
  - `decideMigration({ cloudHasData: bool, localHasData: bool, alreadyHandled: bool }) -> 'upload' | 'ask' | 'none'`
  - `recurringTxnId(recurringId: string, ym: string) -> string`
  - `stripDoc(id: string, data: object) -> object` — คืน `{ id, ...data }` โดยตัด `updatedAt`

- [ ] **Step 1:** สร้าง `package.json` (`"private": true`, `"type": "module"`, scripts `"test": "node --test tests/"`, `"test:emu": "firebase emulators:exec --only firestore,auth --project demo-cash 'node --test tests/emu/'"`, devDependencies `firebase@10.14.1`, `firebase-tools`, `@firebase/rules-unit-testing`, `jsdom@24`) และ `.gitignore` (`node_modules/`, `*.log`)
- [ ] **Step 2: Write failing tests** `tests/store-core.test.mjs`:
  - `diffById`: เพิ่ม `{id:'a'}` → upserts `[a]`; แก้ amount → upserts `[a']`; ลบ → deletes `['a']`; เหมือนเดิม → ทั้งคู่ว่าง
  - `chunk(range(1200))` → ความยาว `[500, 500, 200]`; `chunk([])` → `[]`
  - `decideMigration`: `{false,true,false}`→`'upload'`; `{true,true,false}`→`'ask'`; `{true,true,true}`→`'none'`; `{false,false,false}`→`'none'`; `{false,true,true}`→`'upload'` (คลาวด์ว่าง = ยังไม่เคยอัปโหลดจริง)
  - `recurringTxnId('id_x', '2026-10')` → `'rec_id_x_2026-10'`
  - `stripDoc('a', {amount:1, updatedAt:{}})` → `{id:'a', amount:1}`
- [ ] **Step 3:** `npm test` → FAIL (module not found)
- [ ] **Step 4:** implement `js/store-core.js`
- [ ] **Step 5:** `npm test` → PASS ทั้งหมด
- [ ] **Step 6:** commit `feat(store): add pure store helpers with tests`

### Task 2: Security rules

**Files:**
- Create: `firestore.rules` (ตามสเปกหัวข้อ 10), `firebase.json` (`firestore.rules`, emulators firestore:8080 auth:9099, `"ui": {"enabled": false}`), `tests/emu/rules.test.mjs`

- [ ] **Step 1: Write failing test** ด้วย `initializeTestEnvironment({ projectId: 'demo-cash', firestore: { rules } })`:
  - `alice` เขียน/อ่าน `users/alice/transactions/t1` → succeeds
  - `bob` อ่าน/เขียน `users/alice/transactions/t1` → fails
  - ไม่ล็อกอิน อ่าน `users/alice/meta/categories` → fails
  - `alice` เขียน `other/x` → fails
- [ ] **Step 2:** รันกับ rules ว่าง (`allow read, write: if false;` ชั่วคราว) → test ข้อแรก FAIL
- [ ] **Step 3:** ใส่ rules ตามสเปก
- [ ] **Step 4:** `npm run test:emu` → PASS
- [ ] **Step 5:** commit `feat(firestore): add per-user security rules`

### Task 3: `store.js` (cache, diff writes, snapshots, migration)

**Files:**
- Create: `js/store.js`, `tests/emu/store.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports
- Produces: `createStore(fb, opts) -> store`
  - `fb`: object ของฟังก์ชัน modular SDK ที่ใช้ — `{ db, auth, doc, collection, getDoc, getDocs, query, limit, onSnapshot, writeBatch, serverTimestamp, onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, terminate, clearIndexedDbPersistence }`
  - `opts`: `{ localStorage, confirmMerge: () => boolean, sanitize: { transactions, loans, debts, recurring, categories } }` — sanitize เป็นฟังก์ชันเดิมใน `script.js` (`sanitizeTransactionRecord` ฯลฯ) ส่งเข้ามาตอนบูต
  - store methods: `getTransactions/getLoans/getDebts/getRecurring() -> object[]` (คืนสำเนา), `getCategories() -> object|null`, `setTransactions/setLoans/setDebts/setRecurring(list)`, `setCategories(cats)`, `replaceAll(data)`, `onAuth(cb(user|null))`, `onReady(cb)`, `onChange(cb)`, `onSyncStatus(cb(status, message?))`, `getSyncStatus()`, `signIn() -> Promise`, `signOut() -> Promise`, `start(uid) -> Promise` (migration + subscribe)
  - status: `'synced' | 'pending' | 'error'`

- [ ] **Step 1: Write failing tests** (emulator, ใช้ npm `firebase` ต่อ emulator, ล็อกอินด้วย `signInWithCredential(auth, GoogleAuthProvider.credential('{"sub":"u1","email":"u1@x.test"}'))`):
  - `start` กับคลาวด์ว่าง + localStorage จำลองมี `cft_transactions` 2 รายการ (หนึ่งรายการ amount เป็น `"12.5"` และไม่มี id) → หลัง `onReady` คลาวด์มี 2 doc, amount เป็น `12.5`, มี `meta/profile.migratedFromLocalAt`, flag `cft_migrated_u1` ถูกตั้ง, `cft_transactions` ยังอยู่
  - localStorage มี `cft_categories` เป็น JSON เสีย → `start` ไม่ throw
  - คลาวด์มีข้อมูล + local มีข้อมูล + `confirmMerge` คืน `false` → คลาวด์ไม่เปลี่ยน; คืน `true` → รายการ local ถูก upsert เพิ่ม
  - `setTransactions` เพิ่ม 1 / แก้ 1 / ลบ 1 → คลาวด์ตรงกับ list ใหม่
  - `replaceAll` ด้วย 1,200 transactions → คลาวด์มี 1,200 doc และรายการเก่าที่ไม่อยู่ใน data ถูกลบ
  - สอง store (สอง Firestore instance, uid เดียวกัน) ต่างเขียน doc `rec_r1_2026-10` → คลาวด์มี doc เดียว
  - store A เขียน → store B ได้ `onChange` และ `getTransactions()` มีรายการใหม่
  - `onChange` ไม่ถูกเรียกเมื่อ snapshot มีข้อมูลเท่ากับ cache (เช่น เสียงสะท้อนจากการเขียนของตัวเอง)
- [ ] **Step 2:** `npm run test:emu` → FAIL
- [ ] **Step 3:** implement `js/store.js`. ข้อกำหนดที่ test ไม่ได้บังคับ:
  - `setX`: อัปเดต cache ก่อน แล้วเขียน diff ด้วย `writeBatch` แบบไม่ await; promise ที่ reject → status `'error'` + message
  - snapshot ใช้ `{ includeMetadataChanges: true }`; status = `'pending'` ถ้ามี collection ใด `hasPendingWrites` หรือ `navigator.onLine === false` ไม่อย่างนั้น `'synced'` (ยกเว้นค้างอยู่ที่ `'error'` จนมีการเขียนสำเร็จครั้งถัดไป)
  - `onReady` ยิงครั้งเดียวเมื่อได้ snapshot แรกครบทั้ง 4 collection + `meta/categories`
  - "คลาวด์มีข้อมูล" = มี `meta/profile` หรือ collection ใดมี doc (`query(..., limit(1))`)
  - `localHasData` = มี key `cft_transactions|cft_loans|cft_debts|cft_recurring` ที่ parse ได้เป็น array ไม่ว่าง หรือ `cft_categories` ที่ parse ได้
  - `signOut`: `fb.signOut` → `fb.terminate(db)` → `fb.clearIndexedDbPersistence(db)` (ผู้เรียกจัดการเตือน pending และ reload)
  - `signIn`: popup; ถ้า error code `auth/popup-blocked` หรือ `auth/operation-not-supported-in-this-environment` → redirect
- [ ] **Step 4:** `npm run test:emu` → PASS
- [ ] **Step 5:** commit `feat(store): add Firestore-backed store with migration`

### Task 4: เชื่อม UI (`store-boot.js`, HTML, CSS, `script.js`)

**Files:**
- Create: `js/store-boot.js`, `js/firebase-config.js`, `tests/ui.test.mjs`, `tests/helpers/fake-store.mjs`
- Modify: `index.html`, `css/style.css`, `js/script.js` (ส่วน 2 storage helpers, `checkAndGenerateRecurring`, `refreshEverything`, init, import/clear, settings)

**Interfaces:**
- Consumes: store API จาก Task 3 ผ่าน `window.cashStore`
- `js/firebase-config.js`: `export const firebaseConfig = { apiKey: 'REPLACE_ME', authDomain: 'REPLACE_ME.firebaseapp.com', projectId: 'REPLACE_ME', appId: 'REPLACE_ME' }`
- `store-boot.js`: import SDK จาก gstatic 10.14.1, ตรวจ IndexedDB (เปิด `cft-probe` ได้ → `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`, ไม่ได้ → `memoryLocalCache()` + ส่ง flag `offlineUnavailable`), ถ้า config ยังเป็น `REPLACE_ME` → แสดงข้อความ "ยังไม่ได้ตั้งค่า Firebase (ดู docs/firebase-setup.md)"; ถ้า import SDK ล้มเหลว → "ต้องต่ออินเทอร์เน็ตครั้งแรกเพื่อเข้าสู่ระบบ"; สร้าง store แล้ว `window.cashStore = store` และ dispatch `document` event `cashstore:created`
- `script.js` ต้อง expose sanitize functions ผ่าน `window.cashSanitize = { transactions: sanitizeTransactionRecord, loans: sanitizeLoanRecord, debts: sanitizeDebtRecord, recurring: sanitizeRecurringRecord, categories: sanitizeCategories }` ให้ store-boot ใช้ (ดังนั้น `script.js` โหลดก่อน `store-boot.js` และ `script.js` รอ event `cashstore:created`)

- [ ] **Step 1: Write failing tests** `tests/ui.test.mjs` (jsdom โหลด `index.html` + `script.js`, ใช้ fake store ใน memory ที่มี API เดียวกับ Task 3 และ `emit('change')`, `setStatus()`):
  - ก่อน store ready: `#app-loading` แสดง, `.content` ซ่อน
  - `onAuth(null)` → `#login-screen` แสดง; กด `#login-btn` → เรียก `signIn`
  - ready → เพิ่มรายรับ 1000 / รายจ่าย 250.5 → `#topbar-balance` = `฿749.50`, fake store มี 2 รายการ
  - ไม่มี `localStorage.cft_transactions` ถูกเขียนระหว่างใช้งาน
  - Review Focus #2: กดแก้ไขรายการ → fake store `emit('change')` พร้อมรายการใหม่จากเครื่องอื่น → `#txn-amount` ยังเป็นค่าเดิม, `#txn-submit-btn` ยังเป็น "บันทึกการแก้ไข", ตัวกรองเดือนที่เลือก `all` ยังเป็น `all`, รายการใหม่แสดงในลิสต์
  - recurring วันที่ 1 ที่ `generatedMonths: []` → transaction ใหม่มี id `rec_{id}_{เดือนนี้}`
  - Import json → เรียก `replaceAll` ครั้งเดียว และข้อความ confirm มีคำว่า "ทุกเครื่อง"
  - Review Focus #5: status `'pending'` → กด `#logout-btn` → `confirm` ถูกเรียกด้วยข้อความที่มี "ยังไม่ได้ซิงก์"; ตอบ false → ไม่เรียก `signOut`
  - status `'synced'|'pending'|'error'` → `#sync-status` มี class `synced|pending|error`
  - กดทุกปุ่มเมนู + แดชบอร์ด → ไม่มี error
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** แก้ `index.html`: เพิ่ม `#app-loading`, `#login-screen` (ปุ่ม `#login-btn` "เข้าสู่ระบบด้วย Google", `#login-message`), `#sync-status` ใน topbar, ในหน้าตั้งค่าเพิ่มการ์ด "บัญชี" (`#account-email`, `#logout-btn`, `#clear-local-backup-btn` "ล้างข้อมูลสำรองเก่าในเครื่อง"); แก้ข้อความ danger-zone เป็น "ลบข้อมูลทั้งหมดบนคลาวด์ (ทุกเครื่อง)"; โหลด `js/script.js` (defer) แล้ว `<script type="module" src="js/store-boot.js">`
- [ ] **Step 4:** แก้ `script.js`:
  - ส่วน 2: `get*/set*` เรียก `window.cashStore`; ลบ `loadFromStorage/saveToStorage` ที่ไม่ใช้แล้ว
  - init: ย้ายเนื้อหา `DOMContentLoaded` เป็น `bootApp()` ที่รันเมื่อ `cashstore:created` → ลงทะเบียน `onAuth`, `onReady(() => { ensureDefaultCategories(); checkAndGenerateRecurring(); renderAll; ซ่อน loading })`, `onChange(requestRender)`, `onSyncStatus(updateSyncIcon)`; init ฟอร์ม/อีเวนต์ทำครั้งเดียว
  - `requestRender()`: รวบด้วย `requestAnimationFrame` → `refreshEverything()`; `refreshEverything` ใช้ `populateMonthFilter('home-month-filter', true)`
  - `checkAndGenerateRecurring`: id = `recurringTxnId`-รูปแบบเดียวกัน (`rec_${item.id}_${ym}`) และข้ามถ้ามี id นี้อยู่แล้วใน transactions
  - import json/xlsx: รวบรวมเป็น object เดียว → `cashStore.replaceAll(data)`; ข้อความ confirm: "การนำเข้าจะแทนที่ข้อมูลทั้งหมดบนคลาวด์ (มีผลกับทุกเครื่องที่ล็อกอินบัญชีนี้) ต้องการดำเนินการต่อหรือไม่?"
  - clear: `replaceAll({transactions:[],loans:[],debts:[],recurring:[],categories:null})` แล้ว `ensureDefaultCategories()`; ข้อความ confirm บอกว่าลบบนคลาวด์ทุกเครื่อง
  - logout: ถ้า status `pending` → `confirm('ยังมีข้อมูลที่ยังไม่ได้ซิงก์ขึ้นคลาวด์ ถ้าออกจากระบบตอนนี้ข้อมูลส่วนนั้นจะหาย ต้องการออกจากระบบหรือไม่?')`; จากนั้น `confirm` ทั่วไป → `await cashStore.signOut()` → `location.reload()`
  - clear-local-backup: ลบ `cft_transactions|cft_categories|cft_loans|cft_debts|cft_recurring` หลัง confirm
  - `neonFx`: `renderDashboard` เรียกได้เฉพาะหลัง ready (guard)
- [ ] **Step 5:** `css/style.css`: สไตล์ `#app-loading`, `#login-screen` (เต็มจอ กลางจอ ใช้ `--accent`), `#sync-status` 3 สถานะ (synced = `--color-income`, pending = `--accent2` กระพริบ, error = `--color-expense`)
- [ ] **Step 6:** `npm test` → PASS
- [ ] **Step 7:** commit `feat(ui): wire app to cloud store with login and sync status`

### Task 5: Service Worker (offline app shell)

**Files:**
- Create: `sw.js`, `tests/sw.test.mjs`
- Modify: `js/store-boot.js` (register `sw.js` เมื่อ `'serviceWorker' in navigator` และ `location.protocol !== 'file:'`)

- [ ] **Step 1: Write failing test**: อ่าน `sw.js` export รายการ `PRECACHE` (ประกาศเป็น `const PRECACHE = [...]` แล้ว test ดึงด้วย regex/eval) — ต้องมีทุก `<script src>`/`<link href>` ใน `index.html`, `js/store-boot.js`, `js/store.js`, `js/store-core.js`, `js/firebase-config.js` และ `firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js` เวอร์ชัน 10.14.1
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** implement `sw.js`: `CACHE = 'cash-manager-v1'`; install → precache; activate → ลบ cache เก่า; fetch GET เท่านั้น: URL ที่ขึ้นต้น `https://www.gstatic.com/firebasejs/` หรือ `https://cdnjs.cloudflare.com/` → cache-first; same-origin → network-first fallback cache; อย่างอื่น (Firestore/Auth API) → ไม่แตะ
- [ ] **Step 4:** `npm test` → PASS
- [ ] **Step 5:** commit `feat(offline): add service worker for app shell`

### Task 6: เอกสาร

**Files:**
- Create: `docs/firebase-setup.md`
- Modify: `README.md`

- [ ] **Step 1:** `docs/firebase-setup.md` (ไทย): สร้างโปรเจกต์ → เพิ่ม Web App → คัดลอก config ใส่ `js/firebase-config.js` → Authentication เปิด Google → Authorized domains เพิ่ม `saharatyokthuan.github.io` → สร้าง Firestore (production mode, region `asia-southeast1`) → วาง `firestore.rules` ในแท็บ Rules → เปิด GitHub Pages; ท้ายเอกสารมีเช็กลิสต์ทดสอบบนมือถือตามสเปกหัวข้อ 11 ข้อ 4; ส่วนนักพัฒนา: `npm install`, `npm test`, `npm run test:emu`
- [ ] **Step 2:** README: แก้ "ข้อควรทราบ" (ข้อมูลอยู่บน Firestore, ต้องล็อกอิน, ต้อง HTTPS/localhost, ออฟไลน์ได้หลังเปิดครั้งแรก), โครงสร้างไฟล์ใหม่, ลิงก์ไป `docs/firebase-setup.md`
- [ ] **Step 3:** `npm test && npm run test:emu` → PASS ทั้งหมด
- [ ] **Step 4:** commit `docs: add Firebase setup guide and update README`
