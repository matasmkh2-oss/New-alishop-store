import { CONFIG } from "./config.js";
import { supabase } from "./supabase-client.js";

const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const app=$("#app"), authDialog=$("#authDialog"), modal=$("#modal"), toastEl=$("#toast");

const state={user:null,profile:null,wallet:{balance:0},products:[],categories:[],authMode:"login",adminTab:"overview"};

const money=n=>`${Number(n||0).toFixed(2)} ${CONFIG.CURRENCY}`;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const date=v=>new Date(v).toLocaleString("ar");

function toast(message,type="success"){
  toastEl.textContent=message;toastEl.className=`toast show ${type==="error"?"error":""}`;
  setTimeout(()=>toastEl.className="toast",2800);
}
function badge(status){
  const m={pending:["قيد المراجعة","warning"],approved:["مقبول","success"],rejected:["مرفوض","danger"],paid:["مدفوع","success"],processing:["قيد المعالجة","warning"],delivered:["تم التسليم","success"],cancelled:["ملغي","danger"],refunded:["مسترد","warning"],active:["نشط","success"],blocked:["محظور","danger"]};
  const [t,c]=m[status]||[status||"-",""];return `<span class="badge ${c}">${t}</span>`;
}
function empty(title,text="لا توجد بيانات حاليًا"){return `<div class="card empty"><h2>${title}</h2><p>${text}</p></div>`}
function header(title,sub,actions=""){return `<div class="section-head"><div><h1>${title}</h1><p>${sub}</p></div><div class="toolbar">${actions}</div></div>`}
function openModal(html){modal.innerHTML=`<div class="content">${html}</div>`;modal.showModal();$$("[data-close]",modal).forEach(b=>b.onclick=()=>modal.close())}
function requireUser(){if(!state.user){authDialog.showModal();toast("سجل الدخول أولًا","error");return false}return true}
function requireAdmin(){if(state.profile?.role!=="admin"){app.innerHTML=empty("ليس لديك صلاحية الإدارة");return false}return true}

