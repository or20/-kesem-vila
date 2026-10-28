const STORE_KEY="villa_manager_v1";
const defaultData={bookings:[],expenses:[],ops:{}};
let data=load();
let calendarCursor=new Date();
let deferredInstall=null;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const money=n=>"₪"+Number(n||0).toLocaleString("he-IL");
const iso=d=>{const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`};
const todayIso=()=>iso(new Date());
const parseDate=s=>new Date(s+"T12:00:00");
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const nights=(a,b)=>Math.max(0,Math.round((parseDate(b)-parseDate(a))/86400000));
const fmtDate=s=>parseDate(s).toLocaleDateString("he-IL",{day:"2-digit",month:"2-digit",year:"2-digit"});
const fmtShort=s=>parseDate(s).toLocaleDateString("he-IL",{day:"2-digit",month:"2-digit"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function load(){try{return JSON.parse(localStorage.getItem(STORE_KEY))||structuredClone(defaultData)}catch(e){return structuredClone(defaultData)}}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(data));renderAll()}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
function statusText(s){return {pending:"ממתין",deposit:"מקדמה",paid:"שולם",blocked:"חסום",cancelled:"בוטל"}[s]||s}
function bookingBalance(b){return Math.max(0,Number(b.totalPrice||0)-Number(b.paidAmount||0))}
function activeBooking(b){return b.status!=="cancelled"}
function currentMonthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function overlapsMonth(b,key){if(!activeBooking(b))return false; const [y,m]=key.split("-").map(Number);const start=new Date(y,m-1,1,12);const end=new Date(y,m,1,12);return parseDate(b.checkIn)<end&&parseDate(b.checkOut)>start}
function overlapsDate(b,date){if(!activeBooking(b))return false;const d=parseDate(date);return parseDate(b.checkIn)<=d&&d<parseDate(b.checkOut)}
function conflictFor(start,end,ignoreId=""){return data.bookings.filter(b=>b.id!==ignoreId&&activeBooking(b)&&parseDate(start)<parseDate(b.checkOut)&&parseDate(end)>parseDate(b.checkIn))}
function monthExpenseTotal(key){return data.expenses.filter(e=>e.date.startsWith(key)).reduce((s,e)=>s+Number(e.amount||0),0)}
function monthRevenue(key){return data.bookings.filter(b=>overlapsMonth(b,key)&&b.status!=="blocked").reduce((s,b)=>s+Number(b.paidAmount||0),0)}

function bookingRow(b,compact=false){
  const bal=bookingBalance(b), n=nights(b.checkIn,b.checkOut);
  const phone=(b.guestPhone||"").replace(/\D/g,"");
  const wa=phone?`<a class="mini-btn whatsapp" target="_blank" href="https://wa.me/${phone.startsWith("0")?"972"+phone.slice(1):phone}">WhatsApp</a>`:"";
  return `<div class="row">
    <div class="row-main">
      <div class="row-title">${esc(b.guestName||"ללא שם")} <span class="badge ${b.status}">${statusText(b.status)}</span></div>
      <div class="row-sub">${fmtDate(b.checkIn)} ← ${fmtDate(b.checkOut)} · ${n} לילות · ${esc(b.guestCount||"")} אורחים${b.source?` · ${esc(b.source)}`:""}</div>
      ${!compact&&b.notes?`<div class="row-sub">${esc(b.notes)}</div>`:""}
    </div>
    <div class="row-side">
      <div class="amount">${money(b.totalPrice)}</div>
      ${bal?`<div class="pill-money">יתרה ${money(bal)}</div>`:`<div class="row-sub">אין יתרה</div>`}
      <div class="row-actions">${wa}<button class="mini-btn" onclick="editBooking('${b.id}')">פתח</button></div>
    </div>
  </div>`;
}

function renderDashboard(){
  const t=todayIso(), key=currentMonthKey();
  $("#todayTitle").textContent=new Date().toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"});
  const monthBookings=data.bookings.filter(b=>overlapsMonth(b,key)&&activeBooking(b)&&b.status!=="blocked");
  $("#kpiBookings").textContent=monthBookings.length;
  $("#kpiRevenue").textContent=money(monthRevenue(key));
  const outstanding=data.bookings.filter(activeBooking).reduce((s,b)=>s+bookingBalance(b),0);
  $("#kpiOutstanding").textContent=money(outstanding);
  $("#kpiProfit").textContent=money(monthRevenue(key)-monthExpenseTotal(key)-monthBookings.reduce((s,b)=>s+Number(b.channelFee||0),0));

  const arr=data.bookings.filter(b=>activeBooking(b)&&b.checkIn===t);
  const dep=data.bookings.filter(b=>activeBooking(b)&&b.checkOut===t);
  $("#arrivalsToday").innerHTML=arr.length?arr.map(b=>bookingRow(b,true)).join(""):"אין כניסות היום";
  $("#departuresToday").innerHTML=dep.length?dep.map(b=>bookingRow(b,true)).join(""):"אין יציאות היום";

  const end=addDays(new Date(),7);
  const up=data.bookings.filter(b=>activeBooking(b)&&parseDate(b.checkIn)>=parseDate(t)&&parseDate(b.checkIn)<=end).sort((a,b)=>a.checkIn.localeCompare(b.checkIn));
  $("#upcoming").innerHTML=up.length?up.map(b=>bookingRow(b,true)).join(""):"אין הזמנות קרובות";

  const attention=[];
  data.bookings.filter(b=>activeBooking(b)&&b.status!=="blocked"&&bookingBalance(b)>0&&parseDate(b.checkIn)>=parseDate(t)&&parseDate(b.checkIn)<=addDays(new Date(),5))
    .forEach(b=>attention.push(`<div class="row"><div><div class="row-title">יתרה לפני הגעה — ${esc(b.guestName)}</div><div class="row-sub">${fmtDate(b.checkIn)}</div></div><div class="amount">${money(bookingBalance(b))}</div></div>`));
  data.bookings.filter(b=>activeBooking(b)&&b.damageDeposit>0&&b.checkOut<t&&!data.ops[`deposit-${b.id}`])
    .forEach(b=>attention.push(`<div class="row"><div><div class="row-title">בדוק החזרת פיקדון — ${esc(b.guestName)}</div><div class="row-sub">יצא ב-${fmtDate(b.checkOut)}</div></div><div class="amount">${money(b.damageDeposit)}</div></div>`));
  $("#attention").innerHTML=attention.length?attention.join(""):"הכול מסודר";
}

function renderBookings(){
  const q=$("#bookingSearch").value.trim().toLowerCase(), f=$("#bookingFilter").value, t=todayIso();
  let list=[...data.bookings].sort((a,b)=>b.checkIn.localeCompare(a.checkIn));
  list=list.filter(b=>{
    const match=(b.guestName+" "+(b.guestPhone||"")).toLowerCase().includes(q);
    const ok=f==="all"||f==="active"&&activeBooking(b)||f==="open-balance"&&activeBooking(b)&&bookingBalance(b)>0||f==="future"&&activeBooking(b)&&b.checkIn>=t||f==="cancelled"&&b.status==="cancelled";
    return match&&ok;
  });
  $("#bookingsList").innerHTML=list.length?list.map(b=>bookingRow(b)).join(""):`<div class="card empty">לא נמצאו הזמנות</div>`;
}

function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  $("#calendarTitle").textContent=new Date(y,m,1).toLocaleDateString("he-IL",{month:"long",year:"numeric"});
  const first=new Date(y,m,1,12), firstDow=first.getDay(), start=addDays(first,-firstDow), grid=$("#calendarGrid");
  let html="";
  for(let i=0;i<42;i++){
    const d=addDays(start,i), s=iso(d), muted=d.getMonth()!==m, todays=s===todayIso();
    const bs=data.bookings.filter(b=>overlapsDate(b,s)).sort((a,b)=>a.checkIn.localeCompare(b.checkIn));
    html+=`<div class="day ${muted?"muted":""} ${todays?"today":""}" data-date="${s}">
      <div class="daynum">${d.getDate()}</div>
      ${bs.slice(0,3).map(b=>`<div class="mini-booking ${b.status}" onclick="editBooking('${b.id}')">${esc(b.guestName||statusText(b.status))}</div>`).join("")}
      ${bs.length>3?`<div class="row-sub">+${bs.length-3}</div>`:""}
    </div>`;
  }
  grid.innerHTML=html;
}

function renderMoney(){
  const booked=data.bookings.filter(b=>activeBooking(b)&&b.status!=="blocked").reduce((s,b)=>s+Number(b.totalPrice||0),0);
  const received=data.bookings.filter(b=>activeBooking(b)&&b.status!=="blocked").reduce((s,b)=>s+Number(b.paidAmount||0),0);
  const out=data.bookings.filter(b=>activeBooking(b)&&b.status!=="blocked").reduce((s,b)=>s+bookingBalance(b),0);
  const ex=data.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  $("#moneyBooked").textContent=money(booked);$("#moneyReceived").textContent=money(received);$("#moneyOutstanding").textContent=money(out);$("#moneyExpenses").textContent=money(ex);
  const opens=data.bookings.filter(b=>activeBooking(b)&&b.status!=="blocked"&&bookingBalance(b)>0).sort((a,b)=>a.checkIn.localeCompare(b.checkIn));
  $("#openBalances").innerHTML=opens.length?opens.map(b=>bookingRow(b,true)).join(""):"אין יתרות פתוחות";

  const months=[...new Set(data.expenses.map(e=>e.date.slice(0,7)))].sort().reverse();
  const sel=$("#expenseMonth"), old=sel.value;
  const current=currentMonthKey();
  if(!months.includes(current))months.unshift(current);
  sel.innerHTML=months.map(k=>`<option value="${k}">${new Date(k+"-01T12:00:00").toLocaleDateString("he-IL",{month:"long",year:"numeric"})}</option>`).join("");
  sel.value=months.includes(old)?old:current;
  renderExpenses();
}
function renderExpenses(){
  const key=$("#expenseMonth").value||currentMonthKey();
  const list=data.expenses.filter(e=>e.date.startsWith(key)).sort((a,b)=>b.date.localeCompare(a.date));
  $("#expensesList").innerHTML=list.length?list.map(e=>`<div class="row"><div><div class="row-title">${esc(e.category)} · ${esc(e.description||"")}</div><div class="row-sub">${fmtDate(e.date)}</div></div><div class="row-side"><div class="amount">${money(e.amount)}</div><button class="mini-btn" onclick="deleteExpense('${e.id}')">מחיקה</button></div></div>`).join(""):"אין הוצאות";
}
function renderOps(){
  const t=parseDate(todayIso()), limit=addDays(t,10);
  const bs=data.bookings.filter(b=>activeBooking(b)&&b.status!=="blocked"&&parseDate(b.checkOut)>=addDays(t,-1)&&parseDate(b.checkIn)<=limit).sort((a,b)=>a.checkIn.localeCompare(b.checkIn));
  const items=[];
  bs.forEach(b=>{
    const cleanKey=`clean-${b.id}`,depKey=`deposit-${b.id}`;
    items.push(`<div class="row"><div><div class="row-title">${esc(b.guestName)} · ${fmtShort(b.checkIn)}–${fmtShort(b.checkOut)}</div><div class="row-sub">כניסה ${esc(b.checkInTime||"15:00")} · יציאה ${esc(b.checkOutTime||"11:00")}</div></div><div class="row-side">
    <label class="ops-check"><input type="checkbox" ${data.ops[cleanKey]?"checked":""} onchange="setOp('${cleanKey}',this.checked)"> ניקיון בוצע</label>
    ${Number(b.damageDeposit||0)>0?`<label class="ops-check"><input type="checkbox" ${data.ops[depKey]?"checked":""} onchange="setOp('${depKey}',this.checked)"> פיקדון טופל</label>`:""}
    </div></div>`);
  });
  $("#opsList").innerHTML=items.length?items.join(""):"אין משימות קרובות";
}
function renderAll(){renderDashboard();renderBookings();renderCalendar();renderMoney();renderOps()}

function openBooking(id=null,date=null){
  $("#bookingForm").reset();$("#bookingId").value="";$("#deleteBooking").hidden=true;$("#conflictBox").hidden=true;
  $("#checkInTime").value="15:00";$("#checkOutTime").value="11:00";$("#guestCount").value=2;$("#totalPrice").value=0;$("#paidAmount").value=0;$("#damageDeposit").value=0;$("#channelFee").value=0;
  if(id){
    const b=data.bookings.find(x=>x.id===id); if(!b)return;
    $("#bookingDialogTitle").textContent="עריכת הזמנה";$("#bookingId").value=b.id;$("#deleteBooking").hidden=false;
    ["guestName","guestPhone","checkIn","checkOut","guestCount","source","totalPrice","paidAmount","damageDeposit","paymentMethod","status","checkInTime","checkOutTime","channelFee","notes"].forEach(k=>$("#"+k).value=b[k]??"");
  }else{
    $("#bookingDialogTitle").textContent="הזמנה חדשה";
    const start=date||todayIso();$("#checkIn").value=start;$("#checkOut").value=iso(addDays(parseDate(start),1));
  }
  $("#bookingDialog").showModal(); checkConflict();
}
window.editBooking=id=>openBooking(id);
window.deleteExpense=id=>{if(confirm("למחוק את ההוצאה?")){data.expenses=data.expenses.filter(e=>e.id!==id);save();toast("ההוצאה נמחקה")}}
window.setOp=(k,v)=>{data.ops[k]=v;save()};

function checkConflict(){
  const s=$("#checkIn").value,e=$("#checkOut").value,id=$("#bookingId").value,box=$("#conflictBox");
  if(!s||!e||e<=s){box.hidden=true;return}
  const c=conflictFor(s,e,id);
  if(c.length){box.hidden=false;box.innerHTML=`⚠️ התאריכים חופפים להזמנה קיימת: ${c.map(x=>esc(x.guestName)+" "+fmtShort(x.checkIn)+"–"+fmtShort(x.checkOut)).join(", ")}`;}
  else box.hidden=true;
}

$("#bookingForm").addEventListener("submit",e=>{
  e.preventDefault();
  const s=$("#checkIn").value,en=$("#checkOut").value,id=$("#bookingId").value;
  if(!s||!en||en<=s){alert("תאריך היציאה חייב להיות אחרי תאריך הכניסה");return}
  const conf=conflictFor(s,en,id);
  if(conf.length&&!confirm("יש חפיפה עם הזמנה קיימת. לשמור בכל זאת?"))return;
  const b={id:id||crypto.randomUUID(),createdAt:new Date().toISOString()};
  ["guestName","guestPhone","checkIn","checkOut","guestCount","source","totalPrice","paidAmount","damageDeposit","paymentMethod","status","checkInTime","checkOutTime","channelFee","notes"].forEach(k=>b[k]=$("#"+k).value);
  ["guestCount","totalPrice","paidAmount","damageDeposit","channelFee"].forEach(k=>b[k]=Number(b[k]||0));
  if(Number(b.paidAmount)>=Number(b.totalPrice)&&Number(b.totalPrice)>0&&b.status!=="blocked"&&b.status!=="cancelled")b.status="paid";
  if(id){const idx=data.bookings.findIndex(x=>x.id===id);data.bookings[idx]={...data.bookings[idx],...b}}
  else data.bookings.push(b);
  $("#bookingDialog").close();save();toast("ההזמנה נשמרה");
});
$("#deleteBooking").addEventListener("click",()=>{
  const id=$("#bookingId").value;if(!id)return;
  if(confirm("למחוק את ההזמנה לצמיתות?")){data.bookings=data.bookings.filter(b=>b.id!==id);$("#bookingDialog").close();save();toast("ההזמנה נמחקה")}
});
["checkIn","checkOut"].forEach(id=>$("#"+id).addEventListener("change",checkConflict));

$("#expenseForm").addEventListener("submit",e=>{
  e.preventDefault();
  data.expenses.push({id:crypto.randomUUID(),date:$("#expenseDate").value,amount:Number($("#expenseAmount").value||0),category:$("#expenseCategory").value,description:$("#expenseDescription").value});
  $("#expenseDialog").close();save();toast("ההוצאה נשמרה");
});

$$("[data-action='new-booking']").forEach(b=>b.onclick=()=>openBooking());
$$("[data-action='new-expense']").forEach(b=>b.onclick=()=>{$("#expenseForm").reset();$("#expenseDate").value=todayIso();$("#expenseDialog").showModal()});
$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());

$$(".tab").forEach(t=>t.addEventListener("click",()=>showView(t.dataset.view)));
$$("[data-view-jump]").forEach(t=>t.addEventListener("click",()=>showView(t.dataset.viewJump)));
function showView(id){$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));$$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view===id));window.scrollTo({top:0,behavior:"smooth"})}

$("#bookingSearch").addEventListener("input",renderBookings);
$("#bookingFilter").addEventListener("change",renderBookings);
$("#expenseMonth").addEventListener("change",renderExpenses);
$("#prevMonth").onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()};
$("#nextMonth").onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()};
$("#todayMonth").onclick=()=>{calendarCursor=new Date();renderCalendar()};
$("#calendarGrid").addEventListener("dblclick",e=>{const day=e.target.closest(".day");if(day)openBooking(null,day.dataset.date)});

$("#exportBackup").onclick=()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`villa-manager-backup-${todayIso()}.json`;a.click();URL.revokeObjectURL(a.href);
};
$("#importBackup").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.bookings||!x.expenses)throw new Error();data=x;save();toast("הגיבוי נטען")}catch(err){alert("קובץ גיבוי לא תקין")}};r.readAsText(f)
});
$("#exportCsv").onclick=()=>{
  const headers=["שם","טלפון","כניסה","יציאה","אורחים","מקור","מחיר כולל","שולם","יתרה","פיקדון","סטטוס","אמצעי תשלום","הערות"];
  const rows=data.bookings.map(b=>[b.guestName,b.guestPhone,b.checkIn,b.checkOut,b.guestCount,b.source,b.totalPrice,b.paidAmount,bookingBalance(b),b.damageDeposit,statusText(b.status),b.paymentMethod,b.notes]);
  const csv="\ufeff"+[headers,...rows].map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`villa-bookings-${todayIso()}.csv`;a.click();URL.revokeObjectURL(a.href)
};
$("#resetData").onclick=()=>{if(confirm("למחוק את כל הנתונים? אין אפשרות לבטל ללא גיבוי.")){data=structuredClone(defaultData);save();toast("המערכת אופסה")}};

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("#installBtn").hidden=false});
$("#installBtn").onclick=async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("#installBtn").hidden=true}};
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));

renderAll();