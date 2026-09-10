# สรุป Class และ ID

- Class และ ID ที่ใช้ในโปรเจกต์ My CashFlow


## ID (ใช้ครั้งเดียวในหน้าเว็บ)

+ Layout / Navigation

|ID| ใช้กับ| หน้าที่|
|:---:|:---:|:---:|
|pageTitle |<h1>|แสดงชื่อหน้าปัจจุบัน|
|themeToggle| <button>|ปุ่มสลับธีมมืด/สว่าง|

## หน้าหลัก (home)

|ID| ใช้กับ| หน้าที่|
|:---:|:---:|:---:|
|homeStats |<div>| แสดงการ์ดสรุป 4 ใบ|
|transactionForm |<form> |ฟอร์มบันทึกรายการ|
transactionFormTitle |<h2>| หัวข้อฟอร์ม (บันทึก/แก้ไข)|
txDate |<input date>| วันที่|
txName |<input>| ชื่อรายการ|
txAmount |<input number>| จำนวนเงิน|
txType |<select>| รายรับ/รายจ่าย|
txCategory |<select>| หมวดหมู่|
txAccount |<input>| บัญชี|
txPayment |<select>| วิธีชำระ|
txNote |<textarea>| หมายเหตุ|
cancelTxEdit |<button>| ยกเลิกแก้ไข|
recentTransactions |<div>| รายการล่าสุด 7 รายการ|

📌 หน้ารายการ (transactions)

ID ใช้กับ หน้าที่
txSearch |<input>| ช่องค้นหา
txFilterType |<select>| กรองประเภทรายรับ/รายจ่าย
txFilterYear |<select>| กรองปี
txFilterMonth |<input month>| กรองเดือน
txSort |<select>| เรียงลำดับ
viewAll |<button>| ดูทั้งหมด
viewMonth |<button>| ดูรายเดือน
transactionTable |<div>| แสดงตารางรายการ

📌 หน้าหมวดหมู่ (categories)

ID ใช้กับ หน้าที่
incomeCategories |<div>| รายการหมวดหมู่รายรับ
expenseCategories |<div>| รายการหมวดหมู่รายจ่าย
categoryForm |<form>| ฟอร์มเพิ่มหมวดหมู่
categoryName |<input>| ชื่อหมวดหมู่
categoryType |<select>| ประเภท

📌 หน้าเงินยืม (loans)

ID ใช้กับ หน้าที่
loanForm |<form>| ฟอร์ม
loanFormTitle |<h2>| หัวข้อฟอร์ม
loanKind |<select>| ประเภท (ยืม/ให้ยืม)
loanPerson |<input>| ชื่อบุคคล
loanPrincipal |<input number>| เงินต้น
loanRate |<input number>| ดอกเบี้ย
loanInterest |<select>| รูปแบบดอกเบี้ย
loanTerms |<input number>| จำนวนงวด
loanStart / loanDue |<input date>| วันที่เริ่ม/ครบกำหนด
loanFrequency |<select>| ความถี่ชำระ
loanCustomWrap |<div>| กล่องกำหนดเอง
loanCustomDays |<input number>| ทุกกี่วัน
loanNote |<textarea>| หมายเหตุ
cancelLoanEdit |<button>| ยกเลิกแก้ไข
loanList |<div>| รายการเงินยืม

📌 หน้าสินเชื่อ (credits)

ID ใช้กับ
creditForm, creditFormTitle ฟอร์ม + หัวข้อ
creditProvider, creditName ผู้ให้บริการ, ชื่อสินเชื่อ
creditPrincipal, creditBalance วงเงิน, ยอดคงเหลือ
creditRate, creditInterest ดอกเบี้ย, รูปแบบ
creditInstallment, creditFrequency ยอดต่องวด, ความถี่
creditCustomWrap, creditCustomDays กล่องกำหนดเอง
creditStart, creditDue, creditNote วันที่ + หมายเหตุ
cancelCreditEdit, creditList ยกเลิก, รายการ

📌 หน้าสรุป (summary)

ID ใช้กับ
summaryYear |<select>| เลือกปี
summaryStats |<div>| การ์ดสรุป 4 ใบ
monthlyChart |<div>| กราฟแท่งรายเดือน
categoryChart |<div>| กราฟหมวดหมู่

📌 หน้าตั้งค่า (settings)

ID ใช้กับ
themeLight, themeDark ปุ่มสลับธีม
gotoCategories ปุ่มไปหน้าหมวดหมู่
exportBtn ปุ่มดาวน์โหลด JSON
importFile |<input file>| นำเข้า
clearAllBtn ปุ่มล้างข้อมูล

