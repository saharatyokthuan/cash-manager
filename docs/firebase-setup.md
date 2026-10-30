# ตั้งค่า Firebase สำหรับบันทึกกระแสเงินสด

ทำครั้งเดียว ใช้เวลาประมาณ 10 นาที ทำบนมือถือผ่านเบราว์เซอร์ได้ (แนะนำให้เปิด "เวอร์ชันเดสก์ท็อป")

## 1. สร้างโปรเจกต์

1. เปิด <https://console.firebase.google.com> แล้วล็อกอินด้วยบัญชี Google
2. กด **Add project / เพิ่มโปรเจกต์** ตั้งชื่อ เช่น `cash-manager`
3. Google Analytics: **ปิด** ได้ (ไม่จำเป็น) → **Create project**

## 2. เพิ่ม Web App และคัดลอก config

1. ในหน้าโปรเจกต์ กดไอคอน **`</>`** (Web)
2. ตั้งชื่อแอป เช่น `cash-manager-web` (ไม่ต้องติ๊ก Firebase Hosting) → **Register app**
3. จะเห็นโค้ด `const firebaseConfig = { ... }` ให้คัดลอกค่า `apiKey`, `authDomain`, `projectId`, `appId`
4. เปิดไฟล์ `js/firebase-config.js` แล้วแทนที่ค่า `REPLACE_ME` ทั้งหมด เช่น

```js
export const firebaseConfig = {
  apiKey: 'AIzaSy...',
  authDomain: 'cash-manager-xxxx.firebaseapp.com',
  projectId: 'cash-manager-xxxx',
  appId: '1:1234567890:web:abcdef'
};
```

> ค่าเหล่านี้ใส่ไว้ในเว็บได้ ไม่ใช่รหัสลับ ความปลอดภัยของข้อมูลมาจาก Security Rules ในข้อ 5

## 3. เปิดล็อกอินด้วย Google

1. เมนูซ้าย **Build → Authentication** → **Get started**
2. แท็บ **Sign-in method** → เลือก **Google** → เปิด **Enable** → เลือกอีเมลสำหรับติดต่อ → **Save**

## 4. อนุญาตโดเมนของเว็บ

1. **Authentication → Settings → Authorized domains**
2. กด **Add domain** แล้วเพิ่ม `saharatyokthuan.github.io`
3. (`localhost` มีให้อยู่แล้ว ใช้ทดสอบผ่าน Termux ได้)

## 5. สร้างฐานข้อมูล Firestore และวางกฎความปลอดภัย

1. เมนูซ้าย **Build → Firestore Database** → **Create database**
2. Location: เลือก **asia-southeast1 (Singapore)** (เปลี่ยนภายหลังไม่ได้)
3. เลือก **Start in production mode** → **Create**
4. แท็บ **Rules** ลบของเดิมทั้งหมด แล้ววางเนื้อหาจากไฟล์ `firestore.rules` ใน repo นี้ → **Publish**

## 6. เปิดเว็บด้วย GitHub Pages

1. push โค้ดขึ้น GitHub (รวม `js/firebase-config.js` ที่แก้แล้ว)
2. repository → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / root → **Save**
3. รอ 1–2 นาที แล้วเปิด `https://saharatyokthuan.github.io/cash-manager/`

> ต้องเปิดผ่าน `https://` หรือ `http://localhost` เท่านั้น การเปิดไฟล์ `index.html` ตรง ๆ (`file://`) จะล็อกอินไม่ได้

## เช็กลิสต์ทดสอบบนมือถือ

- [ ] เปิดเว็บ → เห็นหน้า "เข้าสู่ระบบด้วย Google" → ล็อกอินสำเร็จ
- [ ] ถ้าเคยมีข้อมูลเดิมในเบราว์เซอร์นี้ → รายการเดิมขึ้นครบหลังล็อกอิน
- [ ] ปิดแท็บแล้วเปิดใหม่ → เข้าแอปได้เลยโดยไม่ต้องล็อกอินซ้ำ
- [ ] เปิดโหมดเครื่องบิน → เปิดแอป → แอปเปิดได้ → เพิ่มรายการ 1 รายการ → ไอคอนเมฆเป็น "รอส่ง"
- [ ] ปิดโหมดเครื่องบิน → ไอคอนเมฆเปลี่ยนเป็น "ซิงก์แล้ว"
- [ ] เปิดเว็บจากคอมหรือเครื่องอื่น ล็อกอินบัญชีเดียวกัน → เห็นรายการที่เพิ่มจากมือถือ
- [ ] ใน Firebase Console → Firestore → Data → เห็น `users/<uid>/transactions/...`

## สำหรับนักพัฒนา: รันเทสต์

```bash
npm install
npm test            # unit + UI tests (ไม่ต้องต่อเน็ต)
npm run test:emu    # Security Rules + store กับ Firebase Emulator (ต้องมี Java 11+)
```
