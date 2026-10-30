// store ปลอมใน memory ที่มี API เดียวกับ js/store.js ใช้ทดสอบ UI โดยไม่ต้องต่อ Firebase
export function createFakeStore() {
  const data = { transactions: [], loans: [], debts: [], recurring: [], categories: null };
  const listeners = { auth: [], ready: [], change: [], status: [] };
  const calls = { signIn: 0, signOut: 0, replaceAll: 0 };
  let status = 'synced';
  const copy = v => JSON.parse(JSON.stringify(v));

  return {
    data, calls,
    getTransactions: () => copy(data.transactions),
    getLoans: () => copy(data.loans),
    getDebts: () => copy(data.debts),
    getRecurring: () => copy(data.recurring),
    getCategories: () => (data.categories ? copy(data.categories) : null),
    setTransactions: l => { data.transactions = copy(l); },
    setLoans: l => { data.loans = copy(l); },
    setDebts: l => { data.debts = copy(l); },
    setRecurring: l => { data.recurring = copy(l); },
    setCategories: c => { data.categories = copy(c); },
    replaceAll: async d => {
      calls.replaceAll++;
      for (const k of ['transactions', 'loans', 'debts', 'recurring']) data[k] = copy(d[k] || []);
      data.categories = d.categories ? copy(d.categories) : null;
    },
    onAuth: cb => listeners.auth.push(cb),
    onReady: cb => listeners.ready.push(cb),
    onChange: cb => listeners.change.push(cb),
    onSyncStatus: cb => listeners.status.push(cb),
    getSyncStatus: () => status,
    signIn: async () => { calls.signIn++; },
    signOut: async () => { calls.signOut++; },
    start: async () => {},
    // ตัวช่วยสำหรับเทสต์
    emitAuth: user => listeners.auth.forEach(cb => cb(user)),
    emitReady: () => listeners.ready.forEach(cb => cb()),
    emitChange: () => listeners.change.forEach(cb => cb()),
    setStatus: (s, msg) => { status = s; listeners.status.forEach(cb => cb(s, msg)); }
  };
}