📌 Modal

ID ใช้กับ
modalBackdrop พื้นหลังมืด
modalTitle, modalBody หัวข้อ, เนื้อหา
modalCancel, modalConfirm ปุ่มยกเลิก/ยืนยัน

📌 ID ที่สร้างแบบไดนามิก (ใน JS)

ID ใช้กับ
paymentDate |<input date>| ใน modal ชำระเงิน
paymentAmount |<input number>|
paymentNote |<input>|

---

🎨 Class

📌 Layout

Class ลักษณะ หน้าที่
.layout display:grid โครงหลัก 260px + 1fr
.sidebar glass + sticky แถบเมนูด้านซ้าย
.main flex column พื้นที่หลัก
.topbar sticky แถบหัวเรื่อง
.content padding พื้นที่เนื้อหา
.brand / .logo flex โลโก้
.nav flex column กลุ่มปุ่มเมนู

📌 หน้า/แสดงผล

Class หน้าที่
.page ซ่อนไว้ (display:none)
.page.active แสดงเมื่อ active + animation fade
.hidden display:none!important
.muted สีเทา
.right ชิดขวา

📌 Grid

Class คอลัมน์
.grid ฐาน (gap 18px)
.grid-2 2 คอลัมน์
.grid-3 3 คอลัมน์
.grid-4 4 คอลัมน์

📌 Card

Class หน้าที่
.card การ์ดพื้นฐาน (border + shadow)
.stat การ์ดสรุป แนวนอน + radial glow
.income / .expense / .warning สีตามความหมาย

📌 Form

Class หน้าที่
.form-grid grid 2 คอลัมน์
.field label + input (column)
.field.full กว้างเต็มแถว
.actions กลุ่มปุ่ม

📌 Button

Class หน้าที่
.btn ปุ่มพื้นฐาน (น้ำเงิน)
.btn.secondary ปุ่มรอง (โปร่ง)
.btn.danger ปุ่มแดง
.btn.success ปุ่มเขียว
.btn.small ปุ่มขนาดเล็ก

📌 Toolbar / Segment

Class หน้าที่
.toolbar แถบ filter ด้านบนตาราง
.segment กลุ่มปุ่มสลับ (view all/month)
.segment button.active ปุ่มที่เลือกอยู่

📌 Table

Class หน้าที่
.table-wrap กล่องมี border + scroll
.month-title แถบหัวข้อเดือน + gradient
.badge ป้ายสถานะกลม
.badge.income / .expense / .neutral สีตามสถานะ

📌 อื่น ๆ

Class หน้าที่
.empty กล่อง "ไม่มีข้อมูล" (เส้นประ)
.category-list / .category-item รายการหมวดหมู่แบบ pill
.icon-btn ปุ่มไอคอน (ปุ่ม ✕ ลบ)
.record-card การ์ด record (เงินยืม/สินเชื่อ)
.record-head / .record-meta หัวข้อ record
.progress / .progress span แถบความคืบหน้า
.payment-list / .payment-row ประวัติการชำระ
.chart / .bar-group / .bar กราฟแท่ง
.bar.in / .bar.out แท่งรายรับ/รายจ่าย
.bar-label ชื่อเดือนใต้แท่ง
.legend / .dot คำอธิบายกราฟ
.category-bar / .category-track แถบหมวดหมู่
.modal-backdrop / .modal Modal
.modal-body / .modal-actions ส่วนเนื้อหา/ปุ่มใน modal
.theme-button ปุ่มธีมมุมขวาบน

📌 Class ที่ JS ใส่แบบไดนามิก

Class ใส่ที่ไหน
.active .page, .nav button, .segment button
.hidden ซ่อนฟอร์มแก้ไข / custom wrap
.income / .expense / .neutral badge และ strong
.open #modalBackdrop เมื่อเปิด modal

---

📐 หลักการตั้งชื่อที่ใช้

· ID → ใช้กับ element ที่มี ชิ้นเดียว และ JS ต้องเข้าถึง ($("txDate"))
· Class → ใช้กับ element ที่ มีหลายชิ้น หรือ แชร์สไตล์ (.card, .btn)
· data-page → ใช้ระบุปลายทางของ nav (data-page="home")
· prefix → tx* = transaction, loan* = เงินยืม, credit* = สินเชื่อ, modal* = modal

---

ถ้าต้องการให้ผม จัดตารางเป็นไฟล์ Markdown หรือ generate เป็น comment ไว้ใน CSS/JS ก็บอกได้เลยครับ 📄