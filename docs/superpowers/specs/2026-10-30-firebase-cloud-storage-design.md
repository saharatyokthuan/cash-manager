# ย้ายที่เก็บข้อมูลไป Firebase (Google Cloud) — Design Spec

- วันที่: 2026-10-30
- สถานะ: รอผู้ใช้ตรวจสเปก
- Branch: `feature/firebase-cloud-storage`

## 1. เป้าหมายและขอบเขต

### สิ่งที่ผู้ใช้ต้องการ
1. **กันข้อมูลหาย** — ข้อมูลต้องไม่หายเมื่อล้างแคช เปลี่ยนเบราว์เซอร์ หรือเปลี่ยนมือถือ
2. **ล็อกอิน Google ครั้งเดียวแล้วจำไว้** — หลังจากนั้นสำรองขึ้นคลาวด์อัตโนมัติ
3. **ใช้ออฟไลน์ได้เหมือนเดิม** — บันทึกลงเครื่องก่อน แล้วซิงก์ขึ้นคลาวด์เองเมื่อมีเน็ต

### สมมติฐาน (ผู้ใช้ไม่ได้ระบุ แต่ยอมรับในขั้นสรุปความเข้าใจ)
- ผู้ใช้คนเดียว ไม่แชร์บัญชีกับคนอื่น (แต่ใช้ได้หลายเครื่อง)
- ใช้ Firebase แพ็กเกจฟรี (Spark)
- ยังโฮสต์แบบ static บน GitHub Pages ไม่มีเซิร์ฟเวอร์ของตัวเอง
- Import/Export `.json` / `.xlsx` ยังอยู่ เป็นสำรองชั้นที่สอง

### เกณฑ์สำเร็จ
- ล็อกอินครั้งแรกแล้ว ข้อมูลเดิมใน `localStorage` ขึ้นไปอยู่บน Firestore ครบ
- ปิด-เปิดแอปใหม่ (รวมถึงตอนออฟไลน์) ไม่ต้องล็อกอินซ้ำ และเห็นข้อมูลครบ
- เพิ่มรายการตอนออฟไลน์ → เปิดเน็ต → รายการขึ้นคลาวด์และเห็นจากอีกเครื่อง
- บัญชีหนึ่งอ่าน/เขียนข้อมูลของบัญชีอื่นไม่ได้ (ยืนยันด้วย rules test)
- หน้าจอและฟีเจอร์เดิมทุกหน้าทำงานเหมือนเดิม

### นอกขอบเขต
- แชร์บัญชีกับคนอื่น / หลายผู้ใช้ต่อหนึ่งชุดข้อมูล
- รวมการแก้ไขรายการเดียวกันระดับฟิลด์ (ใช้ last-write-wins ต่อรายการ)
- แก้บั๊กที่ผู้ใช้รายงานก่อนหน้า (ยอดผิด/รายการหาย/ปุ่ม/กราฟ) — ยังทำให้เกิดซ้ำไม่ได้ แยกเป็นงานต่างหาก

## 2. ทางเลือกที่พิจารณา

| ทางเลือก | ผล |
|---|---|
| **A. Firebase Auth + Cloud Firestore** | **เลือก** — ตอบครบทั้ง 3 ข้อ มี offline persistence และ sync ในตัว |
| B. ไฟล์ JSON ใน Google Drive (appDataFolder) | ไม่เลือก — token ฝั่ง client หมดอายุ ~1 ชม. ต้องยืนยันซ้ำ, เขียนทับทั้งไฟล์ข้ามเครื่อง |
| C. Google Sheets เป็นฐานข้อมูล | ไม่เลือก — ปัญหาล็อกอินเหมือน B และช้า |

## 3. สถาปัตยกรรม

```
หน้าจอเดิม (render…, init…)            ← แทบไม่แก้
        │  getX() / setX()  (synchronous เหมือนเดิม)
        ▼
 js/store.js
   • in-memory cache                    ← getX() อ่านจากตรงนี้
   • setX(list): diff กับ cache → เขียนเฉพาะ doc ที่เพิ่ม/แก้/ลบ
   • onSnapshot → อัปเดต cache → requestRender()
        │
        ▼
 Firestore SDK (persistentLocalCache / IndexedDB)
        │
        ▼
 Cloud Firestore  users/{uid}/…
```

### ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `js/firebase-config.js` (ใหม่) | ค่า config ของโปรเจกต์ Firebase (เปิดเผยได้ ไม่ใช่ความลับ) |
| `js/store.js` (ใหม่) | init Firebase, auth, cache, diff+write, onSnapshot, migration, สถานะซิงก์ |
| `js/store-core.js` (ใหม่) | ฟังก์ชันบริสุทธิ์ที่ไม่พึ่ง Firebase/DOM: `diffById`, `chunk`, `decideMigration`, `recurringTxnId` — ทดสอบด้วย Node ได้ |
| `js/script.js` (แก้) | storage helpers เรียก store แทน `localStorage`; init รอ store พร้อม; recurring ใช้ id แบบกำหนดได้; import ผ่าน store; เพิ่มปุ่มออกจากระบบ |
| `index.html` (แก้) | หน้าล็อกอิน, หน้าจอกำลังโหลด, ไอคอนสถานะซิงก์, ปุ่มออกจากระบบ, โหลด script แบบ module, ลงทะเบียน SW |
| `css/style.css` (แก้) | สไตล์หน้าล็อกอิน/ไอคอนสถานะซิงก์ ตามธีมเดิม |
| `sw.js` (ใหม่) | Service Worker: cache app shell + Firebase SDK + Chart.js + SheetJS (cache-first สำหรับ CDN ที่ระบุเวอร์ชัน, network-first สำหรับไฟล์แอป) |
| `firestore.rules` (ใหม่) | กฎความปลอดภัย |
| `firebase.json` (ใหม่) | config สำหรับ emulator และ deploy rules |
| `docs/firebase-setup.md` (ใหม่) | ขั้นตอนตั้งค่า Firebase Console ทีละข้อ (ภาษาไทย) |
| `README.md` (แก้) | อัปเดตข้อควรทราบเรื่องที่เก็บข้อมูล/ล็อกอิน/HTTPS |

### Firebase SDK
- ใช้ modular SDK v10 แบบ ES module จาก `https://www.gstatic.com/firebasejs/<เวอร์ชันตายตัว>/…` (ไม่มี build step)
- Firestore: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`
- Auth: `browserLocalPersistence` (ค่าเริ่มต้น) — จำการล็อกอินและใช้ได้ตอนออฟไลน์

### ข้อจำกัดการใช้งาน
ต้องเปิดผ่าน **HTTPS หรือ `localhost`** (GitHub Pages / Termux `python -m http.server`) — Google sign-in และ Service Worker ไม่ทำงานกับ `file://`

## 4. โครงสร้างข้อมูล

```
users/{uid}/
  transactions/{id}   { date, type, category, amount, note, updatedAt }
  loans/{id}          { name, date, amount, status, note, updatedAt }
  debts/{id}          { name, limit, balance, interest, dueDay, minPayment, updatedAt }
  recurring/{id}      { name, day, type, category, amount, note, generatedMonths, updatedAt }
  meta/categories     { income: [{id,name}], expense: [{id,name}], _addedBorrowReturn }
  meta/profile        { migratedFromLocalAt }
```

- ชื่อ document = `id` เดิมของแอป (`id` ไม่ถูกเก็บซ้ำในฟิลด์ — store เติมกลับตอนอ่าน)
- `updatedAt` = `serverTimestamp()` ตอนเขียน ใช้ดูย้อนหลังเท่านั้น ไม่ใช้ตัดสิน conflict
- **รายการที่สร้างจากรายการประจำ** ใช้ id แบบกำหนดได้ `rec_{recurringId}_{YYYY-MM}` เพื่อให้สองเครื่องที่สร้างพร้อมกันตอนออฟไลน์เขียนลง document เดียวกัน ไม่เกิดรายการซ้ำ

## 5. Store API (ที่ `script.js` ใช้)

