/* ===================================================================
   บันทึกกระแสเงินสด - script.js
   ไฟล์นี้รวมโลจิกทั้งหมดของแอป: จัดเก็บข้อมูลด้วย localStorage,
   จัดการรายรับ-รายจ่าย, เงินยืม-คืน, หมวดหมู่, หนี้สิน/บัตรเครดิต,
   รายการประจำ (auto-add ทุกเดือน), แดชบอร์ด+กราฟ, และ Import/Export
   =================================================================== */

/* ===================== 1. STORAGE KEYS & DEFAULTS ===================== */

const STORAGE_KEYS = {
  transactions: 'cft_transactions',
  categories: 'cft_categories',
  loans: 'cft_loans',
  debts: 'cft_debts',
  recurring: 'cft_recurring'
};

// หมวดหมู่เริ่มต้น (ใช้ตอนเปิดแอปครั้งแรกเท่านั้น)
const DEFAULT_CATEGORIES = {
  income: ['เงินเดือน', 'โบนัส', 'รายได้พิเศษ', 'ยืม', 'อื่นๆ'],
  expense: ['อาหาร', 'เดินทาง', 'ที่พัก', 'ช้อปปิ้ง', 'สาธารณูปโภค', 'บันเทิง', 'สุขภาพ', 'การศึกษา', 'คืน', 'อื่นๆ']
};

/* ===================== 2. STORAGE HELPERS ===================== */

// อ่านค่าจาก localStorage แล้วแปลงเป็น JSON, ถ้าไม่มีให้คืนค่า default
function loadFromStorage(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error('loadFromStorage error:', key, err);
    return defaultValue;
  }
}

// บันทึกค่าเป็น JSON string ลง localStorage
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('saveToStorage error:', key, err);
    showToast('บันทึกข้อมูลไม่สำเร็จ (พื้นที่จัดเก็บเต็มหรือไม่รองรับ)');
  }
}

function getTransactions() { return loadFromStorage(STORAGE_KEYS.transactions, []); }
function setTransactions(list) { saveToStorage(STORAGE_KEYS.transactions, list); }

function getCategories() { return loadFromStorage(STORAGE_KEYS.categories, null); }
function setCategories(cats) { saveToStorage(STORAGE_KEYS.categories, cats); }

function getLoans() { return loadFromStorage(STORAGE_KEYS.loans, []); }
function setLoans(list) { saveToStorage(STORAGE_KEYS.loans, list); }

function getDebts() { return loadFromStorage(STORAGE_KEYS.debts, []); }
function setDebts(list) { saveToStorage(STORAGE_KEYS.debts, list); }

function getRecurring() { return loadFromStorage(STORAGE_KEYS.recurring, []); }
function setRecurring(list) { saveToStorage(STORAGE_KEYS.recurring, list); }

// สร้างหมวดหมู่เริ่มต้นถ้ายังไม่เคยมีข้อมูลมาก่อน
function ensureDefaultCategories() {
  let cats = getCategories();
  if (!cats) {
    cats = {
      income: DEFAULT_CATEGORIES.income.map(name => ({ id: generateId(), name })),
      expense: DEFAULT_CATEGORIES.expense.map(name => ({ id: generateId(), name })),
      _addedBorrowReturn: true
    };
    setCategories(cats);
    return cats;
  }

  // Migration ครั้งเดียว: เติมหมวดหมู่ "ยืม" (รายรับ) และ "คืน" (รายจ่าย) ให้ผู้ใช้เดิมที่มีข้อมูลอยู่ก่อนแล้ว
  // ใช้ flag _addedBorrowReturn กันไม่ให้เพิ่มซ้ำทุกครั้ง เผื่อผู้ใช้ลบหมวดหมู่นี้ทิ้งเองทีหลัง
  if (!cats._addedBorrowReturn) {
    if (!cats.income.some(c => c.name === 'ยืม')) {
      cats.income.push({ id: generateId(), name: 'ยืม' });
    }
    if (!cats.expense.some(c => c.name === 'คืน')) {
      cats.expense.push({ id: generateId(), name: 'คืน' });
    }
    cats._addedBorrowReturn = true;
    setCategories(cats);
  }

  return cats;
}

/* ===================== 3. UTILITY FUNCTIONS ===================== */

// สร้าง id แบบสุ่ม ใช้แยกแต่ละรายการ
function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// เติมเลข 0 ข้างหน้าให้ครบ 2 หลัก เช่น 5 -> "05"
function pad2(n) {
  return String(n).padStart(2, '0');
}

// คืนค่าจำนวนวันในเดือน (year, monthIndex เริ่มที่ 0)
function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// คืนค่ารูปแบบ "YYYY-MM" จาก Date object
function toMonthKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

// แปลงตัวเลขเป็นรูปแบบสกุลเงินบาท เช่น ฿1,234.00
function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return '฿' + value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// แปลงวันที่ "YYYY-MM-DD" เป็นรูปแบบอ่านง่าย "DD/MM/YYYY"
function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// คืนค่าวันที่วันนี้ในรูปแบบ "YYYY-MM-DD" (ใช้เป็นค่าเริ่มต้นของ input date)
function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// แสดงข้อความแจ้งเตือนแบบ toast ที่มุมล่างของหน้าจอ
let toastTimeoutId = null;
function showToast(message) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2200);
}

// ไอคอนดินสอ (แก้ไข) แบบ SVG string ใช้ซ้ำได้ในทุก list item
function iconEditSvg() {
  return `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>`;
}

// ไอคอนถังขยะ (ลบ) แบบ SVG string ใช้ซ้ำได้ในทุก list item
function iconDeleteSvg() {
  return `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>`;
}

// ไอคอนลูกศรขึ้น (รายรับ)
function iconIncomeSvg() {
  return `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path></svg>`;
}

// ไอคอนลูกศรลง (รายจ่าย)
function iconExpenseSvg() {
  return `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg>`;
}

/* ===================== 4. NAVIGATION (สลับหน้า) ===================== */

// วัดความสูงจริงของ topbar แล้วเซ็ตเป็น CSS variable ให้แถบเมนู (tabbar) เกาะด้านล่างพอดีเสมอ
// แก้บั๊ก: เดิม CSS ใช้เลขตายตัว top: 52px ซึ่งอาจไม่ตรงกับความสูงจริงในบางอุปกรณ์/ขนาดฟอนต์
function setTopbarHeightVar() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  document.documentElement.style.setProperty('--topbar-height', `${topbar.offsetHeight}px`);
}