async function init(){
  bind();
  setTheme(localStorage.getItem("theme")||"light");
  const {data}=await supabase.auth.getSession();
  state.user=data.session?.user||null;
  await loadIdentity();
  updateHeader();
  supabase.auth.onAuthStateChange(async(_event,session)=>{
    state.user=session?.user||null;await loadIdentity();updateHeader();route();
  });
  route();
}
function bind(){
  $("#themeButton").onclick=()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");
  $("#authButton").onclick=async()=>{
    if(state.user){await supabase.auth.signOut();toast("تم تسجيل الخروج")}else authDialog.showModal();
  };
  $$("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
  $("#switchAuth").onclick=()=>{state.authMode=state.authMode==="login"?"register":"login";renderAuthMode()};
  $("#authForm").onsubmit=authSubmit;
  window.addEventListener("hashchange",route);
}
function setTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem("theme",t);$("#themeButton").textContent=t==="dark"?"☀":"☾"}
function renderAuthMode(){
  const reg=state.authMode==="register";
  $("#registerFields").classList.toggle("hidden",!reg);
  $("#authTitle").textContent=reg?"إنشاء حساب":"تسجيل الدخول";
  $("#authSubmit").textContent=reg?"إنشاء الحساب":"دخول";
  $("#switchAuth").textContent=reg?"لديك حساب؟ سجل الدخول":"ليس لديك حساب؟ أنشئ حسابًا";
}
async function authSubmit(e){
  e.preventDefault();const btn=$("#authSubmit");btn.disabled=true;
  try{
    const email=$("#email").value.trim(),password=$("#password").value;
    if(state.authMode==="register"){
      const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:$("#fullName").value.trim(),phone:$("#phone").value.trim()}}});
      if(error)throw error;toast("تم إنشاء الحساب. تحقق من بريدك إذا كان التحقق مفعّلًا.");
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;toast("مرحبًا بك");
    }
    authDialog.close();
  }catch(e){toast(e.message||"حدث خطأ","error")}finally{btn.disabled=false}
}
async function loadIdentity(){
  state.profile=null;state.wallet={balance:0};if(!state.user)return;
  const [{data:p},{data:w}]=await Promise.all([
    supabase.from("profiles").select("*").eq("id",state.user.id).maybeSingle(),
    supabase.from("wallets").select("balance").eq("user_id",state.user.id).maybeSingle()
  ]);
  state.profile=p;state.wallet=w||{balance:0};
}
function updateHeader(){
  $("#authButton").textContent=state.user?"تسجيل الخروج":"تسجيل الدخول";
  $("#adminLink").classList.toggle("hidden",state.profile?.role!=="admin");
}
function routeName(){return location.hash.replace("#/","").split("?")[0]||"home"}
function route(){
  const r=routeName();$$("[data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===r));
  const pages={home,products,orders,wallet,account,admin};(pages[r]||home)();
}

async function loadCatalog(){
  const [{data:p,error},{data:c}]=await Promise.all([
    supabase.from("products").select("*,category:categories(name)").eq("is_active",true).order("created_at",{ascending:false}),
    supabase.from("categories").select("*").eq("is_active",true).order("sort_order")
  ]);
  if(error)toast(error.message,"error");
  state.products=p||[];state.categories=c||[];
}
function productCard(p){
  return `<article class="card product"><div class="product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:"🛍️"}</div>
  <div class="product-body"><span class="badge">${esc(p.category?.name||"منتج رقمي")}</span><h3>${esc(p.name)}</h3><p>${esc(p.description||"منتج رقمي")}</p>
  <div class="product-foot"><span class="price">${money(p.price)}</span><button class="button primary" data-product="${p.id}">التفاصيل</button></div></div></article>`;
}
function bindProductButtons(){$$("[data-product]").forEach(b=>b.onclick=()=>productDetails(b.dataset.product))}
async function home(){
  await loadCatalog();
  app.innerHTML=`<section class="hero"><div><span class="badge">متجر رقمي آمن وسريع</span><h1>كل ما تحتاجه رقميًا في مكان واحد</h1>
  <p>اشحن محفظتك، اختر منتجك، واستلمه بسهولة من حسابك.</p><div class="hero-buttons"><a href="#/products" class="button secondary">تصفح المنتجات</a><a href="#/wallet" class="button primary">شحن الرصيد</a></div></div>
  <div class="wallet-box"><small>رصيد محفظتك</small><div class="balance">${money(state.wallet.balance)}</div><p>${state.user?"الرصيد جاهز للشراء.":"سجل الدخول للوصول إلى المحفظة والطلبات."}</p></div></section>
  ${header("المنتجات المميزة","أحدث المنتجات الرقمية")}
  <div class="grid">${state.products.slice(0,6).map(productCard).join("")||empty("لا توجد منتجات")}</div>`;
  bindProductButtons();
}
async function products(){
  await loadCatalog();
  app.innerHTML=`${header("جميع المنتجات","ابحث عن المنتج المناسب",`<input id="search" class="input" placeholder="بحث..."><select id="category" class="input"><option value="">كل التصنيفات</option>${state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>`)}
  <div id="productGrid" class="grid">${state.products.map(productCard).join("")||empty("لا توجد منتجات")}</div>`;
  const filter=()=>{const q=$("#search").value.toLowerCase(),cat=$("#category").value;const list=state.products.filter(p=>(!cat||p.category_id===cat)&&(`${p.name} ${p.description||""}`).toLowerCase().includes(q));$("#productGrid").innerHTML=list.map(productCard).join("")||empty("لا توجد نتائج");bindProductButtons()};
  $("#search").oninput=filter;$("#category").onchange=filter;bindProductButtons();
}
function productDetails(id){
  const p=state.products.find(x=>String(x.id)===String(id));if(!p)return;
  openModal(`<div class="dialog-head"><div><h2>${esc(p.name)}</h2><p>${esc(p.category?.name||"منتج رقمي")}</p></div><button class="close" data-close>×</button></div>
  <div class="product-image">${p.image_url?`<img src="${esc(p.image_url)}">`:"🛍️"}</div><p style="line-height:1.9;color:var(--muted)">${esc(p.description||"")}</p>
  <div class="product-foot"><span class="price">${money(p.price)}</span><button id="buy" class="button primary">شراء الآن</button></div>`);
  $("#buy",modal).onclick=()=>buy(p);
}
async function buy(p){
  if(!requireUser())return;if(!confirm(`تأكيد شراء ${p.name} بسعر ${money(p.price)}؟`))return;
  const b=$("#buy",modal);b.disabled=true;
  try{
    const {data,error}=await supabase.rpc("purchase_product",{p_product_id:p.id,p_idempotency_key:crypto.randomUUID()});
    if(error)throw error;toast(data?.message||"تمت عملية الشراء");modal.close();await loadIdentity();location.hash="#/orders";
  }catch(e){toast(e.message||"تعذر الشراء","error")}finally{b.disabled=false}
}
async function orders(){
  if(!requireUser())return app.innerHTML=empty("طلباتي","سجل الدخول لمشاهدة الطلبات");
  const {data}=await supabase.from("orders").select("*,product:products(name)").order("created_at",{ascending:false});const rows=data||[];
  app.innerHTML=`${header("طلباتي","سجل المشتريات وبيانات التسليم")}<div class="card panel table-wrap">${rows.length?`<table><thead><tr><th>رقم الطلب</th><th>المنتج</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>${rows.map(o=>`<tr><td>${esc(o.order_number)}</td><td>${esc(o.product?.name||"-")}</td><td>${money(o.total)}</td><td>${badge(o.status)}</td><td>${date(o.created_at)}</td><td><button class="mini" data-order="${o.id}">عرض</button></td></tr>`).join("")}</tbody></table>`:empty("لا توجد طلبات")}</div>`;
  $$("[data-order]").forEach(b=>b.onclick=()=>{const o=rows.find(x=>x.id===b.dataset.order);openModal(`<div class="dialog-head"><h2>${esc(o.order_number)}</h2><button class="close" data-close>×</button></div><p>الحالة: ${badge(o.status)}</p><div class="note"><strong>بيانات التسليم</strong><br>${esc(o.delivery_data||"لم يتم التسليم بعد")}</div>`)});
}
async function wallet(){
  if(!requireUser())return app.innerHTML=empty("المحفظة","سجل الدخول أولًا");
  const [{data:t},{data:d}]=await Promise.all([
    supabase.from("wallet_transactions").select("*").order("created_at",{ascending:false}).limit(30),
    supabase.from("deposit_requests").select("*,payment_method:payment_methods(name)").order("created_at",{ascending:false})
  ]);
  const tx=t||[],deps=d||[];
  app.innerHTML=`${header("المحفظة","الرصيد وطلبات الشحن",`<button id="deposit" class="button primary">طلب شحن رصيد</button>`)}
  <div class="stats"><div class="card stat"><small>الرصيد</small><strong>${money(state.wallet.balance)}</strong></div><div class="card stat"><small>طلبات الشحن</small><strong>${deps.length}</strong></div><div class="card stat"><small>الحركات</small><strong>${tx.length}</strong></div></div>
  ${header("طلبات الشحن","")}<div class="card panel table-wrap">${deps.length?`<table><thead><tr><th>الطريقة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${deps.map(x=>`<tr><td>${esc(x.payment_method?.name||"-")}</td><td>${money(x.amount)}</td><td>${badge(x.status)}</td><td>${date(x.created_at)}</td></tr>`).join("")}</tbody></table>`:empty("لا توجد طلبات")}</div>
  ${header("سجل الحركات","")}<div class="card panel table-wrap">${tx.length?`<table><thead><tr><th>النوع</th><th>المبلغ</th><th>الرصيد بعد العملية</th><th>البيان</th></tr></thead><tbody>${tx.map(x=>`<tr><td>${esc(x.type)}</td><td>${money(x.amount)}</td><td>${money(x.balance_after)}</td><td>${esc(x.description||"-")}</td></tr>`).join("")}</tbody></table>`:empty("لا توجد حركات")}</div>`;
  $("#deposit").onclick=depositForm;
}
async function depositForm(){
  const {data}=await supabase.from("payment_methods").select("*").eq("is_active",true).order("sort_order");const methods=data||[];
  if(!methods.length)return toast("لم يضف المدير طرق دفع بعد","error");
  openModal(`<div class="dialog-head"><div><h2>طلب شحن رصيد</h2><p>حوّل المبلغ ثم أرسل معلومات العملية.</p></div><button class="close" data-close>×</button></div>
  <form id="depositForm" class="form-grid"><label class="full">طريقة الدفع<select id="method">${methods.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select></label><div id="methodInfo" class="note full"></div>
  <label>المبلغ<input id="amount" type="number" min="1" step=".01" required></label><label>رقم التحويل<input id="reference" required></label><label class="full">رابط صورة الإثبات<input id="receipt" type="url" placeholder="https://..."></label>
  <label class="full">ملاحظة<textarea id="note"></textarea></label><button class="button primary full">إرسال الطلب</button></form>`);
  const info=()=>{const m=methods.find(x=>x.id===$("#method").value);$("#methodInfo").innerHTML=`<strong>${esc(m.name)}</strong><br>${esc(m.instructions||"")}${m.account_number?`<br>الحساب: ${esc(m.account_number)}`:""}`};$("#method").onchange=info;info();
  $("#depositForm").onsubmit=async e=>{e.preventDefault();const {error}=await supabase.from("deposit_requests").insert({user_id:state.user.id,payment_method_id:$("#method").value,amount:Number($("#amount").value),transfer_reference:$("#reference").value.trim(),receipt_url:$("#receipt").value.trim()||null,note:$("#note").value.trim()||null});if(error)return toast(error.message,"error");toast("تم إرسال الطلب");modal.close();wallet()};
}
function account(){
  if(!requireUser())return app.innerHTML=empty("حسابي","سجل الدخول أولًا");
  app.innerHTML=`${header("حسابي","بيانات الحساب")}<div class="card panel"><h2>${esc(state.profile?.full_name||"مستخدم")}</h2><p>${esc(state.user.email)}</p><p>الهاتف: ${esc(state.profile?.phone||"-")}</p><p>الدور: <span class="badge">${state.profile?.role==="admin"?"مدير":"مستخدم"}</span></p><p>الحالة: ${badge(state.profile?.status)}</p></div>`;
}
async function admin(){
  if(!requireAdmin())return;
  app.innerHTML=`${header("لوحة الإدارة","إدارة المتجر")}<div class="tabs">${[["overview","الرئيسية"],["products","المنتجات"],["categories","التصنيفات"],["payments","طرق الدفع"],["deposits","طلبات الشحن"],["users","المستخدمون"]].map(([id,n])=>`<button class="tab ${state.adminTab===id?"active":""}" data-tab="${id}">${n}</button>`).join("")}</div><div id="adminContent"></div>`;
  $$("[data-tab]").forEach(b=>b.onclick=()=>{state.adminTab=b.dataset.tab;admin()});
  await ({overview:adminOverview,products:adminProducts,categories:adminCategories,payments:adminPayments,deposits:adminDeposits,users:adminUsers}[state.adminTab])();
}
async function adminOverview(){
  const [{count:p},{count:u},{count:o},{count:d}]=await Promise.all([
    supabase.from("products").select("*",{count:"exact",head:true}),supabase.from("profiles").select("*",{count:"exact",head:true}),supabase.from("orders").select("*",{count:"exact",head:true}),supabase.from("deposit_requests").select("*",{count:"exact",head:true}).eq("status","pending")
  ]);
  $("#adminContent").innerHTML=`<div class="stats"><div class="card stat"><small>المنتجات</small><strong>${p||0}</strong></div><div class="card stat"><small>المستخدمون</small><strong>${u||0}</strong></div><div class="card stat"><small>الطلبات</small><strong>${o||0}</strong></div><div class="card stat"><small>شحن معلق</small><strong>${d||0}</strong></div></div>`;
}
async function adminProducts(){
  const {data}=await supabase.from("products").select("*,category:categories(name)").order("created_at",{ascending:false});const rows=data||[];
  $("#adminContent").innerHTML=`${header("المنتجات","",`<button id="addProduct" class="button primary">إضافة منتج</button>`)}<div class="card panel table-wrap">${rows.length?`<table><thead><tr><th>الاسم</th><th>السعر</th><th>التصنيف</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td>${esc(p.name)}</td><td>${money(p.price)}</td><td>${esc(p.category?.name||"-")}</td><td>${p.is_active?badge("active"):badge("blocked")}</td><td><button class="mini" data-edit-product="${p.id}">تعديل</button></td></tr>`).join("")}</tbody></table>`:empty("لا توجد منتجات")}</div>`;
  $("#addProduct").onclick=()=>productForm();$$("[data-edit-product]").forEach(b=>b.onclick=()=>productForm(rows.find(x=>x.id===b.dataset.editProduct)));
}
async function productForm(p=null){
  const {data:c}=await supabase.from("categories").select("*").order("name");const cats=c||[];
  openModal(`<div class="dialog-head"><h2>${p?"تعديل":"إضافة"} منتج</h2><button class="close" data-close>×</button></div><form id="productForm" class="form-grid">
  <label>الاسم<input id="pName" value="${esc(p?.name||"")}" required></label><label>السعر<input id="pPrice" type="number" min="0" step=".01" value="${p?.price||0}" required></label>
  <label>التصنيف<select id="pCat"><option value="">بدون</option>${cats.map(x=>`<option value="${x.id}" ${p?.category_id===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
  <label>التسليم<select id="pDelivery"><option value="automatic">تلقائي</option><option value="manual" ${p?.delivery_type==="manual"?"selected":""}>يدوي</option></select></label>
  <label class="full">رابط الصورة<input id="pImage" type="url" value="${esc(p?.image_url||"")}"></label><label class="full">الوصف<textarea id="pDesc">${esc(p?.description||"")}</textarea></label>
  <label><input id="pActive" type="checkbox" ${p?.is_active!==false?"checked":""}> مفعّل</label><label><input id="pFeatured" type="checkbox" ${p?.is_featured?"checked":""}> مميز</label><button class="button primary full">حفظ</button></form>`);
  $("#productForm").onsubmit=async e=>{e.preventDefault();const payload={name:$("#pName").value.trim(),price:Number($("#pPrice").value),category_id:$("#pCat").value||null,delivery_type:$("#pDelivery").value,image_url:$("#pImage").value.trim()||null,description:$("#pDesc").value.trim(),is_active:$("#pActive").checked,is_featured:$("#pFeatured").checked};const q=p?supabase.from("products").update(payload).eq("id",p.id):supabase.from("products").insert(payload);const {error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");modal.close();adminProducts()};
}
async function adminCategories(){
  const {data}=await supabase.from("categories").select("*").order("sort_order");const rows=data||[];
  $("#adminContent").innerHTML=`${header("التصنيفات","",`<button id="addCat" class="button primary">إضافة تصنيف</button>`)}<div class="card panel table-wrap"><table><thead><tr><th>الاسم</th><th>الترتيب</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.sort_order}</td><td>${c.is_active?badge("active"):badge("blocked")}</td><td><button class="mini" data-cat="${c.id}">تعديل</button></td></tr>`).join("")}</tbody></table></div>`;
  $("#addCat").onclick=()=>categoryForm();$$("[data-cat]").forEach(b=>b.onclick=()=>categoryForm(rows.find(x=>x.id===b.dataset.cat)));
}
function categoryForm(c=null){
  openModal(`<div class="dialog-head"><h2>${c?"تعديل":"إضافة"} تصنيف</h2><button class="close" data-close>×</button></div><form id="catForm" class="form-grid"><label>الاسم<input id="cName" value="${esc(c?.name||"")}" required></label><label>الترتيب<input id="cOrder" type="number" value="${c?.sort_order||0}"></label><label class="full">الوصف<textarea id="cDesc">${esc(c?.description||"")}</textarea></label><label><input id="cActive" type="checkbox" ${c?.is_active!==false?"checked":""}> مفعّل</label><button class="button primary full">حفظ</button></form>`);
  $("#catForm").onsubmit=async e=>{e.preventDefault();const payload={name:$("#cName").value.trim(),sort_order:Number($("#cOrder").value),description:$("#cDesc").value.trim(),is_active:$("#cActive").checked};const q=c?supabase.from("categories").update(payload).eq("id",c.id):supabase.from("categories").insert(payload);const {error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");modal.close();adminCategories()};
}
async function adminPayments(){
  const {data}=await supabase.from("payment_methods").select("*").order("sort_order");const rows=data||[];
  $("#adminContent").innerHTML=`${header("طرق الدفع","",`<button id="addPay" class="button primary">إضافة طريقة دفع</button>`)}<div class="card panel table-wrap"><table><thead><tr><th>الاسم</th><th>الحساب</th><th>العملة</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.account_number||"-")}</td><td>${esc(m.currency)}</td><td>${m.is_active?badge("active"):badge("blocked")}</td><td><button class="mini" data-pay="${m.id}">تعديل</button></td></tr>`).join("")}</tbody></table></div>`;
  $("#addPay").onclick=()=>paymentForm();$$("[data-pay]").forEach(b=>b.onclick=()=>paymentForm(rows.find(x=>x.id===b.dataset.pay)));
}
function paymentForm(m=null){
  openModal(`<div class="dialog-head"><h2>${m?"تعديل":"إضافة"} طريقة دفع</h2><button class="close" data-close>×</button></div><form id="payForm" class="form-grid"><label>الاسم<input id="mName" value="${esc(m?.name||"")}" required></label><label>العملة<input id="mCurrency" value="${esc(m?.currency||CONFIG.CURRENCY)}"></label><label>اسم الحساب<input id="mOwner" value="${esc(m?.account_name||"")}"></label><label>رقم الحساب<input id="mNumber" value="${esc(m?.account_number||"")}"></label><label class="full">التعليمات<textarea id="mInfo">${esc(m?.instructions||"")}</textarea></label><label><input id="mActive" type="checkbox" ${m?.is_active!==false?"checked":""}> مفعلة</label><button class="button primary full">حفظ</button></form>`);
  $("#payForm").onsubmit=async e=>{e.preventDefault();const payload={name:$("#mName").value.trim(),currency:$("#mCurrency").value.trim(),account_name:$("#mOwner").value.trim(),account_number:$("#mNumber").value.trim(),instructions:$("#mInfo").value.trim(),is_active:$("#mActive").checked};const q=m?supabase.from("payment_methods").update(payload).eq("id",m.id):supabase.from("payment_methods").insert(payload);const {error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");modal.close();adminPayments()};
}
async function adminDeposits(){
  const {data}=await supabase.from("deposit_requests").select("*,profile:profiles(full_name),payment_method:payment_methods(name)").order("created_at",{ascending:false});const rows=data||[];
  $("#adminContent").innerHTML=`${header("طلبات الشحن","")}<div class="card panel table-wrap">${rows.length?`<table><thead><tr><th>المستخدم</th><th>الطريقة</th><th>المبلغ</th><th>المرجع</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td>${esc(d.profile?.full_name||"-")}</td><td>${esc(d.payment_method?.name||"-")}</td><td>${money(d.amount)}</td><td>${esc(d.transfer_reference)}</td><td>${badge(d.status)}</td><td>${d.status==="pending"?`<button class="mini" data-approve="${d.id}">قبول</button> <button class="mini" data-reject="${d.id}">رفض</button>`:""}</td></tr>`).join("")}</tbody></table>`:empty("لا توجد طلبات")}</div>`;
  $$("[data-approve]").forEach(b=>b.onclick=()=>reviewDeposit(b.dataset.approve,true));$$("[data-reject]").forEach(b=>b.onclick=()=>reviewDeposit(b.dataset.reject,false));
}
async function reviewDeposit(id,approve){
  const reason=approve?null:prompt("سبب الرفض:");if(!approve&&!reason)return;
  const {error}=await supabase.rpc(approve?"approve_deposit":"reject_deposit",approve?{p_deposit_id:id}:{p_deposit_id:id,p_reason:reason});
  if(error)return toast(error.message,"error");toast(approve?"تم قبول الطلب":"تم رفض الطلب");adminDeposits();
}
async function adminUsers(){
  const {data}=await supabase.from("profiles").select("id,full_name,phone,role,status,created_at,wallets(balance)").order("created_at",{ascending:false});const rows=data||[];
  $("#adminContent").innerHTML=`${header("المستخدمون","")}<div class="card panel table-wrap"><table><thead><tr><th>الاسم</th><th>الهاتف</th><th>الرصيد</th><th>الدور</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(u=>`<tr><td>${esc(u.full_name||"-")}</td><td>${esc(u.phone||"-")}</td><td>${money(u.wallets?.[0]?.balance||0)}</td><td>${esc(u.role)}</td><td>${badge(u.status)}</td><td><button class="mini" data-user="${u.id}">تعديل الرصيد</button></td></tr>`).join("")}</tbody></table></div>`;
  $$("[data-user]").forEach(b=>b.onclick=()=>adjustWallet(b.dataset.user));
}
async function adjustWallet(id){
  const amount=Number(prompt("المبلغ: موجب للإضافة وسالب للخصم"));if(!amount)return;const reason=prompt("سبب العملية:");if(!reason)return;
  const {error}=await supabase.rpc("admin_adjust_wallet",{p_user_id:id,p_amount:amount,p_reason:reason});if(error)return toast(error.message,"error");toast("تم تعديل الرصيد");adminUsers();
}

renderAuthMode();init();