```js
// คืนค่าทันทีจาก cache (โครงสร้างเดียวกับของเดิม)
getTransactions() / getLoans() / getDebts() / getRecurring() / getCategories()

// อัปเดต cache ทันที แล้วเขียนเฉพาะส่วนที่ต่างไป Firestore (ไม่ await)
setTransactions(list) / setLoans(list) / setDebts(list) / setRecurring(list) / setCategories(cats)

// แทนที่ข้อมูลทั้งหมด (ใช้กับ Import และ "ล้างข้อมูล")
replaceAll({ transactions, loans, debts, recurring, categories })

onReady(callback)      // เรียกครั้งเดียวเมื่อ snapshot แรกของทั้ง 5 ส่วนมาครบ
onChange(callback)     // เรียกเมื่อข้อมูลเปลี่ยนจากเครื่องอื่น/จาก server
onSyncStatus(callback) // 'synced' | 'pending' | 'error'
signIn() / signOut()
```

- `setX` คำนวณ `diffById(oldList, newList)` → `{ upserts, deletes }` เปรียบเทียบเนื้อหาแบบ JSON ของแต่ละรายการ แล้วเขียนด้วย `writeBatch` แบ่งชุดละ ≤ 500 operations
- ฟังก์ชัน `getX`/`setX` เดิมใน `script.js` เปลี่ยนเป็นเรียก store; ส่วนอื่นของ `script.js` ไม่ต้องเปลี่ยน
- การโหลด: `store.js` เป็น `<script type="module">` ที่ import `store-core.js` และ Firebase SDK แล้วเปิด API ไว้ที่ `window.cashStore`; `script.js` ยังเป็น script ธรรมดา และเปลี่ยนจุดเริ่มจาก `DOMContentLoaded` เป็น `cashStore.onReady(...)` (store.js โหลดก่อน script.js ตามลำดับใน HTML ทั้งคู่ทำงานหลัง parse เสร็จ)

## 6. ลำดับการทำงาน

### เปิดแอป
1. แสดงหน้าจอ "กำลังโหลด…" ซ่อนเนื้อหาแอป
2. `onAuthStateChanged`:
   - ไม่มีผู้ใช้ → แสดงหน้าล็อกอิน
   - มีผู้ใช้ → ทำข้อ 3
3. ตรวจ/ทำ migration (หัวข้อ 7)
4. subscribe `onSnapshot` ทั้ง 5 ส่วน; เมื่อ snapshot แรกครบทุกส่วน → `ensureDefaultCategories()` → `checkAndGenerateRecurring()` → render ทุกหน้า → ซ่อนหน้าจอโหลด
5. snapshot ถัดๆ ไป → อัปเดต cache → `requestRender()` (รวบเป็นครั้งเดียวต่อ animation frame → `refreshEverything()` โดยรักษาค่าตัวกรองเดือนและหน้าที่เปิดอยู่)

### ล็อกอิน
- `signInWithPopup(GoogleAuthProvider)`; ถ้า error `auth/popup-blocked` หรือ `auth/operation-not-supported-in-this-environment` → `signInWithRedirect`

### ออกจากระบบ (หน้าตั้งค่า)
- ถ้าสถานะเป็น `pending` → เตือนว่ายังมีข้อมูลไม่ขึ้นคลาวด์ ให้ยืนยันก่อน
- `signOut()` → `terminate(db)` → `clearIndexedDbPersistence(db)` → reload หน้า

## 7. การย้ายข้อมูลเก่า

`decideMigration({ cloudHasData, cloudMigrated, localHasData })` คืนค่าหนึ่งใน:

| เงื่อนไข | ผล |
|---|---|
| คลาวด์ว่าง และเครื่องมีข้อมูล `cft_*` | `upload` — อัปโหลดทั้งหมด แล้วเขียน `meta/profile.migratedFromLocalAt` |
| คลาวด์มีข้อมูล และเครื่องมีข้อมูล `cft_*` ที่ยังไม่เคยจัดการในเครื่องนี้ | `ask` — ถามผู้ใช้: **รวมเข้าไป** (upsert ตาม id) หรือ **ข้าม** |
| อื่นๆ | `none` |