function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPage = btn.getAttribute('data-page');
      switchPage(targetPage);
    });
  });
}

function switchPage(pageName) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-page') === pageName);
  });
  document.querySelectorAll('.page').forEach(pageEl => {
    pageEl.classList.toggle('active', pageEl.id === `page-${pageName}`);
  });
  // เมื่อเปิดหน้าแดชบอร์ด ต้องวาดกราฟใหม่ทุกครั้ง เพราะ canvas ที่ถูกซ่อนไว้จะไม่มีขนาด
  if (pageName === 'dashboard') {
    renderDashboard();
  }
}

/* ===================== 5. หมวดหมู่ (CATEGORIES) ===================== */

let activeCategoryType = 'income'; // ใช้บอกว่าหน้าหมวดหมู่กำลังดูฝั่งไหนอยู่
let categoryEditId = '';

// เติมตัวเลือกหมวดหมู่ลงใน <select> ตามประเภทที่กำหนด
function populateCategorySelect(selectEl, type) {
  const cats = ensureDefaultCategories();
  const list = cats[type] || [];
  const previousValue = selectEl.value;
  selectEl.innerHTML = '';

  // แก้บั๊ก: ถ้าลบหมวดหมู่ของประเภทนี้จนหมด select จะว่างและทำให้บันทึกรายการไม่ได้
  // ใส่ตัวเลือกหลอก (disabled) ไว้แทน เพื่อกันฟอร์มพังและบอกผู้ใช้ให้ไปเพิ่มหมวดหมู่ก่อน
  if (list.length === 0) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'ยังไม่มีหมวดหมู่ (กรุณาเพิ่มก่อน)';
    emptyOption.disabled = true;
    emptyOption.selected = true;
    selectEl.appendChild(emptyOption);
    return;
  }

  list.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = cat.name;
    selectEl.appendChild(option);
  });
  // ถ้าค่าที่เลือกไว้เดิมยังอยู่ในลิสต์ใหม่ ให้เลือกไว้เหมือนเดิม
  if (list.some(c => c.name === previousValue)) {
    selectEl.value = previousValue;
  }
}

function renderCategoryList() {
  const cats = ensureDefaultCategories();
  const list = cats[activeCategoryType] || [];
  const container = document.getElementById('category-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="list-empty">ยังไม่มีหมวดหมู่ในกลุ่มนี้</div>';
    return;
  }

  list.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-icon ${activeCategoryType === 'income' ? 'income' : 'expense'}">
        ${activeCategoryType === 'income' ? iconIncomeSvg() : iconExpenseSvg()}
      </div>
      <div class="list-item-info">
        <span class="list-item-title">${escapeHtml(cat.name)}</span>
      </div>
      <div class="list-item-actions">
        <button type="button" class="icon-btn edit" data-action="edit-category" data-id="${cat.id}">${iconEditSvg()}</button>
        <button type="button" class="icon-btn delete" data-action="delete-category" data-id="${cat.id}">${iconDeleteSvg()}</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function initCategoryPage() {
  const toggleContainer = document.getElementById('category-type-toggle');
  toggleContainer.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleContainer.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategoryType = btn.getAttribute('data-cat-type');
      resetCategoryForm();
      renderCategoryList();
    });
  });

  const form = document.getElementById('category-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('category-name');
    const name = nameInput.value.trim();
    if (!name) return;

    const cats = ensureDefaultCategories();

    // เช็คชื่อซ้ำในกลุ่มเดียวกันเสมอ ทั้งตอนเพิ่มและตอนแก้ไข (ไม่นับตัวเองตอนแก้ไข)
    // แก้บั๊ก: เดิมตอน "แก้ไข" ไม่มีการเช็คชื่อซ้ำ ทำให้เกิดหมวดหมู่ชื่อซ้ำกันได้
    const isDuplicate = cats[activeCategoryType].some(
      c => c.name === name && c.id !== categoryEditId
    );
    if (isDuplicate) {
      showToast('มีหมวดหมู่ชื่อนี้อยู่แล้ว');
      return;
    }

    if (categoryEditId) {
      // แก้ไขชื่อหมวดหมู่เดิม
      const target = cats[activeCategoryType].find(c => c.id === categoryEditId);
      if (target) target.name = name;
      showToast('แก้ไขหมวดหมู่แล้ว');
    } else {
      // เพิ่มหมวดหมู่ใหม่
      cats[activeCategoryType].push({ id: generateId(), name });
      showToast('เพิ่มหมวดหมู่แล้ว');
    }
    setCategories(cats);
    resetCategoryForm();
    renderCategoryList();
    refreshAllCategorySelects();
  });

  document.getElementById('category-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const cats = ensureDefaultCategories();

    if (action === 'edit-category') {
      const target = cats[activeCategoryType].find(c => c.id === id);
      if (!target) return;
      document.getElementById('category-name').value = target.name;
      categoryEditId = id;
      document.getElementById('category-edit-id').value = id;
      document.getElementById('category-submit-btn').textContent = 'บันทึกการแก้ไข';
    }

    if (action === 'delete-category') {
      if (!confirm('ต้องการลบหมวดหมู่นี้หรือไม่? รายการเก่าที่เคยใช้หมวดหมู่นี้จะยังคงอยู่')) return;
      cats[activeCategoryType] = cats[activeCategoryType].filter(c => c.id !== id);
      setCategories(cats);
      renderCategoryList();
      refreshAllCategorySelects();
      showToast('ลบหมวดหมู่แล้ว');
    }
  });
}

function resetCategoryForm() {
  document.getElementById('category-form').reset();
  document.getElementById('category-edit-id').value = '';
  categoryEditId = '';
  document.getElementById('category-submit-btn').textContent = 'เพิ่มหมวดหมู่';
}

// เรียกใช้ทุกครั้งที่หมวดหมู่เปลี่ยน เพื่อให้ select ในหน้าอื่น ๆ อัปเดตตาม
function refreshAllCategorySelects() {
  const txnType = document.getElementById('txn-type').value;
  populateCategorySelect(document.getElementById('txn-category'), txnType);

  const recurringType = document.getElementById('recurring-type').value;
  populateCategorySelect(document.getElementById('recurring-category'), recurringType);
}

