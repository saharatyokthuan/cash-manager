/* ===================================================================
   store-core.js - ฟังก์ชันบริสุทธิ์ของส่วนเก็บข้อมูล (ไม่พึ่ง Firebase/DOM)
   แยกออกมาเพื่อให้ทดสอบด้วย Node ได้ตรง ๆ
   =================================================================== */

// ชนิดข้อมูลที่เก็บเป็น 1 รายการ = 1 document (หมวดหมู่เก็บแยกใน meta/categories)
export const COLLECTIONS = ['transactions', 'loans', 'debts', 'recurring'];

// แปลงเป็น JSON โดยเรียง key เสมอ (Firestore คืนฟิลด์เรียงตามตัวอักษร ไม่ตรงกับลำดับเดิมของแอป)
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .filter(k => value[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

// เทียบรายการเก่ากับใหม่ด้วย id แล้วคืนเฉพาะสิ่งที่ต้องเขียนจริง
export function diffById(oldList, newList) {
  const oldMap = new Map(oldList.map(item => [item.id, stableStringify(item)]));
  const newIds = new Set(newList.map(item => item.id));
  const upserts = newList.filter(item => oldMap.get(item.id) !== stableStringify(item));
  const deletes = [...oldMap.keys()].filter(id => !newIds.has(id));
  return { upserts, deletes };
}

// แบ่ง array เป็นชุด ๆ (writeBatch ของ Firestore รับได้ไม่เกิน 500 operations)
export function chunk(arr, size = 500) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ตัดสินใจว่าจะย้ายข้อมูลเก่าจาก localStorage อย่างไรตอนล็อกอิน
// - คลาวด์ว่าง + เครื่องมีข้อมูล: อัปโหลด (แม้เคยตั้ง flag ไว้ เพราะคลาวด์ว่างแปลว่ายังไม่ขึ้นจริง)
// - คลาวด์มีข้อมูล + เครื่องมีข้อมูลที่ยังไม่เคยจัดการ: ถามผู้ใช้
export function decideMigration({ cloudHasData, localHasData, alreadyHandled }) {
  if (!localHasData) return 'none';
  if (!cloudHasData) return 'upload';
  return alreadyHandled ? 'none' : 'ask';
}

// id ของรายการที่สร้างจากรายการประจำ: กำหนดได้ เพื่อให้หลายเครื่องสร้างซ้ำแล้วได้ document เดียวกัน
export function recurringTxnId(recurringId, ym) {
  return `rec_${recurringId}_${ym}`;
}

// แปลง document จาก Firestore กลับเป็นรูปแบบเดิมของแอป
export function stripDoc(id, data) {
  const { updatedAt, ...rest } = data;
  return { id, ...rest };
}