- "คลาวด์มีข้อมูล" = มี `meta/profile` หรือมี document ใน collection ใดก็ได้
- เครื่องนี้จัดการแล้ว = flag `cft_migrated_<uid>` ใน `localStorage` (กันถามซ้ำ)
- ข้อมูลจาก `localStorage` ผ่าน `sanitize*Record` เดิมก่อนอัปโหลด
- **ไม่ลบ** `cft_*` ใน `localStorage` อัตโนมัติ — ปุ่ม "ล้างข้อมูลสำรองในเครื่อง" ในหน้าตั้งค่า
- `cft_theme` ยังอยู่ใน `localStorage` (ค่าเฉพาะเครื่อง)

## 8. Import / Export / ล้างข้อมูล

- Export `.json`/`.xlsx`: อ่านจาก cache เหมือนเดิม
- Import: sanitize เหมือนเดิม แล้ว `replaceAll(...)`; ข้อความยืนยันบอกว่ามีผลกับ**ทุกเครื่อง**ที่ล็อกอินบัญชีนี้
- ล้างข้อมูลทั้งหมด: `replaceAll` ด้วยข้อมูลว่าง + หมวดหมู่เริ่มต้น; ข้อความยืนยันบอกว่าลบบนคลาวด์ด้วย

## 9. สถานะซิงก์และข้อผิดพลาด

ไอคอนที่แถบบน:
- **synced** — ไม่มี write ค้าง (`waitForPendingWrites` resolve และ snapshot ไม่มี `hasPendingWrites`)
- **pending** — มี `hasPendingWrites` หรือออฟไลน์ (`navigator.onLine === false`)
- **error** — write ล้มเหลว; กดดูข้อความได้

| กรณี | การทำงาน |
|---|---|
| ออฟไลน์ | ใช้งานปกติ เขียนลง IndexedDB แล้วส่งเองเมื่อมีเน็ต |
| popup ถูกบล็อก | fallback เป็น redirect |
| `permission-denied` | toast + สถานะ error พร้อมข้อความชัดเจน |
| IndexedDB ใช้ไม่ได้ (เช่น private mode) | fallback เป็น memory cache + แจ้งเตือนว่าใช้ออฟไลน์ไม่ได้ |
| แก้รายการเดียวกันจาก 2 เครื่อง | last-write-wins ต่อ document |
| โหลด Firebase SDK ไม่ได้ (ครั้งแรกและออฟไลน์) | ข้อความ "ต้องต่ออินเทอร์เน็ตครั้งแรกเพื่อเข้าสู่ระบบ" |

## 10. Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## 11. การทดสอบ

1. **Unit (Node, `node --test`)** — `store-core.js`: `diffById` (เพิ่ม/แก้/ลบ/ไม่เปลี่ยน), `chunk` (ขอบ 500), `decideMigration` (ทุกแถวของตาราง), `recurringTxnId`
2. **Firebase Emulator Suite** — rules test (เจ้าของอ่าน/เขียนได้, บัญชีอื่นและไม่ล็อกอินถูกปฏิเสธ); store integration (migration, diff write, replaceAll, recurring ไม่ซ้ำเมื่อสองไคลเอนต์สร้างพร้อมกัน)
3. **Regression** — สคริปต์ jsdom เดิม (เพิ่มรายรับ/รายจ่าย ยอดถูก กดทุกเมนู กราฟถูกสร้าง ไม่มี error) รันกับ store ที่ต่อ emulator
4. **ทดสอบจริงบนมือถือ** — เช็กลิสต์ใน `docs/firebase-setup.md`: ล็อกอิน, ปิดแอปเปิดใหม่ไม่ต้องล็อกอิน, ปิดเน็ตเพิ่มรายการแล้วเปิดเน็ต, เปิดดูจากเครื่องที่สอง, เปิดแอปตอนออฟไลน์

## 12. สิ่งที่ผู้ใช้ต้องทำเอง

1. สร้างโปรเจกต์ใน Firebase Console และเพิ่ม Web App
2. เปิด Authentication → Google provider
3. เพิ่ม `saharatyokthuan.github.io` (และ `localhost`) ใน Authorized domains
4. สร้าง Firestore database และวาง `firestore.rules`
5. คัดลอก config ใส่ `js/firebase-config.js`

(รายละเอียดทีละขั้นอยู่ใน `docs/firebase-setup.md`)