// ป้องกัน HTML injection เวลาแสดงข้อความที่ผู้ใช้พิมพ์เอง
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

/* ===================== 6. หน้าหลัก: รายรับ-รายจ่าย (TRANSACTIONS) ===================== */

let txnEditId = '';

function initTypeToggle(containerId, hiddenInputId, onChange) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-type');
      document.getElementById(hiddenInputId).value = type;
      if (onChange) onChange(type);
    });
  });
}

function initTransactionForm() {
  document.getElementById('txn-date').value = todayDateString();
  populateCategorySelect(document.getElementById('txn-category'), 'income');

  initTypeToggle('txn-type-toggle', 'txn-type', (type) => {
    populateCategorySelect(document.getElementById('txn-category'), type);
  });

  const form = document.getElementById('transaction-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('txn-date').value;
    const type = document.getElementById('txn-type').value;
    const category = document.getElementById('txn-category').value;
    const amount = parseFloat(document.getElementById('txn-amount').value);
    const note = document.getElementById('txn-note').value.trim();

    if (!category) {
      showToast('กรุณาเพิ่มหมวดหมู่ก่อนบันทึกรายการ');
      return;
    }
    if (!date || isNaN(amount) || amount < 0) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const transactions = getTransactions();

    if (txnEditId) {
      const target = transactions.find(t => t.id === txnEditId);
      if (target) {
        target.date = date;
        target.type = type;
        target.category = category;
        target.amount = amount;
        target.note = note;
      }
      showToast('แก้ไขรายการแล้ว');
    } else {
      transactions.push({ id: generateId(), date, type, category, amount, note });
      showToast('เพิ่มรายการแล้ว');
    }

    setTransactions(transactions);
    resetTransactionForm();
    populateMonthFilter('home-month-filter', true);
    renderTransactionList();
  });
}

function resetTransactionForm() {
  document.getElementById('transaction-form').reset();
  document.getElementById('txn-date').value = todayDateString();
  document.getElementById('txn-edit-id').value = '';
  txnEditId = '';
  document.getElementById('txn-submit-btn').innerHTML = `${iconIncomeSvg()} เพิ่มรายการ`;
  // รีเซ็ตปุ่มประเภทกลับเป็นรายรับ
  const toggle = document.getElementById('txn-type-toggle');
  toggle.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  toggle.querySelector('[data-type="income"]').classList.add('active');
  document.getElementById('txn-type').value = 'income';
  populateCategorySelect(document.getElementById('txn-category'), 'income');
}

// เติมตัวเลือกเดือนใน <select> ตัวกรอง โดยรวมเดือนปัจจุบันเสมอ
function populateMonthFilter(selectId, keepSelection) {
  const selectEl = document.getElementById(selectId);
  const previousValue = keepSelection ? selectEl.value : null;
  const transactions = getTransactions();
  const monthSet = new Set(transactions.map(t => t.date ? t.date.slice(0, 7) : null).filter(Boolean));
  monthSet.add(toMonthKey(new Date()));
  const months = Array.from(monthSet).sort().reverse();

  selectEl.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'ทั้งหมด';
  selectEl.appendChild(allOption);

  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = formatMonthLabel(m);
    selectEl.appendChild(opt);
  });

  if (previousValue && (previousValue === 'all' || months.includes(previousValue))) {
    selectEl.value = previousValue;
  } else if (selectId === 'home-month-filter') {
    selectEl.value = toMonthKey(new Date());
  } else {
    selectEl.value = 'all';
  }
}

// แปลง "YYYY-MM" เป็นข้อความอ่านง่าย เช่น "09/2026"
function formatMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
}

function renderTransactionList() {
  const filterValue = document.getElementById('home-month-filter').value || 'all';
  let transactions = getTransactions();

  if (filterValue !== 'all') {
    transactions = transactions.filter(t => t.date && t.date.slice(0, 7) === filterValue);
  }

  // เรียงจากวันที่ล่าสุดไปเก่าสุด
  transactions = transactions.slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  const container = document.getElementById('transaction-list');
  container.innerHTML = '';

  if (transactions.length === 0) {
    container.innerHTML = '<div class="list-empty">ยังไม่มีรายการในช่วงนี้</div>';
  } else {
    transactions.forEach(t => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="list-item-icon ${t.type}">${t.type === 'income' ? iconIncomeSvg() : iconExpenseSvg()}</div>
        <div class="list-item-info">
          <span class="list-item-title">${escapeHtml(t.category)}</span>
          <span class="list-item-sub">${formatDateDisplay(t.date)}${t.note ? ' · ' + escapeHtml(t.note) : ''}</span>
        </div>
        <span class="list-item-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
        <div class="list-item-actions">
          <button type="button" class="icon-btn edit" data-action="edit-txn" data-id="${t.id}">${iconEditSvg()}</button>
          <button type="button" class="icon-btn delete" data-action="delete-txn" data-id="${t.id}">${iconDeleteSvg()}</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  updateHomeSummary(transactions);
}

// คำนวณยอดรวมรายรับ/รายจ่าย/คงเหลือ ของรายการที่กรองไว้ แล้วแสดงบนการ์ดสรุป
function updateHomeSummary(filteredTransactions) {
  let income = 0;
  let expense = 0;
  filteredTransactions.forEach(t => {
    if (t.type === 'income') income += Number(t.amount) || 0;
    else expense += Number(t.amount) || 0;
  });
  document.getElementById('home-income-total').textContent = formatCurrency(income);
  document.getElementById('home-expense-total').textContent = formatCurrency(expense);
  document.getElementById('home-balance-total').textContent = formatCurrency(income - expense);
  updateTopbarBalance();
}

// อัปเดตยอดคงเหลือรวมทั้งหมด (ทุกเดือน) ที่แถบด้านบนสุด
function updateTopbarBalance() {
  const transactions = getTransactions();
  let income = 0;
  let expense = 0;
  transactions.forEach(t => {
    if (t.type === 'income') income += Number(t.amount) || 0;
    else expense += Number(t.amount) || 0;
  });
  document.getElementById('topbar-balance').textContent = formatCurrency(income - expense);
}

function initTransactionListEvents() {
  document.getElementById('home-month-filter').addEventListener('change', renderTransactionList);

  document.getElementById('transaction-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const transactions = getTransactions();

    if (action === 'edit-txn') {
      const target = transactions.find(t => t.id === id);
      if (!target) return;
      document.getElementById('txn-date').value = target.date;
      document.getElementById('txn-amount').value = target.amount;
      document.getElementById('txn-note').value = target.note || '';
      document.getElementById('txn-type').value = target.type;

      const toggle = document.getElementById('txn-type-toggle');
      toggle.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === target.type));
      populateCategorySelect(document.getElementById('txn-category'), target.type);
      document.getElementById('txn-category').value = target.category;

      txnEditId = id;
      document.getElementById('txn-edit-id').value = id;
      document.getElementById('txn-submit-btn').textContent = 'บันทึกการแก้ไข';
      switchPage('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (action === 'delete-txn') {
      if (!confirm('ต้องการลบรายการนี้หรือไม่?')) return;
      setTransactions(transactions.filter(t => t.id !== id));
      populateMonthFilter('home-month-filter', true);
      renderTransactionList();
      showToast('ลบรายการแล้ว');
    }
  });
}

