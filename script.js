const STORAGE_KEY="cashflow_v1";
const defaultData={
transactions:[],loans:[],credits:[],
categories:{
income:[{id:"inc_salary",name:"เงินเดือน"},{id:"inc_bonus",name:"โบนัส"},{id:"inc_business",name:"ธุรกิจ"},{id:"inc_investment",name:"การลงทุน"},{id:"inc_other",name:"รายรับอื่น ๆ"}],
expense:[{id:"exp_food",name:"อาหาร"},{id:"exp_travel",name:"เดินทาง"},{id:"exp_home",name:"ที่อยู่อาศัย"},{id:"exp_bill",name:"ค่าสาธารณูปโภค"},{id:"exp_health",name:"สุขภาพ"},{id:"exp_education",name:"การศึกษา"},{id:"exp_entertain",name:"ความบันเทิง"},{id:"exp_other",name:"รายจ่ายอื่น ๆ"}]
},settings:{theme:"light"}};
let data=loadData();
let txEditId=null,loanEditId=null,creditEditId=null,transactionView="all";
const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const money=n=>new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",minimumFractionDigits:2}).format(Number(n)||0);
const dateTH=d=>d?new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"}):"-";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function loadData(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));return saved?{...structuredClone(defaultData),...saved,categories:{...defaultData.categories,...saved.categories},settings:{...defaultData.settings,...saved.settings}}:structuredClone(defaultData)}catch{return structuredClone(defaultData)}}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function showModal(title,body,onConfirm,{danger=false,confirmText="ยืนยัน"}={}){
$("modalTitle").textContent=title;$("modalBody").innerHTML=body;$("modalConfirm").textContent=confirmText;
$("modalConfirm").className="btn"+(danger?" danger":"");$("modalBackdrop").classList.add("open");
$("modalConfirm").onclick=()=>{const result=onConfirm?.();if(result!==false)$("modalBackdrop").classList.remove("open")};
}
$("modalCancel").onclick=()=>$("modalBackdrop").classList.remove("open");
$("modalBackdrop").onclick=e=>{if(e.target===$("modalBackdrop"))$("modalBackdrop").classList.remove("open")};
function confirmAction(title,message,fn,danger=false){showModal(title,`<p>${esc(message)}</p>`,fn,{danger})}
const pageNames={home:"หน้าหลัก",transactions:"รายการทั้งหมด",categories:"หมวดหมู่",loans:"เงินยืม / ให้ยืม",credits:"สินเชื่อ",summary:"สรุป",settings:"ตั้งค่า"};
function showPage(page){
document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===page));
document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
$("pageTitle").textContent=pageNames[page];window.scrollTo({top:0,behavior:"smooth"});renderAll();
}
document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function setTheme(theme){data.settings.theme=theme;document.documentElement.dataset.theme=theme;$("themeToggle").textContent=theme==="dark"?"☀️":"🌙";saveData()}
$("themeToggle").onclick=()=>setTheme(data.settings.theme==="dark"?"light":"dark");
function categoryName(id){return [...data.categories.income,...data.categories.expense].find(c=>c.id===id)?.name||"ไม่พบหมวดหมู่"}
function renderCategoryOptions(){
const type=$("txType").value;
$("txCategory").innerHTML=data.categories[type].map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
$("txType").onchange=renderCategoryOptions;
function totals(list=data.transactions){
return list.reduce((a,t)=>{a[t.type]+=Number(t.amount);return a},{income:0,expense:0});
}
function renderHome(){
const all=totals(),month=today().slice(0,7),monthly=totals(data.transactions.filter(t=>t.date.startsWith(month)));
$("homeStats").innerHTML=`
<div class="card stat"><small>ยอดคงเหลือทั้งหมด</small><strong class="${all.income-all.expense>=0?"income":"expense"}">${money(all.income-all.expense)}</strong></div>
<div class="card stat"><small>รายรับทั้งหมด</small><strong class="income">${money(all.income)}</strong></div>
<div class="card stat"><small>รายจ่ายทั้งหมด</small><strong class="expense">${money(all.expense)}</strong></div>
<div class="card stat"><small>คงเหลือเดือนนี้</small><strong class="${monthly.income-monthly.expense>=0?"income":"expense"}">${money(monthly.income-monthly.expense)}</strong></div>`;
const rows=[...data.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
$("recentTransactions").innerHTML=rows.length?rows.map(t=>`<div class="payment-row"><span>${esc(t.name)}<br><small class="muted">${dateTH(t.date)} · ${esc(categoryName(t.category))}</small></span><strong class="${t.type}">${t.type==="income"?"+":"-"}${money(t.amount)}</strong></div>`).join(""):`<div class="empty">ยังไม่มีรายการ</div>`;
}
$("transactionForm").onsubmit=e=>{
e.preventDefault();const item={id:txEditId||uid(),date:$("txDate").value,name:$("txName").value.trim(),amount:Number($("txAmount").value),type:$("txType").value,category:$("txCategory").value,account:$("txAccount").value.trim(),payment:$("txPayment").value,note:$("txNote").value.trim(),updatedAt:new Date().toISOString()};
if(!item.date||!item.name||item.amount<=0)return;
confirmAction(txEditId?"ยืนยันการแก้ไข":"ยืนยันการบันทึก",`${txEditId?"แก้ไข":"บันทึก"}รายการ “${item.name}” จำนวน ${money(item.amount)} หรือไม่?`,()=>{
if(txEditId){const i=data.transactions.findIndex(t=>t.id===txEditId);data.transactions[i]=item}else data.transactions.push(item);
saveData();resetTransactionForm();renderAll();showPage("transactions");
});
};
function resetTransactionForm(){
txEditId=null;$("transactionForm").reset();$("txDate").value=today();$("transactionFormTitle").textContent="บันทึกรายการ";$("cancelTxEdit").classList.add("hidden");renderCategoryOptions();
}
$("cancelTxEdit").onclick=resetTransactionForm;
function editTransaction(id){
confirmAction("ยืนยันการแก้ไข","ต้องการเปิดรายการนี้เพื่อแก้ไขหรือไม่?",()=>{
const t=data.transactions.find(x=>x.id===id);if(!t)return;txEditId=id;showPage("home");
$("txDate").value=t.date;$("txName").value=t.name;$("txAmount").value=t.amount;$("txType").value=t.type;renderCategoryOptions();$("txCategory").value=t.category;$("txAccount").value=t.account||"";$("txPayment").value=t.payment||"เงินสด";$("txNote").value=t.note||"";$("transactionFormTitle").textContent="แก้ไขรายการ";$("cancelTxEdit").classList.remove("hidden");$("transactionForm").scrollIntoView({behavior:"smooth"});
});
}
function deleteTransaction(id){confirmAction("ยืนยันการลบ","ต้องการลบรายการนี้อย่างถาวรหรือไม่?",()=>{data.transactions=data.transactions.filter(t=>t.id!==id);saveData();renderAll()},true)}
function updateYears(){
const years=[...new Set(data.transactions.map(t=>t.date.slice(0,4)))].sort().reverse(),current=new Date().getFullYear().toString();
$("txFilterYear").innerHTML=`<option value="">ทุกปี</option>`+years.map(y=>`<option value="${y}">${Number(y)+543}</option>`).join("");
const summaryYears=years.length?years:[current],old=$("summaryYear").value;
$("summaryYear").innerHTML=summaryYears.map(y=>`<option value="${y}">${Number(y)+543}</option>`).join("");
$("summaryYear").value=summaryYears.includes(old)?old:(summaryYears.includes(current)?current:summaryYears[0]);
}
function renderTransactions(){
let list=[...data.transactions],q=$("txSearch").value.toLowerCase(),type=$("txFilterType").value,year=$("txFilterYear").value,month=$("txFilterMonth").value,sort=$("txSort").value;
if(q)list=list.filter(t=>[t.name,categoryName(t.category),t.account,t.note,t.payment].some(v=>String(v||"").toLowerCase().includes(q)));
if(type)list=list.filter(t=>t.type===type);
if(year)list=list.filter(t=>t.date.startsWith(year));
if(transactionView==="month"&&month)list=list.filter(t=>t.date.startsWith(month));
list.sort((a,b)=>sort==="old"?a.date.localeCompare(b.date):sort==="high"?b.amount-a.amount:sort==="low"?a.amount-b.amount:b.date.localeCompare(a.date));
if(!list.length){$("transactionTable").innerHTML=`<div class="empty">ไม่พบรายการ</div>`;return}
const groups={};list.forEach(t=>{const key=t.date.slice(0,7);(groups[key]??=[]).push(t)});
$("transactionTable").innerHTML=Object.entries(groups).map(([month,items])=>{
const label=new Date(month+"-01T00:00:00").toLocaleDateString("th-TH",{month:"long",year:"numeric"}),sum=totals(items);
return `<div class="month-title">${label} · รายรับ ${money(sum.income)} · รายจ่าย ${money(sum.expense)}</div><div class="table-wrap"><table><thead><tr><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>หมวดหมู่</th><th>บัญชี / วิธีชำระ</th><th class="right">จำนวน</th><th></th></tr></thead><tbody>${items.map(t=>`<tr><td>${dateTH(t.date)}</td><td><strong>${esc(t.name)}</strong><br><small class="muted">${esc(t.note||"")}</small></td><td><span class="badge ${t.type}">${t.type==="income"?"รายรับ":"รายจ่าย"}</span></td><td>${esc(categoryName(t.category))}</td><td>${esc(t.account||"-")}<br><small class="muted">${esc(t.payment||"-")}</small></td><td class="right ${t.type}"><strong>${t.type==="income"?"+":"-"}${money(t.amount)}</strong></td><td><div class="actions"><button class="btn secondary small" onclick="editTransaction('${t.id}')">แก้ไข</button><button class="btn danger small" onclick="deleteTransaction('${t.id}')">ลบ</button></div></td></tr>`).join("")}</tbody></table></div>`;
}).join("");
}
["txSearch","txFilterType","txFilterYear","txFilterMonth","txSort"].forEach(id=>$(id).addEventListener("input",renderTransactions));
$("viewAll").onclick=()=>{transactionView="all";$("viewAll").classList.add("active");$("viewMonth").classList.remove("active");renderTransactions()};
$("viewMonth").onclick=()=>{transactionView="month";$("viewMonth").classList.add("active");$("viewAll").classList.remove("active");if(!$("txFilterMonth").value)$("txFilterMonth").value=today().slice(0,7);renderTransactions()};
function renderCategories(){
["income","expense"].forEach(type=>{$(type+"Categories").innerHTML=data.categories[type].map(c=>`<span class="category-item">${esc(c.name)}<button class="icon-btn" onclick="deleteCategory('${type}','${c.id}')" title="ลบ">✕</button></span>`).join("")||`<span class="muted">ยังไม่มีหมวดหมู่</span>`});renderCategoryOptions();
}
$("categoryForm").onsubmit=e=>{
e.preventDefault();const name=$("categoryName").value.trim(),type=$("categoryType").value;if(!name)return;
if(data.categories[type].some(c=>c.name.toLowerCase()===name.toLowerCase()))return showModal("ไม่สามารถเพิ่มได้","<p>มีชื่อหมวดหมู่นี้อยู่แล้ว</p>",()=>{});
confirmAction("ยืนยันการบันทึก",`ต้องการเพิ่มหมวดหมู่ “${name}” หรือไม่?`,()=>{data.categories[type].push({id:uid(),name});saveData();$("categoryForm").reset();renderAll()});
};
function deleteCategory(type,id){
if(data.transactions.some(t=>t.category===id))return showModal("ไม่สามารถลบได้","<p>หมวดหมู่นี้ถูกใช้งานในรายการอยู่ กรุณาแก้ไขรายการก่อน</p>",()=>{});
confirmAction("ยืนยันการลบ","ต้องการลบหมวดหมู่นี้หรือไม่?",()=>{data.categories[type]=data.categories[type].filter(c=>c.id!==id);saveData();renderAll()},true);
}
function frequencyLabel(v,days){return v==="weekly"?"รายสัปดาห์":v==="monthly"?"รายเดือน":`ทุก ${days} วัน`}
function loanTotal(l){
const p=Number(l.principal),rate=Number(l.rate)/100,n=Number(l.terms)||1,perYear=l.frequency==="weekly"?52:l.frequency==="monthly"?12:365/(Number(l.customDays)||30);
if(!rate)return p;
if(l.interest==="flat"){const years=n/perYear;return p+(p*rate*years)}
const r=rate/perYear;return (p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1))*n;
}
$("loanFrequency").onchange=()=>$("loanCustomWrap").classList.toggle("hidden",$("loanFrequency").value!=="custom");
$("loanForm").onsubmit=e=>{
e.preventDefault();const item={id:loanEditId||uid(),kind:$("loanKind").value,person:$("loanPerson").value.trim(),principal:Number($("loanPrincipal").value),rate:Number($("loanRate").value)||0,interest:$("loanInterest").value,terms:Number($("loanTerms").value),start:$("loanStart").value,due:$("loanDue").value,frequency:$("loanFrequency").value,customDays:Number($("loanCustomDays").value)||30,note:$("loanNote").value.trim(),payments:loanEditId?(data.loans.find(l=>l.id===loanEditId)?.payments||[]):[]};
if(!item.person||!item.principal||!item.start||!item.due)return;
confirmAction(loanEditId?"ยืนยันการแก้ไข":"ยืนยันการบันทึก",`${loanEditId?"แก้ไข":"บันทึก"}ข้อมูล ${item.kind==="borrow"?"เงินที่ยืมมา":"เงินที่ให้ยืม"} จำนวน ${money(item.principal)} หรือไม่?`,()=>{
if(loanEditId)data.loans[data.loans.findIndex(l=>l.id===loanEditId)]=item;else data.loans.push(item);saveData();resetLoanForm();renderAll();
});
};
function resetLoanForm(){loanEditId=null;$("loanForm").reset();$("loanStart").value=today();$("loanDue").value=today();$("loanFormTitle").textContent="บันทึกเงินยืม / ให้ยืม";$("cancelLoanEdit").classList.add("hidden");$("loanCustomWrap").classList.add("hidden")}
$("cancelLoanEdit").onclick=resetLoanForm;
function editLoan(id){confirmAction("ยืนยันการแก้ไข","ต้องการเปิดข้อมูลนี้เพื่อแก้ไขหรือไม่?",()=>{const l=data.loans.find(x=>x.id===id);loanEditId=id;Object.entries({loanKind:l.kind,loanPerson:l.person,loanPrincipal:l.principal,loanRate:l.rate,loanInterest:l.interest,loanTerms:l.terms,loanStart:l.start,loanDue:l.due,loanFrequency:l.frequency,loanCustomDays:l.customDays,loanNote:l.note}).forEach(([id,v])=>$(id).value=v??"");$("loanCustomWrap").classList.toggle("hidden",l.frequency!=="custom");$("loanFormTitle").textContent="แก้ไขเงินยืม / ให้ยืม";$("cancelLoanEdit").classList.remove("hidden");$("loanForm").scrollIntoView({behavior:"smooth"})})}
function deleteLoan(id){confirmAction("ยืนยันการลบ","ต้องการลบข้อมูลและประวัติการชำระทั้งหมดหรือไม่?",()=>{data.loans=data.loans.filter(l=>l.id!==id);saveData();renderAll()},true)}
function addPayment(kind,id){
showModal("บันทึกการชำระ",`<div class="field"><label>วันที่</label><input type="date" id="paymentDate" value="${today()}"></div><div class="field" style="margin-top:12px"><label>จำนวนเงิน</label><input type="number" id="paymentAmount" min="0.01" step="0.01"></div><div class="field" style="margin-top:12px"><label>หมายเหตุ</label><input id="paymentNote"></div>`,()=>{
const payment={id:uid(),date:$("paymentDate").value,amount:Number($("paymentAmount").value),note:$("paymentNote").value.trim()};if(!payment.date||payment.amount<=0)return false;
$("modalBackdrop").classList.remove("open");confirmAction("ยืนยันการบันทึก",`บันทึกยอดชำระ ${money(payment.amount)} หรือไม่?`,()=>{
const list=kind==="loan"?data.loans:data.credits,item=list.find(x=>x.id===id);item.payments??=[];item.payments.push(payment);if(kind==="credit")item.balance=Math.max(0,Number(item.balance)-payment.amount);saveData();renderAll();
});return false;
},{confirmText:"บันทึก"});
}
function renderLoans(){
$("loanList").innerHTML=data.loans.length?data.loans.map(l=>{const total=loanTotal(l),paid=(l.payments||[]).reduce((s,p)=>s+Number(p.amount),0),remaining=Math.max(0,total-paid),percent=Math.min(100,paid/total*100);
return `<div class="record-card"><div class="record-head"><div><h4>${esc(l.person)}</h4><div class="record-meta">${l.kind==="borrow"?"เงินที่ยืมมา":"เงินที่ให้ยืม"} · ${l.interest==="flat"?"ดอกเบี้ยคงที่":"ลดต้นลดดอก"} · ${frequencyLabel(l.frequency,l.customDays)}</div></div><span class="badge ${remaining<=0?"income":"neutral"}">${remaining<=0?"ชำระครบ":"กำลังดำเนินการ"}</span></div><div class="progress"><span style="width:${percent}%"></span></div><div class="payment-row"><span>ยอดประมาณการ</span><strong>${money(total)}</strong></div><div class="payment-row"><span>ชำระแล้ว</span><strong class="income">${money(paid)}</strong></div><div class="payment-row"><span>คงเหลือ</span><strong class="expense">${money(remaining)}</strong></div><div class="record-meta">ครบกำหนด ${dateTH(l.due)} · ${l.terms} งวด · ดอกเบี้ย ${l.rate}% ต่อปี</div>${renderPayments(l.payments)}<div class="actions" style="margin-top:12px"><button class="btn success small" onclick="addPayment('loan','${l.id}')">บันทึกชำระ</button><button class="btn secondary small" onclick="editLoan('${l.id}')">แก้ไข</button><button class="btn danger small" onclick="deleteLoan('${l.id}')">ลบ</button></div></div>`}).join(""):`<div class="empty">ยังไม่มีข้อมูลเงินยืม</div>`;
}
function renderPayments(payments=[]){return payments.length?`<div class="payment-list"><strong>ประวัติชำระ</strong>${[...payments].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<div class="payment-row"><span>${dateTH(p.date)} ${esc(p.note||"")}</span><strong>${money(p.amount)}</strong></div>`).join("")}</div>`:""}
$("creditFrequency").onchange=()=>$("creditCustomWrap").classList.toggle("hidden",$("creditFrequency").value!=="custom");
$("creditForm").onsubmit=e=>{
e.preventDefault();const item={id:creditEditId||uid(),provider:$("creditProvider").value.trim(),name:$("creditName").value.trim(),principal:Number($("creditPrincipal").value),balance:Number($("creditBalance").value),rate:Number($("creditRate").value)||0,interest:$("creditInterest").value,installment:Number($("creditInstallment").value)||0,frequency:$("creditFrequency").value,customDays:Number($("creditCustomDays").value)||30,start:$("creditStart").value,due:$("creditDue").value,note:$("creditNote").value.trim(),payments:creditEditId?(data.credits.find(c=>c.id===creditEditId)?.payments||[]):[]};
if(!item.provider||!item.name||!item.principal||!item.start||!item.due)return;
confirmAction(creditEditId?"ยืนยันการแก้ไข":"ยืนยันการบันทึก",`${creditEditId?"แก้ไข":"บันทึก"}สินเชื่อ “${item.name}” หรือไม่?`,()=>{if(creditEditId)data.credits[data.credits.findIndex(c=>c.id===creditEditId)]=item;else data.credits.push(item);saveData();resetCreditForm();renderAll()});
};
function resetCreditForm(){creditEditId=null;$("creditForm").reset();$("creditStart").value=today();$("creditDue").value=today();$("creditFormTitle").textContent="บันทึกสินเชื่อ";$("cancelCreditEdit").classList.add("hidden");$("creditCustomWrap").classList.add("hidden")}
$("cancelCreditEdit").onclick=resetCreditForm;
function editCredit(id){confirmAction("ยืนยันการแก้ไข","ต้องการเปิดสินเชื่อนี้เพื่อแก้ไขหรือไม่?",()=>{const c=data.credits.find(x=>x.id===id);creditEditId=id;Object.entries({creditProvider:c.provider,creditName:c.name,creditPrincipal:c.principal,creditBalance:c.balance,creditRate:c.rate,creditInterest:c.interest,creditInstallment:c.installment,creditFrequency:c.frequency,creditCustomDays:c.customDays,creditStart:c.start,creditDue:c.due,creditNote:c.note}).forEach(([id,v])=>$(id).value=v??"");$("creditCustomWrap").classList.toggle("hidden",c.frequency!=="custom");$("creditFormTitle").textContent="แก้ไขสินเชื่อ";$("cancelCreditEdit").classList.remove("hidden");$("creditForm").scrollIntoView({behavior:"smooth"})})}
function deleteCredit(id){confirmAction("ยืนยันการลบ","ต้องการลบสินเชื่อและประวัติการชำระทั้งหมดหรือไม่?",()=>{data.credits=data.credits.filter(c=>c.id!==id);saveData();renderAll()},true)}
function renderCredits(){
$("creditList").innerHTML=data.credits.length?data.credits.map(c=>{const progress=Math.min(100,Math.max(0,(c.principal-c.balance)/c.principal*100));
return `<div class="record-card"><div class="record-head"><div><h4>${esc(c.name)}</h4><div class="record-meta">${esc(c.provider)} · ${c.interest==="flat"?"ดอกเบี้ยคงที่":"ลดต้นลดดอก"}</div></div><span class="badge ${c.balance<=0?"income":"neutral"}">${c.balance<=0?"ชำระครบ":"กำลังผ่อน"}</span></div><div class="progress"><span style="width:${progress}%"></span></div><div class="payment-row"><span>วงเงินเริ่มต้น</span><strong>${money(c.principal)}</strong></div><div class="payment-row"><span>ยอดคงเหลือ</span><strong class="expense">${money(c.balance)}</strong></div><div class="payment-row"><span>ยอดต่องวด</span><strong>${money(c.installment)}</strong></div><div class="record-meta">ดอกเบี้ย ${c.rate}% ต่อปี · ${frequencyLabel(c.frequency,c.customDays)} · ครบกำหนด ${dateTH(c.due)}</div>${renderPayments(c.payments)}<div class="actions" style="margin-top:12px"><button class="btn success small" onclick="addPayment('credit','${c.id}')">บันทึกชำระ</button><button class="btn secondary small" onclick="editCredit('${c.id}')">แก้ไข</button><button class="btn danger small" onclick="deleteCredit('${c.id}')">ลบ</button></div></div>`}).join(""):`<div class="empty">ยังไม่มีข้อมูลสินเชื่อ</div>`;
}
$("summaryYear").onchange=renderSummary;
function renderSummary(){
const year=$("summaryYear").value||new Date().getFullYear().toString(),list=data.transactions.filter(t=>t.date.startsWith(year)),sum=totals(list),net=sum.income-sum.expense,saving=sum.income?net/sum.income*100:0;
$("summaryStats").innerHTML=`<div class="card stat"><small>รายรับปีนี้</small><strong class="income">${money(sum.income)}</strong></div><div class="card stat"><small>รายจ่ายปีนี้</small><strong class="expense">${money(sum.expense)}</strong></div><div class="card stat"><small>กระแสเงินสดสุทธิ</small><strong class="${net>=0?"income":"expense"}">${money(net)}</strong></div><div class="card stat"><small>อัตราเงินเหลือ</small><strong class="${saving>=0?"income":"expense"}">${saving.toFixed(1)}%</strong></div>`;
const months=Array.from({length:12},(_,i)=>totals(list.filter(t=>Number(t.date.slice(5,7))===i+1))),max=Math.max(1,...months.flatMap(m=>[m.income,m.expense]));
$("monthlyChart").innerHTML=months.map((m,i)=>`<div class="bar-group"><span class="bar in" title="${money(m.income)}" style="height:${m.income/max*100}%"></span><span class="bar out" title="${money(m.expense)}" style="height:${m.expense/max*100}%"></span><span class="bar-label">${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][i]}</span></div>`).join("");
const cats={};list.filter(t=>t.type==="expense").forEach(t=>cats[categoryName(t.category)]=(cats[categoryName(t.category)]||0)+Number(t.amount));const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]),catMax=Math.max(1,...entries.map(x=>x[1]));
$("categoryChart").innerHTML=entries.length?entries.map(([name,value])=>`<div class="category-bar"><span>${esc(name)}</span><div class="category-track"><span style="width:${value/catMax*100}%"></span></div><strong class="right">${money(value)}</strong></div>`).join(""):`<div class="empty">ยังไม่มีรายจ่ายในปีนี้</div>`;
}
function exportData(){
const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`cashflow-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
}
$("importFile").onchange=e=>{
const file=e.target.files[0];if(!file)return;const reader=new FileReader();
reader.onload=()=>{try{const imported=JSON.parse(reader.result);confirmAction("ยืนยันการนำเข้า","ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์ ต้องการดำเนินการหรือไม่?",()=>{data={...structuredClone(defaultData),...imported};saveData();setTheme(data.settings?.theme||"light");renderAll()})}catch{showModal("ไฟล์ไม่ถูกต้อง","<p>ไม่สามารถอ่านข้อมูลจากไฟล์นี้ได้</p>",()=>{})}finally{e.target.value=""}};
reader.readAsText(file);
};
function clearAllData(){confirmAction("ยืนยันการล้างข้อมูล","ต้องการลบรายการ หมวดหมู่ เงินยืม สินเชื่อ และการตั้งค่าทั้งหมดหรือไม่?",()=>{data=structuredClone(defaultData);saveData();setTheme("light");resetTransactionForm();resetLoanForm();resetCreditForm();renderAll();showPage("home")},true)}
function renderAll(){updateYears();renderHome();renderCategories();renderTransactions();renderLoans();renderCredits();renderSummary()}
$("txDate").value=today();$("loanStart").value=today();$("loanDue").value=today();$("creditStart").value=today();$("creditDue").value=today();$("txFilterMonth").value=today().slice(0,7);setTheme(data.settings.theme||"light");renderCategoryOptions();renderAll();