/* ===================== 7. หน้าเงินยืม-คืน (LOANS) ===================== */

let loanEditId = '';

const LOAN_STATUS_LABEL = {
  borrowing: 'ยืมอยู่',
  returned: 'คืนแล้ว',
  partial: 'คืนบางส่วน'
};

function initLoanForm() {
  document.getElementById('loan-date').value = todayDateString();

  const form = document.getElementById('loan-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('loan-name').value.trim();
    const date = document.getElementById('loan-date').value;
    const amount = parseFloat(document.getElementById('loan-amount').value);
    const status = document.getElementById('loan-status').value;
    const note = document.getElementById('loan-note').value.trim();

    if (!name || !date || isNaN(amount)) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const loans = getLoans();
    if (loanEditId) {
      const target = loans.find(l => l.id === loanEditId);
      if (target) Object.assign(target, { name, date, amount, status, note });
      showToast('แก้ไขรายการแล้ว');
    } else {
      loans.push({ id: generateId(), name, date, amount, status, note });
      showToast('เพิ่มรายการแล้ว');
    }
    setLoans(loans);
    resetLoanForm();
    renderLoanList();
  });
}

function resetLoanForm() {
  document.getElementById('loan-form').reset();
  document.getElementById('loan-date').value = todayDateString();
  document.getElementById('loan-edit-id').value = '';
  loanEditId = '';
  document.getElementById('loan-submit-btn').textContent = 'เพิ่มรายการ';
}

function renderLoanList() {
  const loans = getLoans().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const container = document.getElementById('loan-list');
  container.innerHTML = '';

  if (loans.length === 0) {
    container.innerHTML = '<div class="list-empty">ยังไม่มีรายการเงินยืม-คืน</div>';
    return;
  }

  loans.forEach(loan => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-icon neutral">
        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10a2 2 0 0 1 2 2v3H5V9a2 2 0 0 1 2-2Z"></path><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"></path></svg>
      </div>
      <div class="list-item-info">
        <span class="list-item-title">${escapeHtml(loan.name)}</span>
        <span class="list-item-sub">${formatDateDisplay(loan.date)}${loan.note ? ' · ' + escapeHtml(loan.note) : ''}</span>
        <span class="status-badge ${loan.status}">${LOAN_STATUS_LABEL[loan.status] || loan.status}</span>
      </div>
      <span class="list-item-amount">${formatCurrency(loan.amount)}</span>
      <div class="list-item-actions">
        <button type="button" class="icon-btn edit" data-action="edit-loan" data-id="${loan.id}">${iconEditSvg()}</button>
        <button type="button" class="icon-btn delete" data-action="delete-loan" data-id="${loan.id}">${iconDeleteSvg()}</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function initLoanListEvents() {
  document.getElementById('loan-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const loans = getLoans();

    if (action === 'edit-loan') {
      const target = loans.find(l => l.id === id);
      if (!target) return;
      document.getElementById('loan-name').value = target.name;
      document.getElementById('loan-date').value = target.date;
      document.getElementById('loan-amount').value = target.amount;
      document.getElementById('loan-status').value = target.status;
      document.getElementById('loan-note').value = target.note || '';
      loanEditId = id;
      document.getElementById('loan-edit-id').value = id;
      document.getElementById('loan-submit-btn').textContent = 'บันทึกการแก้ไข';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (action === 'delete-loan') {
      if (!confirm('ต้องการลบรายการนี้หรือไม่?')) return;
      setLoans(loans.filter(l => l.id !== id));
      renderLoanList();
      showToast('ลบรายการแล้ว');
    }
  });
}

/* ===================== 8. หน้าหนี้สิน/บัตรเครดิต (DEBTS) ===================== */

let debtEditId = '';

function initDebtForm() {
  const form = document.getElementById('debt-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('debt-name').value.trim();
    const limit = parseFloat(document.getElementById('debt-limit').value);
    const balance = parseFloat(document.getElementById('debt-balance').value);
    const interest = parseFloat(document.getElementById('debt-interest').value) || 0;
    const dueDay = parseInt(document.getElementById('debt-due-day').value, 10) || null;
    const minPayment = parseFloat(document.getElementById('debt-min-payment').value) || 0;

    if (!name || isNaN(limit) || isNaN(balance)) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const debts = getDebts();
    if (debtEditId) {
      const target = debts.find(d => d.id === debtEditId);
      if (target) Object.assign(target, { name, limit, balance, interest, dueDay, minPayment });
      showToast('แก้ไขรายการแล้ว');
    } else {
      debts.push({ id: generateId(), name, limit, balance, interest, dueDay, minPayment });
      showToast('เพิ่มรายการแล้ว');
    }
    setDebts(debts);
    resetDebtForm();
    renderDebtList();
  });
}

function resetDebtForm() {
  document.getElementById('debt-form').reset();
  document.getElementById('debt-edit-id').value = '';
  debtEditId = '';
  document.getElementById('debt-submit-btn').textContent = 'เพิ่มรายการ';
}

// คำนวณสถานะใกล้ครบกำหนด/เลยกำหนดของหนี้สิน โดยเทียบวันครบกำหนดกับวันนี้ (มองแค่รอบเดือนปัจจุบัน)
// คืนค่า null ถ้ายังไม่ใกล้กำหนด หรือไม่มีการตั้งวันครบกำหนดไว้
function getDebtDueStatus(dueDay) {
  if (!dueDay) return null;
  const today = new Date();
  const day = today.getDate();
  const diff = dueDay - day;
  if (diff >= 0 && diff <= 3) return { label: 'ใกล้ครบกำหนด', className: 'soon' };
  if (diff < 0 && diff >= -3) return { label: 'เลยกำหนดชำระ', className: 'overdue' };
  if (diff < 0) {
    // ผ่านวันครบกำหนดของเดือนนี้ไปนานแล้ว: ดูว่ารอบเดือนหน้าใกล้ถึงไหม
    const left = daysInMonth(today.getFullYear(), today.getMonth()) - day + dueDay;
    if (left <= 3) return { label: 'ใกล้ครบกำหนด', className: 'soon' };
  }
  return null;
}

function renderDebtList() {
  const debts = getDebts();
  const container = document.getElementById('debt-list');
  container.innerHTML = '';

  if (debts.length === 0) {
    container.innerHTML = '<div class="list-empty">ยังไม่มีรายการหนี้สิน/บัตรเครดิต</div>';
    return;
  }

  debts.forEach(debt => {
    const ratio = debt.limit > 0 ? Math.min(100, Math.round((debt.balance / debt.limit) * 100)) : 0;
    const dueStatus = getDebtDueStatus(debt.dueDay);
    const item = document.createElement('div');
    item.className = 'list-item';
    item.style.flexWrap = 'wrap';
    item.innerHTML = `
      <div class="list-item-icon neutral">
        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path></svg>
      </div>
      <div class="list-item-info" style="flex-basis: 100%;">
        <span class="list-item-title">${escapeHtml(debt.name)}</span>
        ${dueStatus ? `<span class="due-badge ${dueStatus.className}">${dueStatus.label}</span>` : ''}
        <span class="list-item-sub">
          คงเหลือ ${formatCurrency(debt.balance)} / วงเงิน ${formatCurrency(debt.limit)}
          ${debt.interest ? ' · ดอกเบี้ย ' + debt.interest + '%' : ''}
        </span>
        <span class="list-item-sub">
          ${debt.dueDay ? 'ครบกำหนดวันที่ ' + debt.dueDay + ' ของทุกเดือน' : ''}
          ${debt.minPayment ? ' · ขั้นต่ำ ' + formatCurrency(debt.minPayment) : ''}
        </span>
        <div class="progress-track"><div class="progress-fill" style="width:${ratio}%"></div></div>
      </div>
      <div class="list-item-actions">
        <button type="button" class="icon-btn edit" data-action="edit-debt" data-id="${debt.id}">${iconEditSvg()}</button>
        <button type="button" class="icon-btn delete" data-action="delete-debt" data-id="${debt.id}">${iconDeleteSvg()}</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function initDebtListEvents() {
  document.getElementById('debt-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const debts = getDebts();

    if (action === 'edit-debt') {
      const target = debts.find(d => d.id === id);
      if (!target) return;
      document.getElementById('debt-name').value = target.name;
      document.getElementById('debt-limit').value = target.limit;
      document.getElementById('debt-balance').value = target.balance;
      document.getElementById('debt-interest').value = target.interest || '';
      document.getElementById('debt-due-day').value = target.dueDay || '';
      document.getElementById('debt-min-payment').value = target.minPayment || '';
      debtEditId = id;
      document.getElementById('debt-edit-id').value = id;
      document.getElementById('debt-submit-btn').textContent = 'บันทึกการแก้ไข';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (action === 'delete-debt') {
      if (!confirm('ต้องการลบรายการนี้หรือไม่?')) return;
      setDebts(debts.filter(d => d.id !== id));
      renderDebtList();
      showToast('ลบรายการแล้ว');
    }
  });
}

/* ===================== 9. หน้ารายการประจำ (RECURRING) ===================== */

let recurringEditId = '';

function initRecurringForm() {
  populateCategorySelect(document.getElementById('recurring-category'), 'income');

  initTypeToggle('recurring-type-toggle', 'recurring-type', (type) => {
    populateCategorySelect(document.getElementById('recurring-category'), type);
  });

  const form = document.getElementById('recurring-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('recurring-name').value.trim();
    const type = document.getElementById('recurring-type').value;
    const category = document.getElementById('recurring-category').value;
    const amount = parseFloat(document.getElementById('recurring-amount').value);
    const day = parseInt(document.getElementById('recurring-day').value, 10);
    const note = document.getElementById('recurring-note').value.trim();

    if (!category) {
      showToast('กรุณาเพิ่มหมวดหมู่ก่อนบันทึกรายการประจำ');
      return;
    }
    if (!name || isNaN(amount) || !day || day < 1 || day > 31) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const list = getRecurring();
    if (recurringEditId) {
      const target = list.find(r => r.id === recurringEditId);
      if (target) Object.assign(target, { name, type, category, amount, day, note });
      showToast('แก้ไขรายการแล้ว');
    } else {
      list.push({ id: generateId(), name, type, category, amount, day, note, generatedMonths: [] });
      showToast('เพิ่มรายการประจำแล้ว');
    }
    setRecurring(list);
    resetRecurringForm();
    renderRecurringList();
  });
}

function resetRecurringForm() {
  document.getElementById('recurring-form').reset();
  document.getElementById('recurring-edit-id').value = '';
  recurringEditId = '';
  document.getElementById('recurring-submit-btn').textContent = 'เพิ่มรายการประจำ';
  const toggle = document.getElementById('recurring-type-toggle');
  toggle.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  toggle.querySelector('[data-type="income"]').classList.add('active');
  document.getElementById('recurring-type').value = 'income';
  populateCategorySelect(document.getElementById('recurring-category'), 'income');
}

function renderRecurringList() {
  const list = getRecurring();
  const container = document.getElementById('recurring-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="list-empty">ยังไม่มีรายการประจำ</div>';
    return;
  }

  list.forEach(r => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-icon ${r.type}">${r.type === 'income' ? iconIncomeSvg() : iconExpenseSvg()}</div>
      <div class="list-item-info">
        <span class="list-item-title">${escapeHtml(r.name)}</span>
        <span class="list-item-sub">${escapeHtml(r.category)} · ทุกวันที่ ${r.day} ของเดือน</span>
      </div>
      <span class="list-item-amount ${r.type}">${r.type === 'income' ? '+' : '-'}${formatCurrency(r.amount)}</span>
      <div class="list-item-actions">
        <button type="button" class="icon-btn edit" data-action="edit-recurring" data-id="${r.id}">${iconEditSvg()}</button>
        <button type="button" class="icon-btn delete" data-action="delete-recurring" data-id="${r.id}">${iconDeleteSvg()}</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function initRecurringListEvents() {
  document.getElementById('recurring-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const list = getRecurring();

    if (action === 'edit-recurring') {
      const target = list.find(r => r.id === id);
      if (!target) return;
      document.getElementById('recurring-name').value = target.name;
      document.getElementById('recurring-amount').value = target.amount;
      document.getElementById('recurring-day').value = target.day;
      document.getElementById('recurring-note').value = target.note || '';
      document.getElementById('recurring-type').value = target.type;
      const toggle = document.getElementById('recurring-type-toggle');
      toggle.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === target.type));
      populateCategorySelect(document.getElementById('recurring-category'), target.type);
      document.getElementById('recurring-category').value = target.category;
      recurringEditId = id;
      document.getElementById('recurring-edit-id').value = id;
      document.getElementById('recurring-submit-btn').textContent = 'บันทึกการแก้ไข';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (action === 'delete-recurring') {
      if (!confirm('ต้องการลบรายการประจำนี้หรือไม่? (จะไม่ลบรายการที่เคยสร้างไปแล้วในหน้าหลัก)')) return;
      setRecurring(list.filter(r => r.id !== id));
      renderRecurringList();
      showToast('ลบรายการประจำแล้ว');
    }
  });
}

// ตรวจสอบและเพิ่มรายการประจำเข้าหน้าหลักอัตโนมัติ ถ้าถึงวันที่กำหนดแล้วยังไม่เคยเพิ่มในเดือนนั้น
function checkAndGenerateRecurring() {
  const recurringList = getRecurring();
  if (recurringList.length === 0) return;

  const transactions = getTransactions();
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  let dataChanged = false;

  recurringList.forEach(item => {
    if (!Array.isArray(item.generatedMonths)) item.generatedMonths = [];

    let cursor;
    if (item.generatedMonths.length > 0) {
      const lastYm = item.generatedMonths[item.generatedMonths.length - 1];
      const [ly, lm] = lastYm.split('-').map(Number);
      cursor = new Date(ly, lm, 1); // เดือนถัดจากเดือนล่าสุดที่เคยสร้าง
    } else {
      // ยังไม่เคยสร้างมาก่อน เริ่มตรวจจากเดือนปัจจุบันเท่านั้น (ไม่ย้อนหลังไปก่อนวันที่เพิ่มรายการนี้)
      cursor = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), 1);
    }

    let safetyCounter = 0;
    while (cursor <= currentMonthStart && safetyCounter < 36) {
      safetyCounter++;
      const ym = toMonthKey(cursor);
      const isCurrentMonth = ym === toMonthKey(today);
      const isDuePassed = isCurrentMonth ? today.getDate() >= item.day : true;

      if (!item.generatedMonths.includes(ym) && isDuePassed) {
        const dayForMonth = Math.min(item.day, daysInMonth(cursor.getFullYear(), cursor.getMonth()));
        const dateStr = `${ym}-${pad2(dayForMonth)}`;
        transactions.push({
          id: generateId(),
          date: dateStr,
          type: item.type,
          category: item.category,
          amount: item.amount,
          note: item.note ? `[ประจำ] ${item.note}` : `[ประจำ] ${item.name}`
        });
        item.generatedMonths.push(ym);
        dataChanged = true;
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  });

  if (dataChanged) {
    setTransactions(transactions);
    setRecurring(recurringList);
    showToast('เพิ่มรายการประจำของเดือนนี้ให้อัตโนมัติแล้ว');
  }
}

/* ===================== 10. หน้าแดชบอร์ด (DASHBOARD) ===================== */

let categoryPieChart = null;
let incomeExpenseBarChart = null;
let balanceLineChart = null;

function initDashboardFilter() {
  document.getElementById('dashboard-filter').addEventListener('change', renderDashboard);
}

function renderDashboard() {
  populateMonthFilter('dashboard-filter', true);

  const filterValue = document.getElementById('dashboard-filter').value || 'all';
  let transactions = getTransactions();
  if (filterValue !== 'all') {
    transactions = transactions.filter(t => t.date && t.date.slice(0, 7) === filterValue);
  }

  let income = 0;
  let expense = 0;
  transactions.forEach(t => {
    if (t.type === 'income') income += Number(t.amount) || 0;
    else expense += Number(t.amount) || 0;
  });
  document.getElementById('dash-income-total').textContent = formatCurrency(income);
  document.getElementById('dash-expense-total').textContent = formatCurrency(expense);
  document.getElementById('dash-balance-total').textContent = formatCurrency(income - expense);

  renderCategoryPieChart(transactions);
  renderIncomeExpenseBarChart();
  renderBalanceLineChart();
}

// กราฟวงกลม: สัดส่วนรายจ่ายแยกตามหมวดหมู่ (ของช่วงเวลาที่เลือก)
function renderCategoryPieChart(transactions) {
  const canvas = document.getElementById('chart-category-pie');
  if (typeof Chart === 'undefined') return;

  const expenseByCategory = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + Number(t.amount);
  });

  const labels = Object.keys(expenseByCategory);
  const data = Object.values(expenseByCategory);

  if (categoryPieChart) categoryPieChart.destroy();

  if (labels.length === 0) {
    return;
  }

  categoryPieChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: generateChartColors(labels.length)
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
    }
  });
}

// กราฟแท่ง: เปรียบเทียบรายรับ-รายจ่ายของแต่ละเดือน (ย้อนหลัง 6 เดือนล่าสุด)
function renderIncomeExpenseBarChart() {
  const canvas = document.getElementById('chart-income-expense-bar');
  if (typeof Chart === 'undefined') return;

  const allTransactions = getTransactions();
  const months = getLastNMonths(6);

  const incomeData = months.map(ym => sumByMonthAndType(allTransactions, ym, 'income'));
  const expenseData = months.map(ym => sumByMonthAndType(allTransactions, ym, 'expense'));

  if (incomeExpenseBarChart) incomeExpenseBarChart.destroy();

  incomeExpenseBarChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(formatMonthLabel),
      datasets: [
        { label: 'รายรับ', data: incomeData, backgroundColor: cssVar('--color-income') },
        { label: 'รายจ่าย', data: expenseData, backgroundColor: cssVar('--color-expense') }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// กราฟเส้น: แนวโน้มเงินสะสม (คงเหลือสุทธิสะสม) ย้อนหลัง 6 เดือนล่าสุด
function renderBalanceLineChart() {
  const canvas = document.getElementById('chart-balance-line');
  if (typeof Chart === 'undefined') return;

  const allTransactions = getTransactions();
  const months = getLastNMonths(6);

  let running = 0;
  const balanceData = months.map(ym => {
    const income = sumByMonthAndType(allTransactions, ym, 'income');
    const expense = sumByMonthAndType(allTransactions, ym, 'expense');
    running += (income - expense);
    return running;
  });

  if (balanceLineChart) balanceLineChart.destroy();

  balanceLineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: months.map(formatMonthLabel),
      datasets: [{
        label: 'เงินสะสม',
        data: balanceData,
        borderColor: cssVar('--accent'),
        backgroundColor: cssVar('--accent') + '22',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

// คืนค่ารายการเดือนย้อนหลัง n เดือน (รวมเดือนปัจจุบัน) เรียงจากเก่าไปใหม่ เช่น ["2026-05", ..., "2026-09"]
function getLastNMonths(n) {
  const result = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    result.push(toMonthKey(d));
  }
  return result;
}

function sumByMonthAndType(transactions, ym, type) {
  return transactions
    .filter(t => t.date && t.date.slice(0, 7) === ym && t.type === type)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

// สร้างชุดสีสำหรับกราฟวงกลมให้พอกับจำนวนหมวดหมู่
function generateChartColors(count) {
  const palette = [cssVar('--accent'), cssVar('--accent2'), '#00ff88', '#ff4466', '#ffcc00', '#00aaff', '#ff8800', '#aa66ff', '#66ffcc', '#ff66aa'];
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(palette[i % palette.length]);
  }
  return colors;
}

/* ===================== 11. หน้าตั้งค่า: Import / Export / ล้างข้อมูล ===================== */

function initSettingsPage() {
  document.getElementById('export-json-btn').addEventListener('click', exportAsJson);
  document.getElementById('export-xlsx-btn').addEventListener('click', exportAsXlsx);
  document.getElementById('import-json-file').addEventListener('change', handleImportJson);
  document.getElementById('import-xlsx-file').addEventListener('change', handleImportXlsx);
  document.getElementById('clear-data-btn').addEventListener('click', handleClearData);
}

// รวบรวมข้อมูลทั้งหมดในแอปเป็น object เดียว ใช้ทั้งตอน export json และ xlsx
function collectAllData() {
  return {
    transactions: getTransactions(),
    categories: ensureDefaultCategories(),
    loans: getLoans(),
    debts: getDebts(),
    recurring: getRecurring()
  };
}

function exportAsJson() {
  const data = collectAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `cashflow-backup-${todayDateString()}.json`);
  showToast('ส่งออกไฟล์ .json แล้ว');
}

function exportAsXlsx() {
  if (typeof XLSX === 'undefined') {
    showToast('ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
    return;
  }
  const data = collectAllData();
  const wb = XLSX.utils.book_new();

  const txnSheet = XLSX.utils.json_to_sheet(data.transactions);
  XLSX.utils.book_append_sheet(wb, txnSheet, 'Transactions');

  const loanSheet = XLSX.utils.json_to_sheet(data.loans);
  XLSX.utils.book_append_sheet(wb, loanSheet, 'Loans');

  const debtSheet = XLSX.utils.json_to_sheet(data.debts);
  XLSX.utils.book_append_sheet(wb, debtSheet, 'Debts');

  const recurringSheet = XLSX.utils.json_to_sheet(data.recurring);
  XLSX.utils.book_append_sheet(wb, recurringSheet, 'Recurring');

  const categoryRows = [
    ...data.categories.income.map(c => ({ type: 'income', name: c.name })),
    ...data.categories.expense.map(c => ({ type: 'expense', name: c.name }))
  ];
  const categorySheet = XLSX.utils.json_to_sheet(categoryRows);
  XLSX.utils.book_append_sheet(wb, categorySheet, 'Categories');

  XLSX.writeFile(wb, `cashflow-backup-${todayDateString()}.xlsx`);
  showToast('ส่งออกไฟล์ .xlsx แล้ว');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImportJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!confirm('การนำเข้าจะแทนที่ข้อมูลปัจจุบันทั้งหมด ต้องการดำเนินการต่อหรือไม่?')) { e.target.value = ''; return; }

      if (Array.isArray(data.transactions)) setTransactions(data.transactions);
      if (data.categories) setCategories(data.categories);
      if (Array.isArray(data.loans)) setLoans(data.loans);
      if (Array.isArray(data.debts)) setDebts(data.debts);
      if (Array.isArray(data.recurring)) setRecurring(data.recurring);

      refreshEverything();
      showToast('นำเข้าข้อมูล .json สำเร็จ');
    } catch (err) {
      console.error(err);
      showToast('ไฟล์ .json ไม่ถูกต้อง');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function handleImportXlsx(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    showToast('ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      if (!confirm('การนำเข้าจะแทนที่ข้อมูลปัจจุบันทั้งหมด ต้องการดำเนินการต่อหรือไม่?')) { e.target.value = ''; return; }

      if (workbook.Sheets['Transactions']) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Transactions']);
        setTransactions(rows.map(r => ({
          id: r.id || generateId(),
          date: r.date,
          type: r.type,
          category: r.category,
          amount: Number(r.amount) || 0,
          note: r.note || ''
        })));
      }

      if (workbook.Sheets['Loans']) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Loans']);
        setLoans(rows.map(r => ({
          id: r.id || generateId(),
          name: r.name,
          date: r.date,
          amount: Number(r.amount) || 0,
          status: r.status || 'borrowing',
          note: r.note || ''
        })));
      }

      if (workbook.Sheets['Debts']) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Debts']);
        setDebts(rows.map(r => ({
          id: r.id || generateId(),
          name: r.name,
          limit: Number(r.limit) || 0,
          balance: Number(r.balance) || 0,
          interest: Number(r.interest) || 0,
          dueDay: r.dueDay ? Number(r.dueDay) : null,
          minPayment: Number(r.minPayment) || 0
        })));
      }

      if (workbook.Sheets['Recurring']) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Recurring']);
        setRecurring(rows.map(r => ({
          id: r.id || generateId(),
          name: r.name,
          type: r.type,
          category: r.category,
          amount: Number(r.amount) || 0,
          day: Number(r.day) || 1,
          note: r.note || '',
          // กันสร้างรายการประจำของเดือนนี้ซ้ำหลังนำเข้า
          generatedMonths: (Number(r.day) || 1) <= new Date().getDate() ? [toMonthKey(new Date())] : []
        })));
      }

      if (workbook.Sheets['Categories']) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Categories']);
        const newCats = { income: [], expense: [] };
        rows.forEach(r => {
          if (r.type === 'income' || r.type === 'expense') {
            newCats[r.type].push({ id: generateId(), name: r.name });
          }
        });
        if (newCats.income.length || newCats.expense.length) setCategories(newCats);
      }

      refreshEverything();
      showToast('นำเข้าข้อมูล .xlsx สำเร็จ');
    } catch (err) {
      console.error(err);
      showToast('ไฟล์ .xlsx ไม่ถูกต้อง');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

function handleClearData() {
  if (!confirm('ต้องการล้างข้อมูลทั้งหมดในเครื่องนี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  ensureDefaultCategories();
  refreshEverything();
  showToast('ล้างข้อมูลทั้งหมดแล้ว');
}

// เรียกใช้หลังจาก import/clear ข้อมูล เพื่อให้ทุกหน้าแสดงผลใหม่ให้ตรงกับข้อมูลล่าสุด
function refreshEverything() {
  refreshAllCategorySelects();
  renderCategoryList();
  populateMonthFilter('home-month-filter', false);
  renderTransactionList();
  renderLoanList();
  renderDebtList();
  renderRecurringList();
  renderDashboard();
  updateTopbarBalance();
}

/* ===================== 12. INITIALIZATION ===================== */

document.addEventListener('DOMContentLoaded', () => {
  ensureDefaultCategories();

  setTopbarHeightVar();
  window.addEventListener('resize', setTopbarHeightVar);
  window.addEventListener('load', setTopbarHeightVar);

  initNavigation();
  initCategoryPage();
  initTransactionForm();
  initTransactionListEvents();
  initLoanForm();
  initLoanListEvents();
  initDebtForm();
  initDebtListEvents();
  initRecurringForm();
  initRecurringListEvents();
  initDashboardFilter();
  initSettingsPage();

  // ตรวจสอบและเพิ่มรายการประจำของเดือนนี้ ก่อนแสดงผลรายการทั้งหมด
  checkAndGenerateRecurring();

  populateMonthFilter('home-month-filter', false);
  renderCategoryList();
  renderTransactionList();
  renderLoanList();
  renderDebtList();
  renderRecurringList();
  updateTopbarBalance();
});

/* ===================== 13. NEON CYBER HUB: เอฟเฟกต์และธีมสี ===================== */

// อ่านค่าตัวแปรสีจาก CSS (ใช้กับกราฟให้เปลี่ยนตามธีม)
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

(function neonFx() {
  const root = document.documentElement;

  // สีตัวอักษร/เส้นกริดของ Chart.js ให้เข้ากับพื้นหลังมืด
  if (window.Chart) {
    Chart.defaults.color = '#7a8ba8';
    Chart.defaults.borderColor = 'rgba(0,255,255,.12)';
  }

  // --- อนุภาคพื้นหลัง (หยุดเมื่อสลับแอป เพื่อประหยัดแบตมือถือ) ---
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  const COUNT = window.innerWidth < 600 ? 35 : 70;
  let particles = [], rafId = null;
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2 + 1
    });
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const accent = cssVar('--accent');
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = accent; ctx.globalAlpha = 0.6; ctx.fill();
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j], dx = p.x - q.x, dy = p.y - q.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = accent; ctx.globalAlpha = (1 - d / 120) * 0.15; ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(draw);
  }
  draw();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId); else draw();
  });

  // --- แสงตามเมาส์/นิ้ว ---
  const glow = document.getElementById('mouseGlow');
  const moveGlow = (x, y) => { glow.style.left = x + 'px'; glow.style.top = y + 'px'; };
  document.addEventListener('mousemove', e => moveGlow(e.clientX, e.clientY));
  document.addEventListener('touchmove', e => moveGlow(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

  // --- แถบความคืบหน้าตอนเลื่อน ---
  const bar = document.getElementById('scrollProgress');
  window.addEventListener('scroll', () => {
    const max = root.scrollHeight - root.clientHeight;
    bar.style.width = (max > 0 ? root.scrollTop / max * 100 : 0) + '%';
  });

  // --- ripple บนปุ่ม (ผูกที่ document รองรับปุ่มที่สร้างทีหลัง) ---
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-primary, .btn-secondary, .btn-danger, .nav-btn, .type-btn');
    if (!btn) return;
    const r = btn.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = s + 'px';
    span.style.left = (e.clientX - r.left - s / 2) + 'px';
    span.style.top = (e.clientY - r.top - s / 2) + 'px';
    btn.appendChild(span);
    setTimeout(() => span.remove(), 600);
  });

  // --- ธีมสี 3 โทน (จำค่าไว้ในเครื่อง) ---
  const themes = {
    cyan: { a: '#00ffff', b: '#ff00ff' },
    green: { a: '#00ff88', b: '#00aaff' },
    orange: { a: '#ff8800', b: '#ff0066' }
  };
  const dots = document.querySelectorAll('.theme-dot');
  function setTheme(key, redraw) {
    root.style.setProperty('--accent', themes[key].a);
    root.style.setProperty('--accent2', themes[key].b);
    dots.forEach(d => d.classList.toggle('active', d.dataset.c === key));
    try { localStorage.setItem('cft_theme', key); } catch (e) {}
    if (redraw) renderDashboard(); // วาดกราฟใหม่ให้สีตรงธีม
  }
  dots.forEach(d => d.addEventListener('click', () => setTheme(d.dataset.c, true)));
  let saved = null;
  try { saved = localStorage.getItem('cft_theme'); } catch (e) {}
  if (saved && themes[saved]) setTheme(saved, false);
})();
