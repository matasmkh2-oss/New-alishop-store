import{CONFIG}from"./config.js";import{supabase}from"./supabase-client.js";
const APP_BUILD="12.0.0";
const $=(s,p=document)=>p.querySelector(s),$$=(s,p=document)=>[...p.querySelectorAll(s)];
const app=$("#app"),modal=$("#modalDialog"),auth=$("#authDialog");
const S={user:null,profile:null,wallet:{balance:0},products:[],categories:[],notes:[],slides:[],settings:{},authMode:"login",adminGroup:"dashboard",adminPage:"overview",page:1,query:"",filter:"",deferredInstall:null,productMode:"hub",orderTab:"digital",noteTab:"digital",platforms:[],socialCategories:[],adminBadges:{},floatingHidden:false,supportUnread:0};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=n=>`${Number(n||0).toFixed(2)} ${CONFIG.CURRENCY}`,dt=v=>new Date(v).toLocaleString("ar");
const debounce=(fn,ms=250)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
const LOG_LABELS={update_order:"تحديث طلب",set_user_status:"تغيير حالة مستخدم",set_user_role:"تغيير دور مستخدم",adjust_wallet:"تعديل رصيد",approve_deposit:"قبول طلب شحن",reject_deposit:"رفض طلب شحن",create_product:"إضافة منتج",update_product:"تعديل منتج",delete_product:"حذف منتج",publish_announcement:"نشر إعلان",generate_cards:"توليد بطاقات شحن",update_slide:"تحديث سلايدر",delete_slide:"حذف سلايدر"};
function logLabel(v){return LOG_LABELS[v]||String(v||"عملية إدارية").replaceAll("_"," ")}
function safeFileName(name){return `${Date.now()}-${crypto.randomUUID()}-${String(name).replace(/[^a-zA-Z0-9._-]/g,"-")}`}
async function uploadFile(file,folder){
  if(!file)return null;
  if(!file.type.startsWith("image/"))throw new Error("يسمح برفع الصور فقط");
  if(file.size>5*1024*1024)throw new Error("حجم الصورة يجب ألا يتجاوز 5MB");
  const path=`${folder}/${safeFileName(file.name)}`;
  const{error}=await supabase.storage.from("store-media").upload(path,file,{cacheControl:"3600",upsert:false});
  if(error)throw error;
  return supabase.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}
function imagePicker(id,current=""){return `<div class="upload-box">${current?`<img class="upload-preview" src="${esc(current)}">`:"<div class='upload-placeholder'>⌑</div>"}<label class="btn soft upload-button">اختيار صورة<input id="${id}" type="file" accept="image/*" hidden></label><small>PNG أو JPG أو WEBP، بحد أقصى 5MB</small></div>`}


function applyBranding(){
  const name=S.settings.store_name||"علي شوب";
  const logo=S.settings.logo_url||null;
  $("#storeName").textContent=name;
  const topLogo=$(".brand-logo");
  const splashLogo=$(".splash-logo");
  [topLogo,splashLogo].forEach(el=>{
    if(!el)return;
    el.classList.toggle("has-image",!!logo);
    if(logo)el.innerHTML=`<img src="${esc(logo)}" alt="${esc(name)}">`;
    else el.textContent=name.trim().charAt(0)||"A";
  });
}
async function previewCoupon(code,product){
  const box=$("#couponPreview",modal);
  if(!box)return;
  if(!code){box.className="coupon-preview hidden";box.innerHTML="";return}
  box.className="coupon-preview loading";
  box.innerHTML=`<i data-lucide="loader-circle"></i><span>جاري التحقق من الكوبون...</span>`;
  refreshIcons();
  const{data,error}=await supabase.rpc("preview_coupon_discount",{p_code:code,p_product_id:product.id});
  if(error||!data?.valid){
    box.className="coupon-preview invalid";
    box.innerHTML=`<i data-lucide="circle-x"></i><div><strong>الكوبون غير صالح أو غير نشط</strong><small>${esc(data?.message||error?.message||"تحقق من الرمز")}</small></div>`;
  }else{
    box.className="coupon-preview valid";
    box.innerHTML=`<i data-lucide="badge-percent"></i><div><strong>خصم ${money(data.discount)}</strong><small>السعر بعد الخصم: ${money(data.final_total)} • الكوبون نشط</small></div>`;
  }
  refreshIcons();
}



function adminBadge(key){
  const n=Number(S.adminBadges?.[key]||0);
  return n>0?`<i class="admin-notice-badge">${n>99?"99+":n}</i>`:"";
}
function playChatSound(incoming=true){
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return;
    const ctx=new C(),gain=ctx.createGain(),osc=ctx.createOscillator();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type="sine";
    osc.frequency.setValueAtTime(incoming?740:520,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(incoming?980:680,ctx.currentTime+.09);
    gain.gain.setValueAtTime(.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.095,ctx.currentTime+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.16);
    osc.start();osc.stop(ctx.currentTime+.17);
  }catch{}
}
async function loadAdminBadges(){
  S.adminBadges={};
  S.supportUnread=0;
  if(S.profile?.role!=="admin")return;

  const safeCount=async(query)=>{
    try{
      const result=await query;
      return result.error?0:Number(result.count||0);
    }catch{return 0}
  };

  const [orders,socialOrders,deposits,cancels,support,lowStock]=await Promise.all([
    safeCount(supabase.from("orders").select("*",{count:"exact",head:true}).in("status",["paid","processing"])),
    safeCount(supabase.from("smm_orders").select("*",{count:"exact",head:true}).in("status",["pending","processing"])),
    safeCount(supabase.from("deposit_requests").select("*",{count:"exact",head:true}).eq("status","pending")),
    safeCount(supabase.from("order_cancel_requests").select("*",{count:"exact",head:true}).eq("status","pending")),
    safeCount(supabase.from("support_threads").select("*",{count:"exact",head:true}).gt("admin_unread_count",0)),
    safeCount(supabase.from("products_with_stock").select("*",{count:"exact",head:true}).eq("availability_status","sold_out"))
  ]);

  S.adminBadges={
    sales:orders+socialOrders+cancels,
    orders:orders+socialOrders,
    cancel_requests:cancels,
    finance:deposits,
    deposits,
    catalog:lowStock,
    inventory:lowStock,
    system:support,
    support
  };
  S.supportUnread=support;
}
function setupFloatingAutoHide(){
  const root=$("#floatingContacts"),toggle=$("#floatingContactsToggle");
  if(!root)return;
  clearTimeout(window.__floatingTimer);
  const show=()=>{
    root.classList.remove("auto-hidden");
    toggle?.classList.add("hidden");
    window.__floatingTimer=setTimeout(()=>{
      root.classList.add("auto-hidden");
      toggle?.classList.remove("hidden");
    },5000);
  };
  root.onpointerdown=show;
  root.onmouseenter=show;
  if(toggle)toggle.onclick=show;
  show();
}
function emojiPicker(targetId){
  const emojis=["😀","😊","😍","👍","🙏","❤️","🔥","🎉","✅","❓","📦","💳","🚀","✨","😢","😡"];
  return `<div class="emoji-picker hidden" data-emoji-box="${targetId}">${emojis.map(e=>`<button type="button" data-emoji="${e}" data-emoji-target="${targetId}">${e}</button>`).join("")}</div>`;
}
function bindEmojiPicker(){
  $$("[data-toggle-emoji]").forEach(b=>b.onclick=()=>{
    const box=$(`[data-emoji-box="${b.dataset.toggleEmoji}"]`);
    box?.classList.toggle("hidden");
  });
  $$("[data-emoji]").forEach(b=>b.onclick=()=>{
    const input=$("#"+b.dataset.emojiTarget);
    if(input){input.value+=b.dataset.emoji;input.focus()}
  });
}
async function uploadSupportImage(file){
  if(!file)return null;
  if(!file.type.startsWith("image/"))throw new Error("يسمح برفع الصور فقط");
  if(file.size>5*1024*1024)throw new Error("حجم الصورة أكبر من 5MB");
  return await uploadFile(file,"support");
}

function renderFloatingContacts(){
  let root=$("#floatingContacts");
  if(!root){root=document.createElement("div");root.id="floatingContacts";root.className="floating-contacts";document.body.append(root)}
  let toggle=$("#floatingContactsToggle");
  if(!toggle){toggle=document.createElement("button");toggle.id="floatingContactsToggle";toggle.className="floating-contacts-toggle hidden";toggle.innerHTML='<i data-lucide="chevrons-left"></i>';document.body.append(toggle)}
  const w=String(S.settings.support_whatsapp||"").replace(/\D/g,"");
  const t=String(S.settings.support_telegram||"").replace(/^@/,"").trim();
  root.innerHTML=`${w?`<a class="floating-contact whatsapp" href="https://wa.me/${w}" target="_blank" aria-label="واتساب"><i data-lucide="message-circle"></i></a>`:""}${t?`<a class="floating-contact telegram" href="https://t.me/${esc(t)}" target="_blank" aria-label="تلغرام"><i data-lucide="send"></i></a>`:""}${S.user?`<button class="floating-contact support" id="openSupportChat" aria-label="الدعم"><i data-lucide="headphones"></i>${S.supportUnread?`<i class="floating-badge">${S.supportUnread>99?"99+":S.supportUnread}</i>`:""}</button>`:""}`;
  if($("#openSupportChat"))$("#openSupportChat").onclick=openSupportChat;
  refreshIcons();setupFloatingAutoHide();
}
async function openSupportChat(){
  if(!needUser())return;
  let{data:thread,error}=await supabase.from("support_threads").select("*").eq("user_id",S.user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error)return toast(error.message,"error");
  if(!thread){
    const created=await supabase.from("support_threads").insert({user_id:S.user.id,subject:"محادثة دعم"}).select().single();
    if(created.error)return toast(created.error.message,"error");
    thread=created.data;
  }
  const{data:messages}=await supabase.from("support_messages").select("*,sender:profiles(full_name,role)").eq("thread_id",thread.id).order("created_at");
  await supabase.from("support_threads").update({user_unread_count:0}).eq("id",thread.id);
  openModal(`<div class="sheet-head"><div><h2>الدعم الفني</h2><p>${thread.is_user_blocked?"تم إيقاف الإرسال بواسطة الإدارة":"محادثة مباشرة داخل التطبيق"}</p></div><button data-close>×</button></div>
    <div id="supportMessages" class="support-messages">${(messages||[]).map(m=>`<div class="support-message ${m.sender_id===S.user.id?"mine":"theirs"}">${m.image_url?`<img class="chat-image" src="${esc(m.image_url)}" alt="">`:""}${m.body?`<div>${esc(m.body)}</div>`:""}<small>${dt(m.created_at)}</small></div>`).join("")||`<div class="empty-chat">ابدأ المحادثة مع الدعم</div>`}</div>
    ${thread.is_user_blocked?`<div class="chat-blocked"><i data-lucide="ban"></i><span>قام الدعم بإيقاف إرسال الرسائل مؤقتًا.</span></div>`:
    `<form id="supportSendForm" class="support-send-rich">
      <div class="chat-tools">
        <button type="button" class="icon-action" data-toggle-emoji="supportBody" title="إيموجي"><i data-lucide="smile"></i></button>
        <button type="button" class="icon-action chat-image-button" id="supportImageButton" title="إضافة صورة"><i data-lucide="image-plus"></i><i id="supportImageBadge" class="image-selected-badge hidden"></i></button>
        <input id="supportImage" class="chat-file-input" type="file" accept="image/*" tabindex="-1" aria-hidden="true">
      </div>
      ${emojiPicker("supportBody")}
      <input id="supportBody" class="input" placeholder="اكتب رسالتك...">
      <button class="icon-action primary"><i data-lucide="send"></i></button>
    </form>`}`);
  if($("#supportSendForm"))$("#supportSendForm").onsubmit=async e=>{
    e.preventDefault();
    const body=$("#supportBody").value.trim(),file=$("#supportImage").files[0];
    if(!body&&!file)return;
    try{
      const image=await uploadSupportImage(file);
      const{error}=await supabase.from("support_messages").insert({thread_id:thread.id,sender_id:S.user.id,body:body||null,image_url:image});
      if(error)throw error;
      playChatSound(false);closeModal();openSupportChat();
    }catch(err){toast(err.message,"error")}
  };
  bindEmojiPicker();bindChatImagePicker("supportImage","supportImageButton","supportImageBadge");refreshIcons();
  const list=$("#supportMessages");if(list)list.scrollTop=list.scrollHeight;
}

function bindChatImagePicker(inputId,buttonId,badgeId){
  const input=$("#"+inputId),button=$("#"+buttonId),badge=$("#"+badgeId);
  if(!input||!button)return;
  button.onclick=()=>input.click();
  input.onchange=()=>{
    const file=input.files?.[0];
    if(badge){
      badge.textContent=file?"1":"";
      badge.classList.toggle("hidden",!file);
    }
    button.classList.toggle("has-file",!!file);
    if(file)toast("تم اختيار الصورة");
  };
}


function friendlyError(error){
  const raw=String(error?.message||error||"حدث خطأ غير معروف");
  const map=[
    ["row-level security","لا توجد صلاحية لتنفيذ العملية. شغّل ملف إصلاح قاعدة البيانات المرفق."],
    ["violates not-null constraint","هناك حقل مطلوب في قاعدة البيانات لم يتم إرساله."],
    ["duplicate key","هذه البيانات موجودة مسبقًا."],
    ["invalid input syntax for type json","صيغة الحقول المطلوبة غير صحيحة."],
    ["Failed to fetch","تعذر الاتصال بقاعدة البيانات. تحقق من الإنترنت."],
    ["Bucket not found","مساحة رفع الصور غير موجودة. شغّل ملف SQL المرفق."],
    ["new row violates","تعذر الحفظ بسبب سياسة قاعدة البيانات."]
  ];
  const found=map.find(([key])=>raw.toLowerCase().includes(key.toLowerCase()));
  return found?.[1]||raw;
}
function setFormBusy(form,busy,label="جارٍ الحفظ..."){
  if(!form)return;
  const button=form.querySelector('button[type="submit"],button:not([type])');
  if(!button)return;
  if(busy){
    button.dataset.originalHtml=button.innerHTML;
    button.disabled=true;
    button.innerHTML=`<i data-lucide="loader-circle" class="spin-icon"></i><span>${label}</span>`;
  }else{
    button.disabled=false;
    if(button.dataset.originalHtml)button.innerHTML=button.dataset.originalHtml;
  }
  refreshIcons();
}
function parseRequiredFields(value){
  const text=String(value||"").trim();
  if(!text)return [];
  let fields;
  try{fields=JSON.parse(text)}catch{throw new Error("صيغة الحقول المطلوبة غير صحيحة. استخدم القائمة بالشكل الموضح في المثال.")}
  if(!Array.isArray(fields))throw new Error("الحقول المطلوبة يجب أن تكون قائمة.");
  return fields.map((field,index)=>{
    if(!field||typeof field!=="object")throw new Error(`الحقل رقم ${index+1} غير صالح.`);
    const label=String(field.label||"").trim();
    if(!label)throw new Error(`اسم الحقل رقم ${index+1} مطلوب.`);
    const type=["text","url","number"].includes(field.type)?field.type:"text";
    return {label,type,required:Boolean(field.required),placeholder:String(field.placeholder||"")};
  });
}
function validatePositiveNumber(value,label,allowZero=false){
  const number=Number(value);
  if(!Number.isFinite(number)||(allowZero?number<0:number<=0))throw new Error(`${label} غير صالح.`);
  return number;
}
window.addEventListener("unhandledrejection",event=>{
  console.error("Unhandled promise rejection:",event.reason);
  toast(friendlyError(event.reason),"error");
});
window.addEventListener("error",event=>{
  console.error("Application error:",event.error||event.message);
});

function refreshIcons(){if(window.lucide)window.lucide.createIcons({attrs:{"stroke-width":1.9}})}
function iconButton(name,label,attrs=""){return `<button class="icon-action" title="${esc(label)}" aria-label="${esc(label)}" ${attrs}><i data-lucide="${name}"></i></button>`}
function playNotificationSound(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),g=c.createGain(),o1=c.createOscillator(),o2=c.createOscillator();g.connect(c.destination);o1.connect(g);o2.connect(g);o1.frequency.value=880;o2.frequency.value=1320;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.1,c.currentTime+.012);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.18);o1.start();o2.start(c.currentTime+.045);o1.stop(c.currentTime+.17);o2.stop(c.currentTime+.19)}catch{}}
const ADMIN_ICONS={sales:"receipt-text",catalog:"package-search",finance:"wallet-cards",users:"users-round",marketing:"megaphone",smm:"rocket",system:"settings-2"};

function toast(m,t="success"){const e=document.createElement("div");e.className=`toast ${t}`;e.textContent=m;$("#toastRoot").append(e);setTimeout(()=>e.remove(),3200)}
function badge(s){const m={pending:["قيد المراجعة","warning"],approved:["مقبول","success"],rejected:["مرفوض","danger"],paid:["مدفوع","success"],processing:["قيد التنفيذ","warning"],delivered:["تم التسليم","success"],cancelled:["ملغي","danger"],refunded:["مسترد","warning"],active:["نشط","success"],blocked:["محظور","danger"],available:["متاح","success"],paused:["موقوف","warning"],sold_out:["نفد","danger"]};const[t,c]=m[s]||[s||"-",""];return`<span class="badge ${c}">${t}</span>`}
function walletBalanceOf(u){return Number(u?.wallet_balance??u?.wallets?.balance??u?.wallets?.[0]?.balance??0)||0}
function userRoleLabel(u){if(isPrimaryAdmin(u?.id))return "المدير الأساسي";return u?.role==="admin"?"مدير":"مستخدم"}
function userRoleTone(u){if(isPrimaryAdmin(u?.id))return "primary-admin";return u?.role==="admin"?"admin-role":"user-role"}
function section(t,p,a=""){return`<div class="section"><div><h2>${t}</h2><p>${p}</p></div>${a}</div>`}
function empty(t,p="لا توجد بيانات"){return`<div class="card empty"><h2>${t}</h2><p>${p}</p></div>`}
function openModal(h){modal.innerHTML=`<div class="dialog-body"><div class="grip"></div>${h}</div>`;modal.showModal();document.body.style.overflow="hidden";$$("[data-close]",modal).forEach(b=>b.onclick=closeModal);setTimeout(refreshIcons,0)}
function closeModal(){modal.close();document.body.style.overflow=""}
function needUser(){if(!S.user){auth.showModal();toast("سجل الدخول أولًا","error");return false}return true}
function needAdmin(){if(S.profile?.role!=="admin"){app.innerHTML=empty("غير مصرح");return false}return true}
function pager(page,total,size){const pages=Math.max(1,Math.ceil(total/size)),start=Math.max(1,page-2),end=Math.min(pages,page+2);return`<div class="pagination"><button class="page-btn" data-page="${Math.max(1,page-1)}">‹</button>${Array.from({length:end-start+1},(_,i)=>start+i).map(n=>`<button class="page-btn ${n===page?"active":""}" data-page="${n}">${n}</button>`).join("")}<button class="page-btn" data-page="${Math.min(pages,page+1)}">›</button></div>`}
function bindPager(render){$$("[data-page]").forEach(b=>b.onclick=()=>{S.page=+b.dataset.page;render()})}
function adminHeader(title,sub,actions=""){return`${section(title,sub,actions)}<div class="admin-toolbar"><input id="adminSearch" class="input" placeholder="بحث..." value="${esc(S.query)}"><select id="adminFilter" class="input"><option value="">الكل</option></select><button id="clearFilters" class="btn soft">مسح</button></div>`}
async function init(){
  bind();
  setTheme(localStorage.theme||"dark");

  const splashTimer=setTimeout(()=>{
    $("#splash")?.classList.add("hide");
  },3500);

  try{
    const{data}=await supabase.auth.getSession();
    S.user=data.session?.user||null;

    await loadIdentity();
    await loadPublic();
    await loadNotes();
    await loadAdminBadges();

    updateHeader();
    renderFloatingContacts();
    subscribeRealtime();

    supabase.auth.onAuthStateChange(async(event,session)=>{
      try{
        S.user=session?.user||null;
        await loadIdentity();
        await loadNotes();
        await loadAdminBadges();
        updateHeader();
        renderFloatingContacts();
        route();
        if(event==="PASSWORD_RECOVERY")setTimeout(()=>completePasswordRecoveryFlow?.(),120);
      }catch(error){
        console.error("Auth refresh error:",error);
      }
    });

    route();
  }catch(error){
    console.error("AliShop initialization error:",error);
    app.innerHTML=`<div class="card empty"><h2>تعذر تحميل بعض البيانات</h2><p>تحقق من الاتصال ثم أعد المحاولة.</p><button id="retryApp" class="btn primary">إعادة المحاولة</button></div>`;
    $("#retryApp")?.addEventListener("click",()=>location.reload());
  }finally{
    clearTimeout(splashTimer);
    setTimeout(()=>$("#splash")?.classList.add("hide"),350);
  }

  if("serviceWorker"in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
}
function bind(){$("#themeButton").onclick=()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");$("#notificationButton").onclick=showNotes;$("#authForm").onsubmit=submitAuth;$("#authGoogle")?.addEventListener("click",signInWithGoogle);$("#switchAuth").onclick=()=>{S.authMode=S.authMode==="login"?"register":"login";renderAuthMode()};$$("[data-close-dialog]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.closeDialog).close());window.addEventListener("hashchange",route);window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();S.deferredInstall=e;$("#installButton").classList.remove("hidden")});$("#installButton").onclick=async()=>{if(!S.deferredInstall)return toast("استخدم خيار تثبيت التطبيق من قائمة Chrome","error");S.deferredInstall.prompt();await S.deferredInstall.userChoice;S.deferredInstall=null;$("#installButton").classList.add("hidden")}}
function setTheme(t){document.documentElement.dataset.theme=t;localStorage.theme=t;$("#themeButton").innerHTML=`<i data-lucide="${t==="dark"?"sun":"moon"}"></i>`;setTimeout(refreshIcons,0)}
function renderAuthMode(){const r=S.authMode==="register";$("#registerFields").classList.toggle("hidden",!r);$("#fullName").required=r;$("#phone").required=r;$("#authTitle").textContent=r?"إنشاء حساب جديد":"تسجيل الدخول";$("#authHint").textContent=r?"أنشئ حسابك في دقائق وابدأ الطلب مباشرة":"أدخل بياناتك للوصول إلى حسابك بسرعة";$("#authSubmit").textContent=r?"إنشاء الحساب":"دخول";$("#switchAuth").textContent=r?"لديك حساب بالفعل؟ سجل الدخول":"ليس لديك حساب؟ أنشئ حسابًا";const g=$("#authGoogleText");if(g)g.textContent=r?"المتابعة باستخدام Google":"الدخول باستخدام Google"}
async function submitAuth(e){e.preventDefault();try{const email=$("#email").value.trim(),password=$("#password").value;if(S.authMode==="register"){const fullName=$("#fullName").value.trim(),phoneRaw=$("#phone").value.trim(),phone=phoneRaw.replace(/\D/g,"");if(!fullName)return toast("الاسم الكامل مطلوب","error");if(phone.length<8)return toast("أدخل رقم واتساب صحيحًا مع مفتاح الدولة","error");const{error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName,phone}}});if(error)throw error}else{const{error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error}auth.close();toast("تمت العملية بنجاح")}catch(e){toast(e.message,"error")}}
async function signInWithGoogle(){try{const redirectTo=`${location.origin}${location.pathname}`;const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});if(error)throw error}catch(e){const m=String(e?.message||e||"");if(/provider|google|oauth/i.test(m))return toast("تأكد من تفعيل تسجيل الدخول عبر Google في إعدادات Supabase ثم أعد المحاولة","error");toast(m||"تعذر بدء تسجيل الدخول عبر Google","error")}}
async function loadIdentity(){S.profile=null;S.wallet={balance:0};if(!S.user)return;const[{data:p},{data:w}]=await Promise.all([supabase.from("profiles").select("*").eq("id",S.user.id).maybeSingle(),supabase.from("wallets").select("balance").eq("user_id",S.user.id).maybeSingle()]);S.profile=p;S.wallet=w||{balance:0}}
async function loadPublic(){const[{data:s},{data:a},{data:st}]=await Promise.all([supabase.from("store_slides").select("*").eq("is_active",true).order("sort_order"),supabase.from("announcements").select("*").eq("is_active",true).eq("kind","bar").order("created_at",{ascending:false}).limit(1),supabase.from("store_settings").select("*").limit(1).maybeSingle()]);S.slides=s||[];S.settings=st||{};applyBranding();renderFloatingContacts();const bar=$("#announcementBar");if(a?.[0]){bar.innerHTML=`${esc(a[0].message)}<button>×</button>`;bar.classList.remove("hidden");bar.classList.remove("news-enter");void bar.offsetWidth;bar.classList.add("news-enter");bar.querySelector("button").onclick=()=>bar.classList.add("hidden")}else bar.classList.add("hidden")}
async function loadNotes(){S.notes=[];if(!S.user)return;const{data}=await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(50);S.notes=data||[]}
function updateHeader(){$("#notificationButton").classList.toggle("hidden",!S.user);const n=S.notes.filter(x=>!x.is_read).length;$("#notificationCount").textContent=n;$("#notificationCount").classList.toggle("hidden",!n)}
function subscribeRealtime(){if(!S.user)return;supabase.channel(`notes-${S.user.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},async p=>{if(p.new.user_id===S.user.id||p.new.user_id===null){playNotificationSound();toast(toastNotificationMessage(p.new));await loadNotes();updateHeader()}}).subscribe();supabase.channel(`support-${S.user.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"support_messages"},async p=>{if(p.new.sender_id!==S.user.id){playChatSound(true);toast("رسالة جديدة من الدعم");renderFloatingContacts()}}).subscribe()}
function notificationTypeInfo(type){
  const map={
    order:{label:"طلب رقمي",icon:"package",tone:"digital"},
    social_order:{label:"طلب سوشل",icon:"messages-square",tone:"social"},
    wallet:{label:"محفظة",icon:"wallet-cards",tone:"finance"},
    deposit:{label:"شحن رصيد",icon:"badge-dollar-sign",tone:"finance"},
    refund:{label:"استرداد",icon:"rotate-ccw",tone:"finance"},
    recharge:{label:"بطاقة شحن",icon:"ticket-percent",tone:"finance"},
    announcement:{label:"إعلان",icon:"megaphone",tone:"general"},
    manual:{label:"إشعار يدوي",icon:"bell-ring",tone:"general"}
  };
  return map[type]||{label:"إشعار",icon:"bell",tone:"general"};
}
function notificationBuckets(){
  const notes=S.notes||[];
  const digital=notes.filter(n=>n.type==="order"&&!String(n.body||"").includes("السوشل"));
  const social=notes.filter(n=>n.type==="social_order"||String(n.title||"").includes("السوشل")||String(n.body||"").includes("السوشل"));
  const finance=notes.filter(n=>["wallet","deposit","refund","recharge"].includes(n.type));
  const general=notes.filter(n=>!digital.includes(n)&&!social.includes(n)&&!finance.includes(n));
  return {digital,social,finance,general};
}
function parseNotificationBody(body=""){
  const raw=String(body||"").trim();
  if(!raw)return {summary:"لا توجد تفاصيل إضافية.",details:[]};
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  if(lines.length===1&&!lines[0].includes(":"))return {summary:lines[0],details:[]};
  const details=[];
  let summary="";
  for(const line of lines){
    const parts=line.split(/[:：]/);
    if(parts.length>=2){
      const key=parts.shift().trim();
      const value=parts.join(":").trim();
      if(key&&value)details.push({key,value});
    }else if(!summary) summary=line;
    else details.push({key:"معلومة إضافية",value:line});
  }
  if(!summary)summary=details[0]?.value||raw;
  if(details[0]?.key==="الملخص")summary=details[0].value;
  return {summary,details};
}
function notificationPreviewText(note){
  const parsed=parseNotificationBody(note?.body||"");
  return parsed.summary||String(note?.title||"إشعار جديد");
}
function formatNotificationCard(note){
  const info=notificationTypeInfo(note.type);
  const parsed=parseNotificationBody(note.body);
  const scope=note.user_id?"موجه لحسابك":"إشعار عام";
  return `<article class="card notification-card rich ${note.is_read?"":"unread"} tone-${info.tone}">
    <div class="notification-icon"><i data-lucide="${info.icon}"></i></div>
    <div class="notification-copy">
      <div class="notification-top-row">
        <h3>${esc(note.title||"إشعار")}</h3>
        ${note.is_read?'':'<span class="mini-chip positive">جديد</span>'}
      </div>
      <div class="notification-meta-row">
        <span class="mini-chip neutral">${info.label}</span>
        <span class="mini-chip neutral">${scope}</span>
        <span class="mini-chip neutral">${dt(note.created_at)}</span>
      </div>
      <p class="notification-summary">${esc(parsed.summary)}</p>
      ${parsed.details.length?`<div class="notification-details-list">${parsed.details.map(item=>`<div class="notification-detail-item"><small>${esc(item.key)}</small><strong>${esc(item.value)}</strong></div>`).join("")}</div>`:""}
    </div>
  </article>`;
}
function toastNotificationMessage(note){
  const info=notificationTypeInfo(note?.type);
  return `${note?.title||info.label} — ${notificationPreviewText(note)}`;
}
async function showNotes(){
  if(!needUser())return;
  const {digital,social,finance,general}=notificationBuckets();
  const tabs=[
    {key:"digital",label:"المنتجات",icon:"package",items:digital},
    {key:"social",label:"السوشل",icon:"messages-square",items:social},
    {key:"finance",label:"المالية",icon:"wallet-cards",items:finance},
    {key:"general",label:"عامة",icon:"bell",items:general}
  ];
  const unread=S.notes.filter(n=>!n.is_read).length;
  const renderList=items=>items.length?items.map(formatNotificationCard).join(""):empty("لا توجد إشعارات","ستظهر هنا كل تفاصيل العمليات الجديدة.","bell");
  openModal(`<div class="sheet-head"><div><h2>الإشعارات</h2><p>تفاصيل أوضح لكل عملية بدل الرسائل المختصرة المبهمة</p></div><button data-close>×</button></div>
    <div class="notes-summary-grid">${tabs.map(tab=>`<div class="card note-summary-card ${tab.key}"><span><i data-lucide="${tab.icon}"></i></span><strong>${tab.items.length}</strong><small>${tab.label}</small></div>`).join("")}</div>
    <div class="notes-actions-row"><span class="mini-chip ${unread?"positive":"neutral"}">${unread} غير مقروء</span></div>
    <div class="tabs notification-tabs">${tabs.map((tab,i)=>`<button class="tab ${i===0?"active":""}" data-note-tab="${tab.key}"><i data-lucide="${tab.icon}"></i> ${tab.label} <span>${tab.items.length}</span></button>`).join("")}</div>
    ${tabs.map((tab,i)=>`<div id="note${tab.key}" class="list ${i?"hidden":""}">${renderList(tab.items)}</div>`).join("")}`);
  $$("[data-note-tab]",modal).forEach(b=>b.onclick=()=>{
    $$("[data-note-tab]",modal).forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    tabs.forEach(tab=>$("#note"+tab.key,modal).classList.toggle("hidden",b.dataset.noteTab!==tab.key));
  });
  const ids=S.notes.filter(n=>!n.is_read&&n.user_id===S.user.id).map(n=>n.id);
  if(ids.length){
    await supabase.from("notifications").update({is_read:true}).in("id",ids);
    await loadNotes();
    updateHeader();
  }
  refreshIcons();
}
function route(){const r=location.hash.replace("#/","").split("?")[0]||"home";$$("[data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===r));$("#pageTitle").textContent={home:"الرئيسية",products:"المنتجات والخدمات","digital-products":"المنتجات الرقمية","social-services":"خدمات السوشل ميديا",orders:"طلباتي",wallet:"المحفظة",account:"حسابي",admin:"لوحة الإدارة"}[r]||"علي شوب";({home,products,"digital-products":digitalProducts,"social-services":socialServices,orders,wallet,account,admin}[r]||home)();setTimeout(refreshIcons,0)}
async function catalog(){const[{data:p},{data:c}]=await Promise.all([supabase.from("products_with_stock").select("*").eq("is_active",true).order("created_at",{ascending:false}),supabase.from("categories").select("*").eq("is_active",true).order("sort_order")]);S.products=p||[];S.categories=c||[]}

function pcard(p){
  const sold=p.availability_status==="sold_out";
  return `<article class="catalog-image-card ${sold?"soldout":""}" data-product="${p.id}" role="button" tabindex="0">
    ${sold?'<div class="soldout-ribbon">نفد المخزون</div>':""}
    <div class="catalog-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:`<div class="image-fallback"><i data-lucide="package-open"></i></div>`}</div>
    <div class="catalog-overlay">
      <span class="catalog-category">${esc(p.category_name||"منتج رقمي")}</span>
      <h3>${esc(p.name)}</h3>
      <div class="catalog-meta"><strong>${money(p.price)}</strong><span><i data-lucide="arrow-up-left"></i></span></div>
    </div>
    <button class="favorite-btn" data-favorite="${p.id}" aria-label="المفضلة"><i data-lucide="heart"></i></button>
  </article>`;
}
function bindProducts(){
  $$("[data-product]").forEach(card=>{
    card.onclick=e=>{if(e.target.closest("[data-favorite]"))return;details(card.dataset.product)};
    card.onkeydown=e=>{if(e.key==="Enter")details(card.dataset.product)};
  });
  $$("[data-favorite]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.favorite)});
  refreshIcons();
}
async function home(){await catalog();const slides=S.slides.length?S.slides:[{title:"كل ما تحتاجه رقميًا",subtitle:"اشحن محفظتك واشترِ بسهولة",button_text:"تصفح المنتجات",button_url:"#/products"}];app.innerHTML=`<div class="hero-slider">${slides.map((s,i)=>`<section class="slide ${i===0?"active":""}" style="${s.image_url?`background-image:linear-gradient(90deg,rgba(23,19,55,.72),rgba(23,19,55,.25)),url('${esc(s.image_url)}')`:""}"><div class="slide-overlay"><span class="badge">علي شوب</span><h1>${esc(s.title)}</h1><p>${esc(s.subtitle||"")}</p><a class="btn primary" href="${esc(s.button_url||"#/products")}">${esc(s.button_text||"استكشف")}</a></div></section>`).join("")}<div class="dots">${slides.map((_,i)=>`<button class="dot ${i===0?"active":""}" data-slide="${i}"></button>`).join("")}</div></div><div class="wallet-strip">
  <div class="wallet-main"><span class="wallet-icon"><i data-lucide="wallet-cards"></i></span><div><small>الرصيد المتاح</small><strong>${money(S.wallet.balance)}</strong></div></div>
  <a href="#/wallet" class="wallet-charge-btn"><i data-lucide="plus"></i><span>شحن</span></a>
</div>${section("خدمات السوشل ميديا","خدمات السوشل ميديا",`<a class="btn soft" href="#/social-services"><i data-lucide="rocket"></i> عرض الخدمات</a>`)}<div class="card item"><div class="item-main"><h3>خدمات السوشل ميديا سريعة</h3><p>متابعون، مشاهدات وتفاعل مع متابعة الطلب.</p></div><a href="#/social-services" class="icon-action"><i data-lucide="arrow-left"></i></a></div>${section("منتجات مميزة","أحدث المنتجات المتاحة")}<div class="grid">${S.products.slice(0,6).map(pcard).join("")||empty("لا توجد منتجات")}</div>`;let cur=0,els=$$(".slide"),dots=$$(".dot");const go=i=>{const prev=cur;els[prev].classList.remove("active");els[prev].classList.add("leaving");dots[prev].classList.remove("active");cur=i;els[cur].classList.add("active");dots[cur].classList.add("active");setTimeout(()=>els[prev].classList.remove("leaving"),650)};dots.forEach(d=>d.onclick=()=>go(+d.dataset.slide));if(els.length>1)setInterval(()=>go((cur+1)%els.length),5000);bindProducts()}
async function products(){
  const initial=new URLSearchParams(location.hash.split("?")[1]||"").get("tab")||"digital";
  S.productMode=initial;
  const drawShell=()=>{
    app.innerHTML=`${section("المنتجات والخدمات","اختر النوع من الشريط العلوي")}
    <div class="catalog-top-tabs">
      <button class="${S.productMode==="digital"?"active":""}" data-catalog-tab="digital"><i data-lucide="package-open"></i><span>منتجات رقمية</span></button>
      <button class="${S.productMode==="social"?"active":""}" data-catalog-tab="social"><i data-lucide="messages-square"></i><span>خدمات السوشل ميديا</span></button>
    </div>
    <div id="catalogDynamic" class="catalog-dynamic"></div>`;
    $$("[data-catalog-tab]").forEach(b=>b.onclick=()=>{S.productMode=b.dataset.catalogTab;drawShell();renderCatalogTab()});
    renderCatalogTab();refreshIcons();
  };
  const renderCatalogTab=()=>S.productMode==="digital"?renderDigitalInside():renderSocialInside();
  const renderDigitalInside=async()=>{
    await catalog();
    const{data:cats}=await supabase.from("categories").select("*").eq("is_active",true).order("sort_order");
    const categories=cats||[],roots=categories.filter(c=>!c.parent_id);
    $("#catalogDynamic").innerHTML=`${roots.length?`<div class="category-strip">${roots.map(c=>`<button class="category-pill" data-root-category="${c.id}">${c.image_url?`<img src="${esc(c.image_url)}">`:`<i data-lucide="folder-open"></i>`}<span>${esc(c.name)}</span></button>`).join("")}</div>`:""}
    <div class="search-row compact-search"><input id="search" class="input" placeholder="بحث في المنتجات..."><select id="cat" class="input"><option value="">الكل</option>${categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
    <div id="pgrid" class="catalog-image-grid">${S.products.map(pcard).join("")||empty("لا توجد منتجات")}</div>`;
    let selectedRoot="";
    const draw=()=>{const q=$("#search").value.toLowerCase(),cat=$("#cat").value;const allowed=selectedRoot?[selectedRoot,...categories.filter(c=>c.parent_id===selectedRoot).map(c=>c.id)]:null;const list=S.products.filter(p=>(!cat||p.category_id===cat)&&(!allowed||allowed.includes(p.category_id))&&(`${p.name} ${p.description||""}`).toLowerCase().includes(q));$("#pgrid").innerHTML=list.map(pcard).join("")||empty("لا توجد نتائج");bindProducts()};
    $$("[data-root-category]").forEach(b=>b.onclick=()=>{$$("[data-root-category]").forEach(x=>x.classList.remove("active"));if(selectedRoot===b.dataset.rootCategory){selectedRoot="";}else{selectedRoot=b.dataset.rootCategory;b.classList.add("active")}draw()});
    $("#search").oninput=draw;$("#cat").onchange=draw;bindProducts();refreshIcons();
  };
  const renderSocialInside=async()=>{
    if(!S.user){$("#catalogDynamic").innerHTML=empty("خدمات السوشل ميديا","سجل الدخول للطلب");return}
    const[{data:platforms},{data:services}]=await Promise.all([
      supabase.from("social_platforms").select("*").eq("is_active",true).order("sort_order"),
      supabase.from("smm_services").select("*,platform:social_platforms(name,icon)").eq("is_active",true).order("sort_order")
    ]);
    const ps=platforms||[],all=services||[];let platformId=ps[0]?.id;
    $("#catalogDynamic").innerHTML=`<div class="official-order-card compact-social">
      <div class="platform-picker">${ps.map((p,i)=>`<button class="platform-choice ${i===0?"active":""}" data-platform="${p.id}"><i data-lucide="${p.icon||"circle"}"></i><span>${esc(p.name)}</span></button>`).join("")}</div>
      <div class="social-form-grid"><label>الفئة<select id="socialCategorySelect"></select></label><label>الخدمة<select id="socialServiceSelect"></select></label></div>
      <div id="serviceInfo" class="service-info-card"></div>
      <form id="officialSocialForm"><label>الرابط<input id="socialTarget" type="url" placeholder="https://..." required></label><div class="social-form-grid"><label>الكمية<input id="socialQuantity" type="number" required></label><div id="socialCalculation" class="calculation-card"></div></div><label>ملاحظات<textarea id="socialNotes" placeholder="اختياري"></textarea></label><button class="btn primary block"><i data-lucide="shopping-cart"></i> تأكيد الطلب</button></form>
    </div>`;
    const byPlatform=()=>all.filter(s=>s.platform_id===platformId);
    const selectedService=()=>all.find(s=>s.id===$("#socialServiceSelect").value);
    const updateCategories=()=>{const cats=[...new Set(byPlatform().map(s=>s.service_category||"خدمات عامة"))];$("#socialCategorySelect").innerHTML=cats.map(c=>`<option>${esc(c)}</option>`).join("");updateServices()};
    const updateServices=()=>{const cat=$("#socialCategorySelect").value,list=byPlatform().filter(s=>(s.service_category||"خدمات عامة")===cat);$("#socialServiceSelect").innerHTML=list.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");updateInfo()};
    const updateCalc=()=>{const s=selectedService(),q=+$("#socialQuantity").value||0;if(!s)return;$("#socialCalculation").innerHTML=`<small>الإجمالي</small><strong>${money((q/1000)*s.price_per_1000)}</strong>`};
    const updateInfo=()=>{const s=selectedService();if(!s){$("#serviceInfo").innerHTML=empty("لا توجد خدمات");return}$("#serviceInfo").innerHTML=`<div class="service-info-head"><span class="service-platform-icon"><i data-lucide="${s.platform?.icon||"circle"}"></i></span><div><h3>${esc(s.name)}</h3><p>${esc(s.description||"")}</p></div></div><div class="service-stat-row"><span>الأدنى <b>${s.min_quantity}</b></span><span>الأقصى <b>${s.max_quantity}</b></span><span>1000 / <b>${money(s.price_per_1000)}</b></span></div>`;$("#socialQuantity").min=s.min_quantity;$("#socialQuantity").max=s.max_quantity;$("#socialQuantity").value=s.min_quantity;updateCalc();refreshIcons()};
    $$(".platform-choice").forEach(b=>b.onclick=()=>{$$(".platform-choice").forEach(x=>x.classList.remove("active"));b.classList.add("active");platformId=b.dataset.platform;updateCategories()});
    $("#socialCategorySelect").onchange=updateServices;$("#socialServiceSelect").onchange=updateInfo;$("#socialQuantity").oninput=updateCalc;updateCategories();
    $("#officialSocialForm").onsubmit=async e=>{e.preventDefault();const s=selectedService();if(!s)return;const{error}=await supabase.rpc("create_smm_order",{p_service_id:s.id,p_target_url:$("#socialTarget").value,p_quantity:+$("#socialQuantity").value,p_notes:$("#socialNotes").value||null});if(error)return toast(error.message,"error");toast("تم إنشاء طلب السوشل ميديا");location.hash="#/orders?tab=social"};
    refreshIcons();
  };
  drawShell();
}
async function digitalProducts(){location.hash="#/products?tab=digital"}
function details(id){const p=S.products.find(x=>String(x.id)===String(id)),sold=p.availability_status==="sold_out",fields=p.required_fields||[];openModal(`<div class="sheet-head"><div><h2>${esc(p.name)}</h2><p>${sold?"نفد المخزون":"متوفر الآن"}</p></div><button data-close>×</button></div><div class="product-image" style="height:230px;border-radius:19px">${p.image_url?`<img src="${esc(p.image_url)}">`:"🛍️"}</div><p style="line-height:1.9;color:var(--m)">${esc(p.description||"")}</p>${fields.map((f,i)=>`<label>${esc(f.label)}${f.required?" *":""}<input data-order-field="${i}" data-field-label="${esc(f.label)}" type="${f.type==="url"?"url":f.type==="number"?"number":"text"}" ${f.required?"required":""}></label>`).join("")}<label>كوبون الخصم<input id="couponCode" placeholder="اكتب رمز الكوبون"></label><div id="couponPreview" class="coupon-preview hidden"></div><div class="product-foot"><span class="price">${money(p.price)}</span><button id="buy" class="btn ${sold?"soft":"primary"}" ${sold?"disabled":""}>${sold?"غير متوفر حاليًا":"شراء الآن"}</button></div>`);if(!sold)$("#buy").onclick=()=>buy(p);$("#couponCode").oninput=debounce(()=>previewCoupon($("#couponCode").value.trim(),p),350)}
async function buy(p){if(!needUser()||!confirm(`شراء ${p.name}؟`))return;const code=$("#couponCode")?.value.trim()||null;const customerData={};$$(`[data-order-field]`,modal).forEach(x=>customerData[x.dataset.fieldLabel]=x.value.trim());const{error}=await supabase.rpc("purchase_product_v6",{p_product_id:p.id,p_idempotency_key:crypto.randomUUID(),p_coupon_code:code,p_customer_data:customerData});if(error)return toast(error.message,"error");toast("تم الشراء");closeModal();await loadIdentity();location.hash="#/orders"}
async function orders(){
  if(!needUser())return app.innerHTML=empty("طلباتي","سجل الدخول");
  const initial=new URLSearchParams(location.hash.split("?")[1]||"").get("tab")||S.orderTab||"digital";
  S.orderTab=initial;
  const[{data:digital},{data:social}]=await Promise.all([
    supabase.from("orders").select("*,product:products(name,image_url)").order("created_at",{ascending:false}),
    supabase.from("smm_orders").select("*,service:smm_services(name,platform:social_platforms(name,icon))").order("created_at",{ascending:false})
  ]);
  const draw=()=>{
    const isDigital=S.orderTab==="digital";
    app.innerHTML=`${section("طلباتي","طلبات المنتجات الرقمية وخدمات السوشل ميديا")}
    <div class="segmented-control"><button class="${isDigital?"active":""}" data-order-tab="digital"><i data-lucide="package-open"></i> منتجات رقمية <span>${(digital||[]).length}</span></button><button class="${!isDigital?"active":""}" data-order-tab="social"><i data-lucide="messages-square"></i> طلبات السوشل <span>${(social||[]).length}</span></button></div>
    <div class="list" style="margin-top:14px">${isDigital?((digital||[]).map(o=>`<div class="card item"><div class="order-thumb">${o.product?.image_url?`<img src="${esc(o.product.image_url)}">`:`<i data-lucide="package"></i>`}</div><div class="item-main"><h3>${esc(o.product?.name||"-")}</h3><p>${esc(o.order_number)} • ${money(o.total)}</p></div><div class="item-actions">${badge(o.status)}${iconButton("eye","التفاصيل",`data-digital-order="${o.id}"`)}</div></div>`).join("")||empty("لا توجد طلبات منتجات")):((social||[]).map(o=>`<div class="card item"><div class="order-thumb social"><i data-lucide="${o.service?.platform?.icon||"messages-square"}"></i></div><div class="item-main"><h3>${esc(o.service?.name||"-")}</h3><p>${esc(o.order_number)} • ${o.quantity} • ${money(o.total)}</p></div><div class="item-actions">${badge(o.status)}${iconButton("eye","التفاصيل",`data-social-order="${o.id}"`)}</div></div>`).join("")||empty("لا توجد طلبات سوشل ميديا"))}</div>`;
    $$("[data-order-tab]").forEach(b=>b.onclick=()=>{S.orderTab=b.dataset.orderTab;draw()});
    $$("[data-digital-order]").forEach(b=>b.onclick=()=>{const o=(digital||[]).find(x=>x.id===b.dataset.digitalOrder);openModal(`<div class="sheet-head"><h2>${esc(o.order_number)}</h2><button data-close>×</button></div><p>${badge(o.status)}</p><div class="note">${esc(o.delivery_data||"لم يتم التسليم بعد")}</div>`)});
    $$("[data-social-order]").forEach(b=>b.onclick=()=>{const o=(social||[]).find(x=>x.id===b.dataset.socialOrder);openModal(`<div class="sheet-head"><h2>${esc(o.order_number)}</h2><button data-close>×</button></div><div class="note">الخدمة: ${esc(o.service?.name||"-")}<br>الرابط: ${esc(o.target_url)}<br>الكمية: ${o.quantity}<br>الحالة: ${badge(o.status)}${o.admin_note?`<br>ملاحظة الإدارة: ${esc(o.admin_note)}`:""}</div>`)});
    refreshIcons();
  };draw();
}

async function wallet(){
  if(!needUser())return app.innerHTML=empty("المحفظة","سجل الدخول");
  const[{data:t},{data:d}]=await Promise.all([
    supabase.from("wallet_transactions").select("*").order("created_at",{ascending:false}).limit(300),
    supabase.from("deposit_requests").select("*,payment_method:payment_methods(name)").order("created_at",{ascending:false})
  ]);
  const tx=t||[];
  const draw=()=>{
    const rows=tx.filter(x=>!S.walletType||x.type===S.walletType);
    app.innerHTML=`${section("المحفظة","الرصيد والحركات المالية",`<button id="deposit" class="btn primary"><i data-lucide="plus"></i> شحن</button>`)}
    <div class="stats"><div class="card stat"><small>الرصيد</small><strong>${money(S.wallet.balance)}</strong></div><div class="card stat"><small>طلبات الشحن</small><strong>${(d||[]).length}</strong></div></div>
    <div class="card item" style="margin-top:10px"><div class="item-main"><h3>استخدام بطاقة شحن</h3><p>أدخل الرمز لإضافة الرصيد</p></div><button id="redeemCard" class="icon-action"><i data-lucide="scan-line"></i></button></div>
    ${section("الحركات المالية","فرز حسب نوع العملية")}
    <div class="wallet-filter-tabs"><button class="${!S.walletType?"active":""}" data-wallet-type="">الكل</button><button class="${S.walletType==="purchase"?"active":""}" data-wallet-type="purchase">مشتريات</button><button class="${S.walletType==="refund"?"active":""}" data-wallet-type="refund">استرداد</button><button class="${S.walletType==="deposit"?"active":""}" data-wallet-type="deposit">شحن</button><button class="${S.walletType==="recharge_card"?"active":""}" data-wallet-type="recharge_card">بطاقات</button></div>
    <div class="list">${rows.map(x=>`<div class="card item"><div class="transaction-icon ${Number(x.amount)>=0?"in":"out"}"><i data-lucide="${Number(x.amount)>=0?"arrow-down-left":"arrow-up-right"}"></i></div><div class="item-main"><h3>${esc(x.description||x.type)}</h3><p>${dt(x.created_at)}</p></div><strong class="${Number(x.amount)>=0?"amount-in":"amount-out"}">${Number(x.amount)>=0?"+":""}${money(x.amount)}</strong></div>`).join("")||empty("لا توجد حركات")}</div>`;
    $("#deposit").onclick=depositForm;
    $("#redeemCard").onclick=async()=>{const code=prompt("أدخل رمز بطاقة الشحن:");if(!code)return;const{data,error}=await supabase.rpc("redeem_recharge_card",{p_code:code.trim()});if(error)return toast(error.message,"error");toast(data.message||"تم شحن الرصيد");await loadIdentity();wallet()};
    $$("[data-wallet-type]").forEach(b=>b.onclick=()=>{S.walletType=b.dataset.walletType;draw()});
    refreshIcons();
  };draw();
}
async function depositForm(){const{data}=await supabase.from("payment_methods").select("*").eq("is_active",true).order("sort_order"),m=data||[];if(!m.length)return toast("لا توجد طرق دفع","error");openModal(`<div class="sheet-head"><h2>طلب شحن</h2><button data-close>×</button></div><form id="df"><label>طريقة الدفع<select id="method">${m.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>المبلغ<input id="amount" type="number" min="1" required></label><label>رقم التحويل<input id="ref" required></label><label>إثبات الدفع${imagePicker("receiptFile")}</label><button id="depositSubmit" class="btn primary block">إرسال</button></form>`);$("#df").onsubmit=async e=>{e.preventDefault();const btn=$("#depositSubmit");btn.disabled=true;try{const receipt=await uploadFile($("#receiptFile").files[0],"receipts");const{error}=await supabase.from("deposit_requests").insert({user_id:S.user.id,payment_method_id:$("#method").value,amount:+$("#amount").value,transfer_reference:$("#ref").value,receipt_url:receipt});if(error)throw error;toast("تم إرسال الطلب");closeModal();wallet()}catch(err){toast(err.message,"error")}finally{btn.disabled=false}}}
async function socialServices(){location.hash="#/products?tab=social"}
function smmOrderForm(){location.hash="#/social-services"}
function account(){if(!S.user){app.innerHTML=`${section("حسابي","سجل الدخول")}<div class="card empty"><h2>أهلًا بك</h2><button id="openAuth" class="btn primary">تسجيل الدخول</button></div>`;$("#openAuth").onclick=()=>auth.showModal();return}app.innerHTML=`${section("حسابي","المعلومات والإعدادات")}<div class="card item"><div class="item-main"><h3>${esc(S.profile?.full_name||"مستخدم")}</h3><p>${esc(S.user.email)}</p></div>${badge(S.profile?.status)}</div>${S.profile?.role==="admin"?`<a href="#/admin" class="card item" style="margin-top:11px"><div class="item-main"><h3>لوحة الإدارة</h3><p>إدارة المتجر بالكامل</p></div><span>›</span></a>`:""}<button id="logout" class="card item" style="width:100%;margin-top:11px;color:var(--bad)"><h3>تسجيل الخروج</h3></button>`;$("#logout").onclick=()=>supabase.auth.signOut()}

/* ---------- ADMIN ---------- */
async function admin(){if(!needAdmin())return;if(S.adminGroup==="dashboard"){app.innerHTML=`${section("لوحة الإدارة","اختر القسم المطلوب")}<div class="admin-groups">${[["sales","المبيعات","الطلبات والإلغاء والاسترداد"],["catalog","الكتالوج","المنتجات والتصنيفات والمخزون"],["finance","الأموال","الشحن وطرق الدفع والبطاقات والكوبونات"],["users","المستخدمون","الحسابات والأرصدة والحظر"],["marketing","التسويق","السلايدر والإعلانات والإشعارات"],["system","النظام","إعدادات المتجر والسجلات"]].map(([id,t,p])=>`<button class="card admin-tile" data-group="${id}"><span class="tile-icon"><i data-lucide="${ADMIN_ICONS[id]||"circle-dot"}"></i>${adminBadge(id)}</span><h3>${t}</h3><p>${p}</p></button>`).join("")}</div>`;$$("[data-group]").forEach(b=>b.onclick=()=>{S.adminGroup=b.dataset.group;S.adminPage={sales:"orders",catalog:"catalog_items",finance:"deposits",users:"users",marketing:"slides",system:"settings"}[S.adminGroup];S.page=1;S.query="";S.filter="";admin()});return}const pages={sales:[["orders","الطلبات"],["cancel_requests","طلبات الإلغاء"]],catalog:[["catalog_items","الكتالوج"],["categories","التصنيفات"],["inventory","المخزون"]],finance:[["deposits","طلبات الشحن"],["transactions","الحركات المالية"],["payment_methods","طرق الدفع"],["cards","بطاقات الشحن"],["coupons","الكوبونات"]],users:[["users","المستخدمون"]],marketing:[["slides","السلايدر"],["announcements","الإعلانات"],["notifications","الإشعارات"]],system:[["settings","الإعدادات"],["support","الدعم"],["logs","سجل المدير"]]}[S.adminGroup];app.innerHTML=`${section("لوحة الإدارة",S.adminGroup,`<button id="backAdmin" class="btn soft">الرئيسية</button>`)}<div class="tabs">${pages.map(([id,n])=>`<button class="tab ${S.adminPage===id?"active":""}" data-admin-page="${id}">${n}${adminBadge(id)}</button>`).join("")}</div><div id="adminContent"></div>`;$("#backAdmin").onclick=()=>{S.adminGroup="dashboard";admin()};$$("[data-admin-page]").forEach(b=>b.onclick=()=>{S.adminPage=b.dataset.adminPage;S.page=1;S.query="";S.filter="";renderAdminPage()});renderAdminPage()}
function renderAdminPage(){({orders:adminOrders,cancel_requests:adminCancelRequests,catalog_items:adminCatalogItems,products:adminProducts,categories:adminCategories,inventory:adminInventory,deposits:adminDeposits,transactions:adminTransactions,payment_methods:adminPaymentMethods,cards:adminCards,coupons:adminCoupons,users:adminUsers,slides:adminSlides,announcements:adminAnnouncements,notifications:adminNotifications,settings:adminSettings,support:adminSupport,logs:adminLogs}[S.adminPage]||adminOrders)()}
async function listQuery(table,select="*",filterFn=null){let q=supabase.from(table).select(select,{count:"exact"}).order("created_at",{ascending:false});if(filterFn)q=filterFn(q);const from=(S.page-1)*CONFIG.PAGE_SIZE,to=from+CONFIG.PAGE_SIZE-1;return await q.range(from,to)}
function bindAdminSearch(render,filterOptions=[]){const s=$("#adminSearch"),f=$("#adminFilter");if(f&&filterOptions.length)f.innerHTML=`<option value="">الكل</option>${filterOptions.map(([v,n])=>`<option value="${v}" ${S.filter===v?"selected":""}>${n}</option>`).join("")}`;if(s)s.oninput=debounce(()=>{S.query=s.value.trim();S.page=1;render()});if(f)f.onchange=()=>{S.filter=f.value;S.page=1;render()};$("#clearFilters").onclick=()=>{S.query="";S.filter="";S.page=1;render()}}

async function adminOrders(){
  const mode=S.orderTab||"digital";
  const [{data:digital},{data:social}]=await Promise.all([
    supabase.from("orders").select("*,product:products(name),profile:profiles(full_name,phone)").order("created_at",{ascending:false}).limit(500),
    supabase.from("smm_orders").select("*,service:smm_services(name,platform:social_platforms(name,icon)),profile:profiles(full_name,phone)").order("created_at",{ascending:false}).limit(500)
  ]);
  const render=()=>{
    const isDigital=S.orderTab!=="social";
    const source=(isDigital?digital:social)||[];
    const rows=source.filter(o=>{
      const uname=(o.profile?.full_name||"").toLowerCase();
      const text=isDigital?`${o.order_number} ${o.product?.name||""}`:`${o.order_number} ${o.service?.name||""} ${o.target_url||""}`;
      return (!S.query||text.toLowerCase().includes(S.query.toLowerCase())) &&
             (!S.adminUserFilter||uname.includes(S.adminUserFilter.toLowerCase())) &&
             (!S.filter||o.status===S.filter);
    });
    $("#adminContent").innerHTML=`${section("الطلبات","كل الطلبات في مكان واحد",`<button id="exportOrders" class="btn soft"><i data-lucide="download"></i> CSV</button>`)}
    <div class="catalog-admin-tabs"><button class="${isDigital?"active":""}" data-order-admin-tab="digital"><i data-lucide="package"></i><span>منتجات رقمية</span><b>${(digital||[]).length}</b></button><button class="${!isDigital?"active":""}" data-order-admin-tab="social"><i data-lucide="messages-square"></i><span>منتجات السوشل</span><b>${(social||[]).length}</b></button></div>
    <div class="catalog-filter-bar">
      <input id="adminOrderSearch" class="input" placeholder="بحث في الطلبات..." value="${esc(S.query||"")}">
      <input id="adminOrderUser" class="input" placeholder="اسم المستخدم" value="${esc(S.adminUserFilter||"")}">
      <select id="adminOrderStatus" class="input"><option value="">كل الحالات</option><option value="pending">معلق</option><option value="processing">قيد التنفيذ</option><option value="delivered">مكتمل</option><option value="cancelled">ملغي</option><option value="refunded">مسترد</option></select>
    </div>
    <div class="list">${rows.map(o=>isDigital?`<div class="card item"><div class="item-main"><h3>${esc(o.product?.name||"-")}</h3><p>${esc(o.profile?.full_name||"-")} • ${esc(o.order_number)} • ${money(o.total)}</p></div><div class="item-actions">${badge(o.status)}${iconButton("settings-2","إدارة",`data-order-manage="${o.id}"`)}</div></div>`:`<div class="card item"><div class="platform-list-icon"><i data-lucide="${o.service?.platform?.icon||"messages-square"}"></i></div><div class="item-main"><h3>${esc(o.service?.name||"-")}</h3><p>${esc(o.profile?.full_name||"-")} • ${esc(o.order_number)} • ${o.quantity}</p></div><div class="item-actions">${badge(o.status)}${iconButton("settings-2","إدارة",`data-social-manage="${o.id}"`)}</div></div>`).join("")||empty("لا توجد نتائج")}</div>`;
    $("#adminOrderStatus").value=S.filter||"";
    $$("[data-order-admin-tab]").forEach(b=>b.onclick=()=>{S.orderTab=b.dataset.orderAdminTab;S.query="";S.filter="";render()});
    $("#adminOrderSearch").oninput=debounce(()=>{S.query=$("#adminOrderSearch").value.trim();render()},220);
    $("#adminOrderUser").oninput=debounce(()=>{S.adminUserFilter=$("#adminOrderUser").value.trim();render()},220);
    $("#adminOrderStatus").onchange=()=>{S.filter=$("#adminOrderStatus").value;render()};
    $("#exportOrders").onclick=()=>exportCsv(isDigital?"orders":"smm_orders",isDigital?"digital-orders.csv":"social-orders.csv");
    $$("[data-order-manage]").forEach(b=>b.onclick=()=>manageOrder((digital||[]).find(x=>x.id===b.dataset.orderManage)));
    $$("[data-social-manage]").forEach(b=>b.onclick=()=>manageSmmOrder((social||[]).find(x=>x.id===b.dataset.socialManage)));
    refreshIcons();
  };render();
}
function manageOrder(o){openModal(`<div class="sheet-head"><div><h2>${esc(o.order_number)}</h2><p>${esc(o.profile?.full_name||"-")} • ${esc(o.profile?.phone||"-")}</p></div><button data-close>×</button></div><div class="note">المنتج: ${esc(o.product?.name||"-")}<br>القيمة: ${money(o.total)}<br>الحالة: ${badge(o.status)}</div><form id="orderAdminForm" style="margin-top:14px"><label>بيانات التسليم<textarea id="delivery">${esc(o.delivery_data||"")}</textarea></label><label>الإجراء<select id="orderStatus"><option value="processing">قيد التنفيذ</option><option value="delivered">تم التسليم</option><option value="cancelled">إلغاء وإعادة الرصيد</option><option value="refunded">استرداد الرصيد</option></select></label><label>سبب العملية<textarea id="orderReason"></textarea></label><button class="btn primary block">حفظ</button></form>`);$("#orderAdminForm").onsubmit=async e=>{e.preventDefault();const{error}=await supabase.rpc("admin_process_order",{p_order_id:o.id,p_status:$("#orderStatus").value,p_delivery_data:$("#delivery").value||null,p_reason:$("#orderReason").value||null});if(error)return toast(error.message,"error");toast("تم تحديث الطلب");closeModal();adminOrders()}}
async function adminCancelRequests(){const{data,count,error}=await listQuery("order_cancel_requests","*,order:orders(order_number,total,status),profile:profiles!order_cancel_requests_user_id_fkey(full_name)",q=>{if(S.filter)q=q.eq("status",S.filter);return q});if(error){console.error('cancel_requests load error:',error);toast("تعذر تحميل طلبات الإلغاء: "+error.message,"error")}const r=data||[];$("#adminContent").innerHTML=`${adminHeader("طلبات الإلغاء","مراجعة طلبات العملاء")}<div class="list">${r.map(x=>`<div class="card item"><div class="item-main"><h3>${esc(x.order?.order_number||"-")}</h3><p>${esc(x.profile?.full_name||"-")} • ${esc(x.reason)}</p></div><div class="item-actions">${badge(x.status)}${x.status==="pending"?`<button class="success" data-cancel-approve="${x.id}">قبول</button><button class="danger" data-cancel-reject="${x.id}">رفض</button>`:""}</div></div>`).join("")||empty("لا توجد طلبات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminCancelRequests,[["pending","معلق"],["approved","مقبول"],["rejected","مرفوض"]]);bindPager(adminCancelRequests);$$("[data-cancel-approve]").forEach(b=>b.onclick=()=>reviewCancel(b.dataset.cancelApprove,true));$$("[data-cancel-reject]").forEach(b=>b.onclick=()=>reviewCancel(b.dataset.cancelReject,false))}
async function reviewCancel(id,approve){const reason=approve?"قبول طلب الإلغاء":prompt("سبب الرفض:");if(!approve&&!reason)return;let{error}=await supabase.rpc("admin_review_cancel_request",{p_request_id:id,p_approve:approve,p_reason:reason});if(error&&/schema cache|could not find the function/i.test(error.message||"")){error=null;const{data:reqRow}=await supabase.from("order_cancel_requests").select("order_id,user_id").eq("id",id).maybeSingle();if(approve&&reqRow&&reqRow.order_id){const r=await supabase.rpc("admin_process_order",{p_order_id:reqRow.order_id,p_status:"cancelled",p_delivery_data:null,p_reason:reason});if(r.error)error=r.error}if(!error){const u=await supabase.from("order_cancel_requests").update({status:approve?"approved":"rejected"}).eq("id",id).select("id");if(u.error)error=u.error;else if(!(u.data||[]).length)error={message:"تم تنفيذ العملية لكن تعذر تحديث حالة الطلب — شغّل ملف supabase/HOTFIX_admin_review_cancel_request.sql في SQL Editor لإصلاح جذري"}}}if(error)return toast(error.message,"error");toast("تمت معالجة الطلب");adminCancelRequests()}

async function adminCatalogItems(){
  const digitalQuery=supabase.from("products_with_stock").select("*",{count:"exact"}).order("created_at",{ascending:false});
  const socialQuery=supabase.from("smm_services").select("*,platform:social_platforms(name,icon)",{count:"exact"}).order("created_at",{ascending:false});
  const [digitalResult,socialResult]=await Promise.all([
    digitalQuery.range(0,999),
    socialQuery.range(0,999)
  ]);
  if(digitalResult.error||socialResult.error){
    $("#adminContent").innerHTML=`${section("الكتالوج الموحد","تعذر تحميل بيانات الكتالوج")}
      <div class="card empty"><h2>حدث خطأ في قاعدة البيانات</h2><p>${esc(friendlyError(digitalResult.error||socialResult.error))}</p><button id="retryCatalog" class="btn primary">إعادة المحاولة</button></div>`;
    $("#retryCatalog").onclick=adminCatalogItems;
    refreshIcons();
    return;
  }
  const {data:digital,count:digitalCount}=digitalResult;
  const {data:social,count:socialCount}=socialResult;

  const render=()=>{
    const isDigital=S.filter!=="social";
    const digitalRows=(digital||[]).filter(x=>{
      const text=`${x.name} ${x.description||""}`.toLowerCase();
      return (!S.query||text.includes(S.query.toLowerCase())) &&
             (!S.catalogStatus||x.availability_status===S.catalogStatus) &&
             (!S.catalogCategory||x.category_id===S.catalogCategory);
    });
    const socialRows=(social||[]).filter(x=>{
      const text=`${x.name} ${x.description||""} ${x.platform?.name||""} ${x.service_category||""}`.toLowerCase();
      return (!S.query||text.includes(S.query.toLowerCase())) &&
             (!S.catalogStatus||String(x.is_active)===(S.catalogStatus==="active"?"true":"false")) &&
             (!S.catalogPlatform||x.platform_id===S.catalogPlatform);
    });

    $("#adminContent").innerHTML=`${section("الكتالوج الموحد","إدارة المنتجات الرقمية ومنتجات السوشل ميديا من مكان واحد",`<button id="addCatalogItem" class="btn primary"><i data-lucide="plus"></i> إضافة عنصر</button>`)}
    <div class="catalog-admin-tabs">
      <button class="${isDigital?"active":""}" data-admin-catalog-type="digital"><i data-lucide="package-open"></i><span>منتجات رقمية</span><b>${digitalCount||0}</b></button>
      <button class="${!isDigital?"active":""}" data-admin-catalog-type="social"><i data-lucide="messages-square"></i><span>منتجات السوشل</span><b>${socialCount||0}</b></button>
    </div>
    <div class="catalog-filter-bar">
      <input id="catalogSearch" class="input" placeholder="${isDigital?"بحث في المنتجات الرقمية":"بحث في منتجات السوشل"}" value="${esc(S.query||"")}">
      <select id="catalogStatus" class="input">
        <option value="">كل الحالات</option>
        ${isDigital?`<option value="available">متاح</option><option value="sold_out">نفد المخزون</option>`:`<option value="active">نشط</option><option value="inactive">موقوف</option>`}
      </select>
      <select id="catalogSecondFilter" class="input"><option value="">الكل</option></select>
    </div>
    <div class="list">${isDigital?
      (digitalRows.map(p=>`<div class="card item"><div class="order-thumb">${p.image_url?`<img src="${esc(p.image_url)}">`:`<i data-lucide="package"></i>`}</div><div class="item-main"><h3>${esc(p.name)}</h3><p>${money(p.price)} • ${esc(p.category_name||"بدون قسم")} • المخزون ${p.stock_count??"-"}</p></div><div class="item-actions">${badge(p.availability_status)}${iconButton("pencil","تعديل",`data-edit-digital="${p.id}"`)}${iconButton("trash-2","حذف",`data-delete-digital="${p.id}"`)}</div></div>`).join("")||empty("لا توجد منتجات رقمية"))
      :
      (socialRows.map(s=>`<div class="card item"><div class="platform-list-icon"><i data-lucide="${s.platform?.icon||"messages-square"}"></i></div><div class="item-main"><h3>${esc(s.name)}</h3><p>${esc(s.platform?.name||"-")} • ${esc(s.service_category||"خدمات عامة")} • ${money(s.price_per_1000)}/1000</p></div><div class="item-actions">${s.is_active?badge("active"):badge("blocked")}${iconButton("pencil","تعديل",`data-edit-social="${s.id}"`)}${iconButton("trash-2","حذف",`data-delete-social="${s.id}"`)}</div></div>`).join("")||empty("لا توجد منتجات سوشل ميديا"))
    }</div>`;

    $("#catalogStatus").value=S.catalogStatus||"";
    const second=$("#catalogSecondFilter");
    if(isDigital){
      supabase.from("categories").select("id,name").eq("is_active",true).order("name").then(({data})=>{
        second.innerHTML=`<option value="">كل الأقسام</option>${(data||[]).map(c=>`<option value="${c.id}" ${S.catalogCategory===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}`;
      });
    }else{
      supabase.from("social_platforms").select("id,name").eq("is_active",true).order("sort_order").then(({data})=>{
        second.innerHTML=`<option value="">كل المنصات</option>${(data||[]).map(p=>`<option value="${p.id}" ${S.catalogPlatform===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}`;
      });
    }

    $$("[data-admin-catalog-type]").forEach(b=>b.onclick=()=>{S.filter=b.dataset.adminCatalogType==="social"?"social":"";S.query="";S.catalogStatus="";S.catalogCategory="";S.catalogPlatform="";render()});
    $("#catalogSearch").oninput=debounce(()=>{S.query=$("#catalogSearch").value.trim();render()},220);
    $("#catalogStatus").onchange=()=>{S.catalogStatus=$("#catalogStatus").value;render()};
    second.onchange=()=>{if(isDigital)S.catalogCategory=second.value;else S.catalogPlatform=second.value;render()};
    $("#addCatalogItem").onclick=()=>catalogItemChooser();
    $$("[data-edit-digital]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("products").select("*").eq("id",b.dataset.editDigital).single();productForm(data)});
    $$("[data-delete-digital]").forEach(b=>b.onclick=()=>deleteRow("products",b.dataset.deleteDigital,"المنتج",adminCatalogItems));
    $$("[data-edit-social]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("smm_services").select("*").eq("id",b.dataset.editSocial).single();smmServiceForm(data)});
    $$("[data-delete-social]").forEach(b=>b.onclick=()=>deleteRow("smm_services",b.dataset.deleteSocial,"منتج السوشل",adminCatalogItems));
    refreshIcons();
  };
  render();
}
function catalogItemChooser(){
  openModal(`<div class="sheet-head"><div><h2>إضافة عنصر للكتالوج</h2><p>اختر النوع وسيتم عرض الحقول المناسبة</p></div><button data-close>×</button></div>
  <div class="catalog-type-choice">
    <button data-new-catalog="digital"><span><i data-lucide="package-open"></i></span><div><h3>منتج رقمي</h3><p>أكواد، حسابات، اشتراكات أو تسليم يدوي.</p></div><i data-lucide="arrow-left"></i></button>
    <button data-new-catalog="social"><span><i data-lucide="messages-square"></i></span><div><h3>منتج سوشل ميديا</h3><p>متابعون، مشاهدات، إعجابات وخدمات المنصات.</p></div><i data-lucide="arrow-left"></i></button>
  </div>`);
  $$("[data-new-catalog]",modal).forEach(b=>b.onclick=()=>{closeModal();b.dataset.newCatalog==="digital"?productForm():smmServiceForm()});
  refreshIcons();
}

async function adminProducts(){let q=supabase.from("products_with_stock").select("*",{count:"exact"}).order("created_at",{ascending:false});if(S.query)q=q.ilike("name",`%${S.query}%`);if(S.filter)q=q.eq("availability_status",S.filter);const from=(S.page-1)*CONFIG.PAGE_SIZE,{data,count}=await q.range(from,from+CONFIG.PAGE_SIZE-1),r=data||[];$("#adminContent").innerHTML=`${adminHeader("المنتجات","إضافة وتعديل وتعطيل",`<button id="addProduct" class="btn primary">إضافة منتج</button>`)}<div class="list">${r.map(p=>`<div class="card item"><div class="item-main"><h3>${esc(p.name)}</h3><p>${money(p.price)} • المخزون ${p.stock_count??"-"}</p></div><div class="item-actions">${badge(p.availability_status)}${iconButton("pencil","تعديل",`data-product-edit="${p.id}"`)}${iconButton("trash-2","حذف",`data-product-delete="${p.id}"`)}</div></div>`).join("")||empty("لا توجد منتجات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminProducts,[["available","متاح"],["sold_out","نفد المخزون"]]);bindPager(adminProducts);$("#addProduct").onclick=()=>productForm();$$("[data-product-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("products").select("*").eq("id",b.dataset.productEdit).single();productForm(data)});$$("[data-product-delete]").forEach(b=>b.onclick=()=>deleteRow("products",b.dataset.productDelete,"المنتج",adminProducts))}
async function productForm(p=null){
  const categoriesResult=await supabase.from("categories").select("*").order("name");
  if(categoriesResult.error)return toast(friendlyError(categoriesResult.error),"error");
  const categories=categoriesResult.data||[];

  openModal(`<div class="sheet-head"><div><h2>${p?"تعديل":"إضافة"} منتج رقمي</h2><p>جميع الحقول تُراجع قبل الحفظ</p></div><button data-close>×</button></div>
  <div id="productLivePreview" class="catalog-live-preview"></div>
  <form id="productForm">
    <label>اسم المنتج<input id="pn" value="${esc(p?.name||"")}" required maxlength="160"></label>
    <label>السعر<input id="pp" type="number" min="0" step=".01" value="${p?.price??0}" required></label>
    <label>التصنيف<select id="pc"><option value="">بدون تصنيف</option>${categories.map(x=>`<option value="${x.id}" ${p?.category_id===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
    <div class="social-form-grid">
      <label>نوع التسليم<select id="pd"><option value="automatic" ${p?.delivery_type!=="manual"?"selected":""}>تلقائي من المخزون</option><option value="manual" ${p?.delivery_type==="manual"?"selected":""}>يدوي من الإدارة</option></select></label>
      <label>حالة المنتج<select id="pm"><option value="available" ${p?.manual_availability==="available"||!p?"selected":""}>متاح</option><option value="paused" ${p?.manual_availability==="paused"?"selected":""}>موقوف</option><option value="sold_out" ${p?.manual_availability==="sold_out"?"selected":""}>نفد</option></select></label>
    </div>
    ${imagePicker("productImageFile",p?.image_url||"")}
    <label>الوصف<textarea id="pdesc" maxlength="4000">${esc(p?.description||"")}</textarea></label>
    <label>الحقول المطلوبة من العميل
      <textarea id="prequired" placeholder='[{"label":"رابط الحساب","type":"url","required":true}]'>${esc(JSON.stringify(p?.required_fields||[],null,2))}</textarea>
      <small>اتركها [] عند عدم الحاجة. الأنواع المدعومة: text وurl وnumber.</small>
    </label>
    <label class="switch-label"><input id="pa" type="checkbox" ${p?.is_active!==false?"checked":""}> المنتج مفعّل</label>
    <button type="submit" class="btn primary block"><i data-lucide="save"></i><span>حفظ المنتج</span></button>
  </form>`);

  const drawPreview=()=>{
    const name=$("#pn")?.value.trim()||"اسم المنتج";
    const price=Number($("#pp")?.value||0);
    const file=$("#productImageFile")?.files?.[0];
    const image=file?URL.createObjectURL(file):(p?.image_url||null);
    $("#productLivePreview").innerHTML=`<div class="mini-product-preview">${image?`<img src="${image}">`:`<div><i data-lucide="image"></i></div>`}<span><small>معاينة</small><strong>${esc(name)}</strong><b>${money(price)}</b></span></div>`;
    refreshIcons();
  };
  $("#pn").oninput=drawPreview;
  $("#pp").oninput=drawPreview;
  $("#productImageFile").onchange=drawPreview;
  drawPreview();

  $("#productForm").onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    if(!form.reportValidity())return;
    setFormBusy(form,true);
    try{
      const name=$("#pn").value.trim();
      if(name.length<2)throw new Error("اسم المنتج قصير جدًا.");
      const price=validatePositiveNumber($("#pp").value,"السعر",true);
      const requiredFields=parseRequiredFields($("#prequired").value);

      let imageUrl=p?.image_url||null;
      const imageFile=$("#productImageFile").files?.[0];
      if(imageFile)imageUrl=await uploadFile(imageFile,"products");

      const payload={
        name,
        price,
        category_id:$("#pc").value||null,
        delivery_type:$("#pd").value,
        manual_availability:$("#pm").value,
        image_url:imageUrl,
        description:$("#pdesc").value.trim()||null,
        required_fields:requiredFields,
        is_active:$("#pa").checked,
        updated_at:new Date().toISOString()
      };

      let result;
      if(p?.id){
        result=await supabase.from("products").update(payload).eq("id",p.id).select("id").single();
      }else{
        result=await supabase.from("products").insert(payload).select("id").single();
      }
      if(result.error)throw result.error;

      toast(p?"تم تعديل المنتج بنجاح":"تمت إضافة المنتج بنجاح");
      closeModal();
      S.query="";S.catalogStatus="";S.catalogCategory="";
      await adminCatalogItems();
    }catch(error){
      console.error("Digital product save error:",error);
      toast(friendlyError(error),"error");
    }finally{
      setFormBusy(form,false);
    }
  };
  refreshIcons();
}
async function categoryForm(c=null){const{data:allCats}=await supabase.from("categories").select("id,name").order("name");openModal(`<div class="sheet-head"><h2>${c?"تعديل":"إضافة"} تصنيف</h2><button data-close>×</button></div><form id="catForm"><label>الاسم<input id="cn" value="${esc(c?.name||"")}" required></label><label>الوصف<textarea id="cd">${esc(c?.description||"")}</textarea></label>${imagePicker("categoryImageFile",c?.image_url||"")}<label>القسم الأب<select id="categoryParent"><option value="">قسم رئيسي</option></select></label><label>الترتيب<input id="co" type="number" value="${c?.sort_order||0}"></label><label><input id="ca" type="checkbox" ${c?.is_active!==false?"checked":""}> مفعّل</label><button class="btn primary block">حفظ</button></form>`);$("#categoryParent").innerHTML=`<option value="">قسم رئيسي</option>${(allCats||[]).filter(x=>x.id!==c?.id).map(x=>`<option value="${x.id}" ${c?.parent_id===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}`;$("#catForm").onsubmit=async e=>{e.preventDefault();let categoryImage=c?.image_url||null;const categoryFile=$("#categoryImageFile").files[0];if(categoryFile)categoryImage=await uploadFile(categoryFile,"categories");const payload={name:$("#cn").value,description:$("#cd").value,image_url:categoryImage,parent_id:$("#categoryParent").value||null,sort_order:+$("#co").value,is_active:$("#ca").checked};const q=c?supabase.from("categories").update(payload).eq("id",c.id):supabase.from("categories").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");closeModal();adminCategories()}}
async function adminInventory(){let q=supabase.from("digital_inventory").select("*,product:products(name)",{count:"exact"}).order("created_at",{ascending:false});if(S.filter)q=q.eq("is_used",S.filter==="used");const from=(S.page-1)*CONFIG.PAGE_SIZE,{data,count}=await q.range(from,from+CONFIG.PAGE_SIZE-1),r=data||[];$("#adminContent").innerHTML=`${adminHeader("المخزون الرقمي","إضافة وحذف وتصدير",`<button id="addInventory" class="btn primary">إضافة مخزون</button><button id="exportInventory" class="btn soft">تصدير CSV</button>`)}<div class="list">${r.map(i=>`<div class="card item"><div class="item-main"><h3>${esc(i.product?.name||"-")}</h3><p>${i.is_used?"مستخدم":"متاح"} • ${dt(i.created_at)}</p></div><div class="item-actions">${i.is_used?badge("delivered"):badge("available")}${!i.is_used?`<button class="danger" data-inv-delete="${i.id}">حذف</button>`:""}</div></div>`).join("")||empty("لا يوجد مخزون")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminInventory,[["available","متاح"],["used","مستخدم"]]);bindPager(adminInventory);$("#addInventory").onclick=inventoryForm;$("#exportInventory").onclick=()=>exportCsv("digital_inventory","inventory.csv");$$("[data-inv-delete]").forEach(b=>b.onclick=()=>deleteRow("digital_inventory",b.dataset.invDelete,"عنصر المخزون",adminInventory))}
async function inventoryForm(){const{data:p}=await supabase.from("products").select("id,name").eq("delivery_type","automatic").order("name");openModal(`<div class="sheet-head"><h2>إضافة مخزون</h2><button data-close>×</button></div><form id="invForm"><label>المنتج<select id="ip">${(p||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>كل كود في سطر<textarea id="iv" required></textarea></label><button class="btn primary block">إضافة</button></form>`);$("#invForm").onsubmit=async e=>{e.preventDefault();const vals=$("#iv").value.split("\n").map(x=>x.trim()).filter(Boolean);const{error}=await supabase.from("digital_inventory").insert(vals.map(secret_value=>({product_id:$("#ip").value,secret_value})));if(error)return toast(error.message,"error");toast(`تمت إضافة ${vals.length} عناصر`);closeModal();adminInventory()}}
async function adminDeposits(){const{data,count}=await listQuery("deposit_requests","*,profile:profiles(full_name),payment_method:payment_methods(name)",q=>{if(S.filter)q=q.eq("status",S.filter);return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("طلبات الشحن","قبول ورفض الطلبات")}<div class="list">${r.map(d=>`<div class="card item"><div class="item-main"><h3>${esc(d.profile?.full_name||"-")}</h3><p>${money(d.amount)} • ${esc(d.payment_method?.name||"-")} • ${esc(d.transfer_reference)}</p></div><div class="item-actions">${badge(d.status)}${d.status==="pending"?`<button class="success" data-dep-ok="${d.id}">قبول</button><button class="danger" data-dep-no="${d.id}">رفض</button>`:""}</div></div>`).join("")||empty("لا توجد طلبات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminDeposits,[["pending","معلق"],["approved","مقبول"],["rejected","مرفوض"]]);bindPager(adminDeposits);$$("[data-dep-ok]").forEach(b=>b.onclick=()=>reviewDeposit(b.dataset.depOk,true));$$("[data-dep-no]").forEach(b=>b.onclick=()=>reviewDeposit(b.dataset.depNo,false))}
async function reviewDeposit(id,ok){const reason=ok?null:prompt("سبب الرفض:");if(!ok&&!reason)return;const{error}=await supabase.rpc(ok?"approve_deposit":"reject_deposit",ok?{p_deposit_id:id}:{p_deposit_id:id,p_reason:reason});if(error)return toast(error.message,"error");toast(ok?"تم القبول":"تم الرفض");await loadAdminBadges();adminDeposits()}

async function adminTransactions(){
  const{data}=await supabase.from("wallet_transactions").select("*,profile:profiles(full_name,phone)").order("created_at",{ascending:false}).limit(1000);
  const render=()=>{
    const rows=(data||[]).filter(x=>{
      const uname=(x.profile?.full_name||"").toLowerCase();
      return (!S.query||(`${x.description||""} ${x.reference_code||""}`).toLowerCase().includes(S.query.toLowerCase())) &&
             (!S.adminUserFilter||uname.includes(S.adminUserFilter.toLowerCase())) &&
             (!S.filter||x.type===S.filter);
    });
    $("#adminContent").innerHTML=`${section("الحركات المالية","بحث وتصفية حسب المستخدم والنوع",`<button id="exportTransactions" class="btn soft"><i data-lucide="download"></i> CSV</button>`)}
    <div class="catalog-filter-bar"><input id="txSearch" class="input" placeholder="بحث بالوصف أو المرجع" value="${esc(S.query||"")}"><input id="txUser" class="input" placeholder="اسم المستخدم" value="${esc(S.adminUserFilter||"")}"><select id="txType" class="input"><option value="">كل الأنواع</option><option value="purchase">مشتريات</option><option value="refund">استرداد</option><option value="deposit">شحن</option><option value="recharge_card">بطاقات</option></select></div>
    <div class="list">${rows.map(x=>`<div class="card item"><div class="transaction-icon ${Number(x.amount)>=0?"in":"out"}"><i data-lucide="${Number(x.amount)>=0?"arrow-down-left":"arrow-up-right"}"></i></div><div class="item-main"><h3>${esc(x.profile?.full_name||"-")}</h3><p>${esc(x.description||x.type)} • ${dt(x.created_at)}</p></div><strong class="${Number(x.amount)>=0?"amount-in":"amount-out"}">${Number(x.amount)>=0?"+":""}${money(x.amount)}</strong></div>`).join("")||empty("لا توجد نتائج")}</div>`;
    $("#txType").value=S.filter||"";
    $("#txSearch").oninput=debounce(()=>{S.query=$("#txSearch").value.trim();render()},220);
    $("#txUser").oninput=debounce(()=>{S.adminUserFilter=$("#txUser").value.trim();render()},220);
    $("#txType").onchange=()=>{S.filter=$("#txType").value;render()};
    $("#exportTransactions").onclick=()=>exportCsv("wallet_transactions","wallet-transactions.csv");
    refreshIcons();
  };render();
}

async function adminPaymentMethods(){const{data,count}=await listQuery("payment_methods","*",q=>{if(S.query)q=q.ilike("name",`%${S.query}%`);return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("طرق الدفع","إضافة وتعديل وتعطيل",`<button id="addMethod" class="btn primary">إضافة طريقة</button>`)}<div class="list">${r.map(m=>`<div class="card item"><div class="item-main"><h3>${esc(m.name)}</h3><p>${esc(m.account_number||"-")} • ${esc(m.currency)}</p></div><div class="item-actions">${m.is_active?badge("active"):badge("blocked")}<button class="small" data-method-edit="${m.id}">تعديل</button><button class="danger" data-method-delete="${m.id}">حذف</button></div></div>`).join("")||empty("لا توجد طرق")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminPaymentMethods);bindPager(adminPaymentMethods);$("#addMethod").onclick=()=>methodForm();$$("[data-method-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("payment_methods").select("*").eq("id",b.dataset.methodEdit).single();methodForm(data)});$$("[data-method-delete]").forEach(b=>b.onclick=()=>deleteRow("payment_methods",b.dataset.methodDelete,"طريقة الدفع",adminPaymentMethods))}
function methodForm(m=null){openModal(`<div class="sheet-head"><h2>${m?"تعديل":"إضافة"} طريقة دفع</h2><button data-close>×</button></div><form id="methodForm"><label>الاسم<input id="mn" value="${esc(m?.name||"")}" required></label><label>العملة<input id="mc" value="${esc(m?.currency||CONFIG.CURRENCY)}"></label><label>اسم الحساب<input id="mo" value="${esc(m?.account_name||"")}"></label><label>رقم الحساب<input id="mnum" value="${esc(m?.account_number||"")}"></label><label>التعليمات<textarea id="mi">${esc(m?.instructions||"")}</textarea></label><label>الترتيب<input id="ms" type="number" value="${m?.sort_order||0}"></label><label><input id="ma" type="checkbox" ${m?.is_active!==false?"checked":""}> مفعلة</label><button class="btn primary block">حفظ</button></form>`);$("#methodForm").onsubmit=async e=>{e.preventDefault();const payload={name:$("#mn").value,currency:$("#mc").value,account_name:$("#mo").value,account_number:$("#mnum").value,instructions:$("#mi").value,sort_order:+$("#ms").value,is_active:$("#ma").checked};const q=m?supabase.from("payment_methods").update(payload).eq("id",m.id):supabase.from("payment_methods").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");closeModal();adminPaymentMethods()}}
async function adminCards(){const{data,count}=await listQuery("recharge_cards","*",q=>{if(S.filter)q=q.eq("is_used",S.filter==="used");if(S.query)q=q.ilike("code",`%${S.query}%`);return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("بطاقات الشحن","توليد وتعطيل وحذف وتصدير",`<button id="generateCards" class="btn primary">توليد</button><button id="exportCards" class="btn soft">تصدير CSV</button>`)}<div class="list">${r.map(c=>`<div class="card item"><div class="item-main"><h3>${esc(c.code)}</h3><p>${money(c.amount)} • ${c.is_used?"مستخدمة":"متاحة"}</p></div><div class="item-actions">${c.is_used?badge("delivered"):badge("available")}${!c.is_used?`<button class="danger" data-card-delete="${c.id}">حذف</button>`:""}</div></div>`).join("")||empty("لا توجد بطاقات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminCards,[["available","متاحة"],["used","مستخدمة"]]);bindPager(adminCards);$("#generateCards").onclick=cardForm;$("#exportCards").onclick=()=>exportCsv("recharge_cards","recharge-cards.csv");$$("[data-card-delete]").forEach(b=>b.onclick=()=>deleteRow("recharge_cards",b.dataset.cardDelete,"البطاقة",adminCards))}
function cardForm(){openModal(`<div class="sheet-head"><h2>توليد بطاقات</h2><button data-close>×</button></div><form id="cardForm"><label>القيمة<input id="cardAmount" type="number" min="1" required></label><label>العدد<input id="cardCount" type="number" min="1" max="100" value="1"></label><label>البادئة<input id="cardPrefix" value="ALI"></label><button class="btn primary block">توليد</button></form>`);$("#cardForm").onsubmit=async e=>{e.preventDefault();const{error}=await supabase.rpc("generate_recharge_cards",{p_amount:+$("#cardAmount").value,p_count:+$("#cardCount").value,p_prefix:$("#cardPrefix").value});if(error)return toast(error.message,"error");toast("تم التوليد");closeModal();adminCards()}}
async function adminCoupons(){const{data,count}=await listQuery("coupons","*",q=>{if(S.query)q=q.ilike("code",`%${S.query}%`);if(S.filter)q=q.eq("is_active",S.filter==="active");return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("الكوبونات","إضافة وتعديل وتعطيل",`<button id="addCoupon" class="btn primary">إضافة كوبون</button>`)}<div class="list">${r.map(c=>`<div class="card item"><div class="item-main"><h3>${esc(c.code)}</h3><p>${c.discount_type==="percent"?c.discount_value+"%":money(c.discount_value)} • الاستخدام ${c.used_count}${c.usage_limit?"/"+c.usage_limit:""}</p></div><div class="item-actions">${c.is_active?badge("active"):badge("blocked")}<button class="small" data-coupon-edit="${c.id}">تعديل</button><button class="danger" data-coupon-delete="${c.id}">حذف</button></div></div>`).join("")||empty("لا توجد كوبونات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminCoupons,[["active","مفعّل"],["inactive","موقوف"]]);bindPager(adminCoupons);$("#addCoupon").onclick=()=>couponForm();$$("[data-coupon-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("coupons").select("*").eq("id",b.dataset.couponEdit).single();couponForm(data)});$$("[data-coupon-delete]").forEach(b=>b.onclick=()=>deleteRow("coupons",b.dataset.couponDelete,"الكوبون",adminCoupons))}
function couponForm(c=null){openModal(`<div class="sheet-head"><h2>${c?"تعديل":"إضافة"} كوبون</h2><button data-close>×</button></div><form id="couponForm"><label>الرمز<input id="ccode" value="${esc(c?.code||"")}" required></label><label>نوع الخصم<select id="ctype"><option value="percent">نسبة</option><option value="fixed" ${c?.discount_type==="fixed"?"selected":""}>مبلغ ثابت</option></select></label><label>القيمة<input id="cvalue" type="number" min="0" step=".01" value="${c?.discount_value||0}" required></label><label>الحد الأدنى<input id="cmin" type="number" min="0" step=".01" value="${c?.minimum_order||0}"></label><label>الحد الأقصى للخصم<input id="cmax" type="number" min="0" step=".01" value="${c?.maximum_discount||""}"></label><label>حد الاستخدام<input id="climit" type="number" min="1" value="${c?.usage_limit||""}"></label><label>تاريخ الانتهاء<input id="cend" type="datetime-local"></label><label><input id="cactive" type="checkbox" ${c?.is_active!==false?"checked":""}> مفعّل</label><button class="btn primary block">حفظ</button></form>`);$("#couponForm").onsubmit=async e=>{e.preventDefault();const payload={code:$("#ccode").value.toUpperCase(),discount_type:$("#ctype").value,discount_value:+$("#cvalue").value,minimum_order:+$("#cmin").value,maximum_discount:$("#cmax").value?+$("#cmax").value:null,usage_limit:$("#climit").value?+$("#climit").value:null,ends_at:$("#cend").value||null,is_active:$("#cactive").checked};const q=c?supabase.from("coupons").update(payload).eq("id",c.id):supabase.from("coupons").insert({...payload,created_by:S.user.id});const{error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");closeModal();adminCoupons()}}
async function adminUsers(){
  const{data,error}=await supabase.rpc("admin_list_users");
  if(error)return toast(error.message,"error");
  const filtered=(data||[]).filter(u=>(!S.query||`${u.full_name||""} ${u.email||""} ${u.phone||""}`.toLowerCase().includes(S.query.toLowerCase()))&&(!S.filter||u.status===S.filter));
  const rows=filtered.sort((a,b)=>walletBalanceOf(b)-walletBalanceOf(a)||(new Date(b.created_at)-new Date(a.created_at)));
  const from=(S.page-1)*CONFIG.PAGE_SIZE,r=rows.slice(from,from+CONFIG.PAGE_SIZE);
  $("#adminContent").innerHTML=`${adminHeader("المستخدمون","إدارة الحسابات والأرصدة والصلاحيات",`<button id="exportUsers" class="btn soft">تصدير CSV</button>`)}
    <div class="list admin-users-list">${r.map(u=>{
      const protectedAdmin=isPrimaryAdmin(u.id),balance=walletBalanceOf(u),phoneDigits=String(u.phone||"").replace(/\D/g,"");
      const primaryBadge=protectedAdmin?`<span class="badge success">المدير الأساسي</span>`:"";
      const whatsappBtn=phoneDigits?`<a class="btn whatsapp-btn ucard-wa" href="https://wa.me/${phoneDigits}" target="_blank" title="مراسلة عبر واتساب"><i data-lucide="message-circle"></i><span>واتساب</span></a>`:"";
      const phoneLine=u.phone?`<span dir="ltr">${esc(u.phone)}</span>`:`<span class="ucard-none">بدون رقم واتساب</span>`;
      return `<article class="card ucard">
        <div class="ucard-head">
          <div class="admin-user-avatar">${esc((u.full_name||"م").trim().charAt(0)||"م")}</div>
          <div class="ucard-id">
            <div class="ucard-name-row"><h3>${esc(u.full_name||"-")}</h3>${primaryBadge}</div>
            <div class="ucard-sub">${u.email?esc(u.email):"لا يوجد بريد مسجل"}</div>
            <div class="ucard-sub ucard-sub-phone">${phoneLine}</div>
          </div>
          <div class="ucard-balance"><small>الرصيد</small><strong class="user-balance ${balance>0?"positive":"zero"}">${money(balance)}</strong></div>
        </div>
        <div class="ucard-meta">${badge(u.status)}<span class="user-role-label ${userRoleTone(u)}">${userRoleLabel(u)}</span><span class="ucard-date">انضم في ${dt(u.created_at)}</span></div>
        <div class="ucard-actions">
          <button class="btn soft ucard-btn" data-user-details="${u.id}"><i data-lucide="info"></i><span>التفاصيل</span></button>
          ${whatsappBtn}
          <button class="btn soft ucard-btn ucard-more" data-user-actions="${u.id}"><i data-lucide="ellipsis-vertical"></i><span>إجراءات</span></button>
        </div>
      </article>`}).join("")||empty("لا يوجد مستخدمون")}</div>
    ${pager(S.page,rows.length,CONFIG.PAGE_SIZE)}`;
  bindAdminSearch(adminUsers,[["active","نشط"],["blocked","محظور"]]);
  bindPager(adminUsers);
  $("#exportUsers").onclick=()=>exportCsv("profiles","users.csv");
  $$("[data-user-details]").forEach(b=>b.onclick=()=>showUserDetails(rows.find(u=>String(u.id)===String(b.dataset.userDetails))));
  $$("[data-user-actions]").forEach(b=>b.onclick=()=>showUserActions(rows.find(u=>String(u.id)===String(b.dataset.userActions))));
  refreshIcons();
}


async function sendPasswordReset(email){if(!email)return toast("لا يوجد بريد إلكتروني لهذا المستخدم","error");const ok=typeof appConfirm==="function"?await appConfirm({title:"إعادة تعيين كلمة المرور",message:`سيتم إرسال رابط إعادة تعيين كلمة المرور إلى ${email}.`,confirmText:"إرسال الرابط",cancelText:"إلغاء",icon:"mail"}):confirm(`سيتم إرسال رابط إعادة تعيين كلمة المرور إلى ${email}`);if(!ok)return;const redirectTo=`${location.origin}${location.pathname}`;let result=await supabase.auth.resetPasswordForEmail(email,{redirectTo});if(result.error&&/redirect/i.test(result.error.message||""))result=await supabase.auth.resetPasswordForEmail(email);if(result.error)return toast(result.error.message,"error");toast("تم إرسال رابط إعادة التعيين إلى بريد المستخدم")}
function showUserDetails(u){if(!u)return;const balance=walletBalanceOf(u),phone=String(u.phone||"-");openModal(`<div class="sheet-head"><div><h2>تفاصيل المستخدم</h2><p>عرض جميع بيانات الحساب بشكل واضح</p></div><button data-close>×</button></div><div class="admin-user-details-grid"><div class="admin-user-detail-card"><small>الاسم</small><strong>${esc(u.full_name||"-")}</strong></div><div class="admin-user-detail-card"><small>البريد الإلكتروني</small><strong>${esc(u.email||"-")}</strong></div><div class="admin-user-detail-card"><small>واتساب</small><strong dir="ltr">${esc(phone)}</strong></div><div class="admin-user-detail-card"><small>الدور</small><strong class="user-role-label ${userRoleTone(u)}">${userRoleLabel(u)}</strong></div><div class="admin-user-detail-card"><small>الحالة</small><strong>${badge(u.status)}</strong></div><div class="admin-user-detail-card"><small>الرصيد</small><strong class="user-balance ${balance>0?"positive":"zero"}">${money(balance)}</strong></div><div class="admin-user-detail-card admin-user-detail-wide"><small>تاريخ التسجيل</small><strong>${dt(u.created_at)}</strong></div></div>`);refreshIcons()}

function showUserActions(u){
  if(!u)return;
  const protectedAdmin=isPrimaryAdmin(u.id);
  const statusLabel=u.status==="blocked"?"فك حظر المستخدم":"حظر المستخدم",statusIcon=u.status==="blocked"?"unlock":"ban";
  const resetBtn=u.email?`<button class="user-sheet-item tone-info" data-ua="reset"><i data-lucide="key-round"></i><span class="usi-main">إعادة تعيين كلمة المرور</span><small>إرسال رابط الاستعادة إلى بريد المستخدم</small></button>`:"";
  const walletBtn=`<button class="user-sheet-item tone-wallet" data-ua="wallet"><i data-lucide="wallet-cards"></i><span class="usi-main">تعديل الرصيد</span><small>إضافة أو خصم مبلغ من محفظة المستخدم</small></button>`;
  const roleBtn=protectedAdmin?"":`<button class="user-sheet-item tone-role" data-ua="role"><i data-lucide="shield"></i><span class="usi-main">تغيير الدور</span><small>تحويل الحساب بين مستخدم ومدير</small></button>`;
  const statusBtn=protectedAdmin?"":`<button class="user-sheet-item tone-warn" data-ua="status"><i data-lucide="${statusIcon}"></i><span class="usi-main">${statusLabel}</span><small>تقييد أو استعادة وصول الحساب</small></button>`;
  const deleteBtn=protectedAdmin?"":`<button class="user-sheet-item tone-danger" data-ua="delete"><i data-lucide="trash-2"></i><span class="usi-main">حذف المستخدم نهائيًا</span><small>لا يمكن التراجع عن هذا الإجراء</small></button>`;
  openModal(`<div class="sheet-head"><div><h2>إجراءات المستخدم</h2><p>${esc(u.full_name||"-")}</p></div><button data-close>×</button></div><div class="user-actions-sheet">${resetBtn}${walletBtn}${roleBtn}${statusBtn}${deleteBtn}</div>`);
  const run=fn=>()=>{closeModal();fn()};
  modal.querySelector('[data-ua="reset"]')?.addEventListener("click",run(()=>sendPasswordReset(u.email)));
  modal.querySelector('[data-ua="wallet"]')?.addEventListener("click",run(()=>adjustWallet(u.id)));
  modal.querySelector('[data-ua="role"]')?.addEventListener("click",run(()=>changeRole(u.id)));
  modal.querySelector('[data-ua="status"]')?.addEventListener("click",run(()=>changeStatus(u.id,u.status)));
  modal.querySelector('[data-ua="delete"]')?.addEventListener("click",run(()=>deleteUser(u.id)));
  refreshIcons();
}

async function adjustWallet(id){const amount=Number(prompt("موجب للإضافة وسالب للخصم:"));if(!amount)return;const reason=prompt("سبب العملية:");if(!reason)return;const{error}=await supabase.rpc("admin_adjust_wallet",{p_user_id:id,p_amount:amount,p_reason:reason});if(error)return toast(error.message,"error");toast("تم تعديل الرصيد");adminUsers()}
async function changeRole(id){if(isPrimaryAdmin(id))return toast("لا يمكن تغيير دور المدير الأساسي","error");const role=prompt("اكتب user أو admin:","user");if(!["user","admin"].includes(role))return;const reason=prompt("سبب تغيير الدور:")||"تحديث بواسطة الإدارة";const{error}=await supabase.rpc("admin_set_user_role",{p_user_id:id,p_role:role,p_reason:reason});if(error)return toast(error.message,"error");toast("تم تغيير الدور");adminUsers()}
async function changeStatus(id,current){if(isPrimaryAdmin(id))return toast("لا يمكن تغيير حالة المدير الأساسي","error");const status=current==="blocked"?"active":"blocked",reason=prompt("سبب التغيير:")||"تحديث بواسطة الإدارة";const{error}=await supabase.rpc("admin_set_user_status",{p_user_id:id,p_status:status,p_reason:reason});if(error)return toast(error.message,"error");toast("تم تحديث الحالة");adminUsers()}
async function deleteUser(id){if(isPrimaryAdmin(id))return toast("لا يمكن حذف المدير الأساسي","error");if(!confirm("سيتم حذف الحساب وبياناته المرتبطة نهائيًا. هل تريد المتابعة؟"))return;const reason=prompt("سبب حذف المستخدم:")||"حذف بواسطة الإدارة";const{error}=await supabase.rpc("admin_delete_user",{p_user_id:id,p_reason:reason});if(error)return toast(error.message,"error");toast("تم حذف المستخدم");adminUsers()}
async function adminSlides(){const{data,count}=await listQuery("store_slides","*",q=>{if(S.query)q=q.ilike("title",`%${S.query}%`);if(S.filter)q=q.eq("is_active",S.filter==="active");return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("السلايدر","إضافة وتعديل وحذف وترتيب",`<button id="addSlide" class="btn primary">إضافة سلايد</button>`)}<div class="list">${r.map(s=>`<div class="card item"><div class="item-main"><h3>${esc(s.title)}</h3><p>الترتيب ${s.sort_order} • ${esc(s.button_text||"-")}</p></div><div class="item-actions">${s.is_active?badge("active"):badge("blocked")}${iconButton("eye","معاينة",`data-slide-preview="${s.id}"`)}${iconButton("pencil","تعديل",`data-slide-edit="${s.id}"`)}${iconButton("trash-2","حذف",`data-slide-delete="${s.id}"`)}</div></div>`).join("")||empty("لا توجد شرائح")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminSlides,[["active","مفعّل"],["inactive","موقوف"]]);bindPager(adminSlides);$("#addSlide").onclick=()=>slideForm();$$("[data-slide-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("store_slides").select("*").eq("id",b.dataset.slideEdit).single();slideForm(data)});$$("[data-slide-preview]").forEach(b=>b.onclick=()=>previewSlide(r.find(x=>x.id===b.dataset.slidePreview)));$$("[data-slide-delete]").forEach(b=>b.onclick=()=>deleteRow("store_slides",b.dataset.slideDelete,"السلايد",adminSlides))}
function slideForm(s=null){openModal(`<div class="sheet-head"><h2>${s?"تعديل":"إضافة"} سلايد</h2><button data-close>×</button></div><form id="slideForm"><label>العنوان<input id="st" value="${esc(s?.title||"")}" required></label><label>النص<textarea id="ss">${esc(s?.subtitle||"")}</textarea></label>${imagePicker("slideImageFile",s?.image_url||"")}<label>نص الزر<input id="sb" value="${esc(s?.button_text||"استكشف")}"></label><label>رابط الزر<input id="su" value="${esc(s?.button_url||"#/products")}"></label><label>الترتيب<input id="so" type="number" value="${s?.sort_order||0}"></label><label><input id="sa" type="checkbox" ${s?.is_active!==false?"checked":""}> مفعّل</label><button class="btn primary block">حفظ</button></form>`);$("#slideForm").onsubmit=async e=>{e.preventDefault();let imageUrl=s?.image_url||null;const imageFile=$("#slideImageFile").files[0];if(imageFile)imageUrl=await uploadFile(imageFile,"slides");const payload={title:$("#st").value,subtitle:$("#ss").value,image_url:imageUrl,button_text:$("#sb").value,button_url:$("#su").value,sort_order:+$("#so").value,is_active:$("#sa").checked};const q=s?supabase.from("store_slides").update(payload).eq("id",s.id):supabase.from("store_slides").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");closeModal();adminSlides()}}
function previewSlide(s){openModal(`<div class="sheet-head"><h2>معاينة السلايد</h2><button data-close>×</button></div><section class="slide active" style="${s.image_url?`background-image:linear-gradient(90deg,rgba(23,19,55,.72),rgba(23,19,55,.25)),url('${esc(s.image_url)}')`:""}"><div class="slide-overlay"><h1>${esc(s.title)}</h1><p>${esc(s.subtitle||"")}</p><span class="btn primary">${esc(s.button_text||"استكشف")}</span></div></section>`)}
async function adminAnnouncements(){const{data,count}=await listQuery("announcements","*",q=>{if(S.query)q=q.or(`title.ilike.%${S.query}%,message.ilike.%${S.query}%`);if(S.filter)q=q.eq("kind",S.filter);return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("الإعلانات","شريط علوي وإعلانات عامة",`<button id="addAnnouncement" class="btn primary">إضافة إعلان</button>`)}<div class="list">${r.map(a=>`<div class="card item"><div class="item-main"><h3>${esc(a.title||"إعلان")}</h3><p>${esc(a.message)} • ${a.kind}</p></div><div class="item-actions">${a.is_active?badge("active"):badge("blocked")}<button class="small" data-ann-edit="${a.id}">تعديل</button><button class="danger" data-ann-delete="${a.id}">حذف</button></div></div>`).join("")||empty("لا توجد إعلانات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminAnnouncements,[["bar","شريط علوي"],["notification","إشعار عام"]]);bindPager(adminAnnouncements);$("#addAnnouncement").onclick=()=>announcementForm();$$("[data-ann-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("announcements").select("*").eq("id",b.dataset.annEdit).single();announcementForm(data)});$$("[data-ann-delete]").forEach(b=>b.onclick=()=>deleteRow("announcements",b.dataset.annDelete,"الإعلان",adminAnnouncements))}
function announcementForm(a=null){openModal(`<div class="sheet-head"><h2>${a?"تعديل":"إضافة"} إعلان</h2><button data-close>×</button></div><form id="annForm"><label>العنوان<input id="at" value="${esc(a?.title||"")}"></label><label>النص<textarea id="am" required>${esc(a?.message||"")}</textarea></label><label>النوع<select id="ak"><option value="bar">شريط علوي</option><option value="notification" ${a?.kind==="notification"?"selected":""}>إشعار عام</option></select></label><label>تاريخ البداية<input id="as" type="datetime-local"></label><label>تاريخ النهاية<input id="ae" type="datetime-local"></label><label><input id="aa" type="checkbox" ${a?.is_active!==false?"checked":""}> مفعّل</label><button class="btn primary block">حفظ</button></form>`);$("#annForm").onsubmit=async e=>{e.preventDefault();const payload={title:$("#at").value,message:$("#am").value,kind:$("#ak").value,starts_at:$("#as").value||new Date().toISOString(),ends_at:$("#ae").value||null,is_active:$("#aa").checked,created_by:S.user.id};const q=a?supabase.from("announcements").update(payload).eq("id",a.id):supabase.from("announcements").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");if(!a&&payload.kind==="notification")await supabase.from("notifications").insert({user_id:null,title:payload.title||"إعلان",body:payload.message,type:"announcement"});toast("تم الحفظ");closeModal();adminAnnouncements()}}
async function adminNotifications(){
  const {data,count}=await listQuery("notifications","*",q=>{
    if(S.query)q=q.or(`title.ilike.%${S.query}%,body.ilike.%${S.query}%`);
    if(S.filter==="global")q=q.is("user_id",null);
    if(S.filter==="personal")q=q.not("user_id","is",null);
    return q;
  });
  const rows=data||[];
  $("#adminContent").innerHTML=`${adminHeader("الإشعارات","محتوى واضح مع تفاصيل العملية والمستلم",`<button id="sendNotification" class="btn primary">إرسال إشعار</button>`)}
    <div class="list admin-notes-list">${rows.map(n=>{
      const info=notificationTypeInfo(n.type);
      const parsed=parseNotificationBody(n.body);
      return `<article class="card admin-note-card tone-${info.tone}">
        <div class="admin-note-main">
          <div class="notification-top-row">
            <h3>${esc(n.title||"إشعار")}</h3>
            <span class="mini-chip ${n.user_id?"warning":"neutral"}">${n.user_id?"خاص":"عام"}</span>
          </div>
          <div class="notification-meta-row">
            <span class="mini-chip neutral">${info.label}</span>
            <span class="mini-chip neutral">${n.is_read?"مقروء":"غير مقروء"}</span>
            <span class="mini-chip neutral">${dt(n.created_at)}</span>
          </div>
          <p class="notification-summary">${esc(parsed.summary)}</p>
          ${parsed.details.length?`<div class="notification-details-list compact">${parsed.details.map(item=>`<div class="notification-detail-item"><small>${esc(item.key)}</small><strong>${esc(item.value)}</strong></div>`).join("")}</div>`:""}
        </div>
        <div class="item-actions"><button class="danger" data-note-delete="${n.id}">حذف</button></div>
      </article>`;
    }).join("")||empty("لا توجد إشعارات","يمكنك إرسال إشعار واضح ومفصل من هنا.","bell")}</div>
    ${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;
  bindAdminSearch(adminNotifications,[["global","عامة"],["personal","خاصة"]]);
  bindPager(adminNotifications);
  $("#sendNotification").onclick=notificationForm;
  $$("[data-note-delete]").forEach(b=>b.onclick=()=>deleteRow("notifications",b.dataset.noteDelete,"الإشعار",adminNotifications));
  refreshIcons();
}
async function notificationForm(){
  const {data:users}=await supabase.from("profiles").select("id,full_name").order("full_name").limit(500);
  openModal(`<div class="sheet-head"><div><h2>إرسال إشعار واضح</h2><p>كوّن الرسالة بشكل مفهوم مع تفاصيل العملية كاملة</p></div><button data-close>×</button></div>
    <form id="noteForm" class="rich-note-form">
      <label>المستلم<select id="nu"><option value="">جميع المستخدمين</option>${(users||[]).map(u=>`<option value="${u.id}">${esc(u.full_name||u.id)}</option>`).join("")}</select></label>
      <label>نوع الإشعار<select id="nkind"><option value="manual">عام</option><option value="order">طلب رقمي</option><option value="social_order">طلب سوشل</option><option value="wallet">محفظة</option><option value="deposit">شحن رصيد</option><option value="refund">استرداد</option><option value="announcement">إعلان</option></select></label>
      <label>عنوان الإشعار<input id="nt" required placeholder="مثال: تم تحديث حالة الطلب"></label>
      <label>ملخص واضح للعملية<textarea id="ns" required placeholder="اكتب جملة مفهومة توضح ماذا حدث بالضبط"></textarea></label>
      <div class="form-split-2">
        <label>رقم الطلب / المرجع<input id="nref" placeholder="مثال: ORD-1024"></label>
        <label>الحالة الحالية<input id="nstatus" placeholder="مثال: قيد التنفيذ / تم التسليم"></label>
      </div>
      <div class="form-split-2">
        <label>المبلغ أو الرصيد<input id="namount" placeholder="مثال: 15 USD"></label>
        <label>الإجراء التالي<input id="naction" placeholder="مثال: راجع الطلبات أو انتظر التواصل"></label>
      </div>
      <label>تفاصيل إضافية<textarea id="ndetails" placeholder="أي تفاصيل إضافية يحتاجها المستخدم لفهم العملية"></textarea></label>
      <button class="btn primary block">إرسال الإشعار</button>
    </form>`);
  $("#noteForm").onsubmit=async e=>{
    e.preventDefault();
    const title=$("#nt").value.trim();
    const summary=$("#ns").value.trim();
    const ref=$("#nref").value.trim();
    const status=$("#nstatus").value.trim();
    const amount=$("#namount").value.trim();
    const action=$("#naction").value.trim();
    const extra=$("#ndetails").value.trim();
    const body=[
      `الملخص: ${summary}`,
      ref?`المرجع: ${ref}`:"",
      status?`الحالة: ${status}`:"",
      amount?`المبلغ: ${amount}`:"",
      action?`الإجراء التالي: ${action}`:"",
      extra?`تفاصيل إضافية: ${extra}`:"",
      `وقت الإرسال: ${dt(new Date().toISOString())}`
    ].filter(Boolean).join("\n");
    const {error}=await supabase.from("notifications").insert({
      user_id:$("#nu").value||null,
      title,
      body,
      type:$("#nkind").value
    });
    if(error)return toast(error.message,"error");
    toast("تم إرسال إشعار واضح ومفصل");
    closeModal();
    adminNotifications();
  };
  refreshIcons();
}
async function adminSmmOrders(){
  const{data,count}=await listQuery("smm_orders","*,service:smm_services(name,platform:social_platforms(name,icon)),profile:profiles(full_name,phone)",q=>{if(S.filter)q=q.eq("status",S.filter);return q});const r=data||[];
  $("#adminContent").innerHTML=`${adminHeader("طلبات السوشل ميديا","التنفيذ والتحديث")}<div class="list">${r.map(o=>`<div class="card item"><div class="platform-list-icon"><i data-lucide="${o.service?.platform?.icon||"messages-square"}"></i></div><div class="item-main"><h3>${esc(o.service?.name||"-")}</h3><p>${esc(o.profile?.full_name||"-")} • ${o.quantity} • ${esc(o.target_url)}</p></div><div class="item-actions">${badge(o.status)}${o.profile?.phone?`<a class="icon-action whatsapp-btn" href="https://wa.me/${String(o.profile.phone).replace(/\D/g,"")}" target="_blank"><i data-lucide="message-circle"></i></a>`:""}${iconButton("settings-2","إدارة",`data-smm-order="${o.id}"`)}</div></div>`).join("")||empty("لا توجد طلبات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;
  bindAdminSearch(adminSmmOrders,[["pending","معلق"],["processing","قيد التنفيذ"],["delivered","مكتمل"],["cancelled","ملغي"]]);bindPager(adminSmmOrders);$$("[data-smm-order]").forEach(b=>b.onclick=()=>manageSmmOrder(r.find(x=>x.id===b.dataset.smmOrder)));refreshIcons()
}
function manageSmmOrder(o){
  openModal(`<div class="sheet-head"><h2>إدارة طلب السوشل ميديا</h2><button data-close>×</button></div><div class="note">الخدمة: ${esc(o.service?.name||"-")}<br>الرابط: ${esc(o.target_url)}<br>الكمية: ${o.quantity}<br>القيمة: ${money(o.total)}</div><form id="manageSmm"><label>الحالة<select id="smmStatus"><option value="pending">معلق</option><option value="processing">قيد التنفيذ</option><option value="delivered">مكتمل</option><option value="cancelled">إلغاء وإعادة الرصيد</option></select></label><label>مرجع المزود<input id="providerRef" value="${esc(o.provider_reference||"")}"></label><label>ملاحظة الإدارة<textarea id="adminNote">${esc(o.admin_note||"")}</textarea></label><button class="btn primary block">حفظ</button></form>`);
  $("#manageSmm").onsubmit=async e=>{e.preventDefault();const{error}=await supabase.rpc("admin_update_smm_order",{p_order_id:o.id,p_status:$("#smmStatus").value,p_provider_reference:$("#providerRef").value||null,p_admin_note:$("#adminNote").value||null});if(error)return toast(error.message,"error");toast("تم تحديث الطلب");closeModal();adminSmmOrders()}
}

async function adminSupport(){
  const threadsResult=await supabase
    .from("support_threads")
    .select("*")
    .order("updated_at",{ascending:false})
    .limit(300);

  if(threadsResult.error){
    $("#adminContent").innerHTML=`${section("محادثات الدعم","تعذر تحميل المحادثات")}
      <div class="card empty"><h2>حدث خطأ أثناء جلب المحادثات</h2><p>${esc(threadsResult.error.message)}</p><button id="retrySupportList" class="btn primary">إعادة المحاولة</button></div>`;
    $("#retrySupportList").onclick=adminSupport;
    refreshIcons();
    return;
  }

  const threads=threadsResult.data||[];
  const userIds=[...new Set(threads.map(t=>t.user_id).filter(Boolean))];
  let profilesById={};

  if(userIds.length){
    const profilesResult=await supabase
      .from("profiles")
      .select("id,full_name,phone")
      .in("id",userIds);

    if(!profilesResult.error){
      profilesById=Object.fromEntries((profilesResult.data||[]).map(p=>[p.id,p]));
    }
  }

  const rows=threads.map(t=>({...t,profile:profilesById[t.user_id]||null}));

  $("#adminContent").innerHTML=`${section("محادثات الدعم","المحادثات الجديدة والمفتوحة")}
    <div class="list">${rows.map(t=>`<div class="card item ${t.admin_unread_count>0?"support-unread":""}">
      <div class="item-main">
        <h3>${esc(t.profile?.full_name||"مستخدم")} ${t.is_user_blocked?'<span class="badge danger">محظور</span>':""}</h3>
        <p>${esc(t.subject||"محادثة دعم")} • ${dt(t.updated_at)}</p>
      </div>
      <div class="item-actions">
        ${t.admin_unread_count?`<i class="admin-notice-badge">${t.admin_unread_count}</i>`:""}
        ${badge(t.status)}
        ${t.profile?.phone?`<a class="icon-action whatsapp-btn" href="https://wa.me/${String(t.profile.phone).replace(/\D/g,"")}" target="_blank"><i data-lucide="message-circle"></i></a>`:""}
        ${iconButton("messages-square","فتح المحادثة",`data-support-thread="${t.id}"`)}
      </div>
    </div>`).join("")||empty("لا توجد محادثات")}</div>`;

  $$("[data-support-thread]").forEach(b=>{
    b.onclick=()=>openAdminSupportThread(rows.find(x=>x.id===b.dataset.supportThread));
  });
  refreshIcons();
}
async function openAdminSupportThread(thread){
  const{data:messages}=await supabase.from("support_messages").select("*,sender:profiles(full_name,role)").eq("thread_id",thread.id).order("created_at");
  await supabase.from("support_threads").update({admin_unread_count:0}).eq("id",thread.id);
  openModal(`<div class="sheet-head"><div><h2>${esc(thread.profile?.full_name||"عميل")}</h2><p>${thread.is_user_blocked?"المستخدم محظور من الإرسال":"محادثة الدعم"}</p></div><button data-close>×</button></div>
  <div class="support-admin-actions"><button id="toggleUserChatBlock" class="btn ${thread.is_user_blocked?"success":"danger"}"><i data-lucide="${thread.is_user_blocked?"unlock":"ban"}"></i>${thread.is_user_blocked?"فك حظر الإرسال":"حظر الإرسال"}</button></div>
  <div id="adminSupportMessages" class="support-messages">${(messages||[]).map(m=>`<div class="support-message ${m.sender_id===S.user.id?"mine":"theirs"}">${m.image_url?`<img class="chat-image" src="${esc(m.image_url)}">`:""}${m.body?`<div>${esc(m.body)}</div>`:""}<small>${dt(m.created_at)}</small></div>`).join("")}</div>
  <form id="adminSupportForm" class="support-send-rich">
    <div class="chat-tools">
      <button type="button" class="icon-action" data-toggle-emoji="adminSupportBody" title="إيموجي"><i data-lucide="smile"></i></button>
      <button type="button" class="icon-action chat-image-button" id="adminSupportImageButton" title="إضافة صورة"><i data-lucide="image-plus"></i><i id="adminSupportImageBadge" class="image-selected-badge hidden"></i></button>
      <input id="adminSupportImage" class="chat-file-input" type="file" accept="image/*" tabindex="-1" aria-hidden="true">
    </div>
    ${emojiPicker("adminSupportBody")}
    <input id="adminSupportBody" class="input" placeholder="اكتب الرد...">
    <button class="icon-action primary"><i data-lucide="send"></i></button>
  </form>`);
  $("#toggleUserChatBlock").onclick=async()=>{
    const blocked=!thread.is_user_blocked;
    const{error}=await supabase.rpc("admin_set_support_block",{p_thread_id:thread.id,p_blocked:blocked});
    if(error)return toast(error.message,"error");
    toast(blocked?"تم حظر إرسال المستخدم":"تم فك حظر المستخدم");
    thread.is_user_blocked=blocked;closeModal();openAdminSupportThread(thread);
  };
  $("#adminSupportForm").onsubmit=async e=>{
    e.preventDefault();const body=$("#adminSupportBody").value.trim(),file=$("#adminSupportImage").files[0];if(!body&&!file)return;
    try{
      const image=await uploadSupportImage(file);
      const{error}=await supabase.from("support_messages").insert({thread_id:thread.id,sender_id:S.user.id,body:body||null,image_url:image});
      if(error)throw error;
      playChatSound(false);closeModal();openAdminSupportThread(thread);
    }catch(err){toast(err.message,"error")}
  };
  bindEmojiPicker();bindChatImagePicker("adminSupportImage","adminSupportImageButton","adminSupportImageBadge");refreshIcons();const list=$("#adminSupportMessages");if(list)list.scrollTop=list.scrollHeight;
}
async function adminSettings(){const{data}=await supabase.from("store_settings").select("*").limit(1).maybeSingle(),s=data||{};$("#adminContent").innerHTML=`${section("إعدادات المتجر","الاسم والدعم والعملة")}<form id="settingsForm" class="card" style="padding:18px"><label>اسم المتجر<input id="setName" value="${esc(s.store_name||"علي شوب")}"></label>${imagePicker("storeLogoFile",s.logo_url||"")}<label>العملة<input id="setCurrency" value="${esc(s.currency||CONFIG.CURRENCY)}"></label><label>البريد<input id="setEmail" value="${esc(s.support_email||CONFIG.SUPPORT_EMAIL)}"></label><label>واتساب الدعم<input id="setWhats" value="${esc(s.support_whatsapp||CONFIG.WHATSAPP)}" placeholder="963..."></label><label>اسم مستخدم تلغرام<input id="setTelegram" value="${esc(s.support_telegram||"")}" placeholder="username بدون @"></label><button class="btn primary block">حفظ الإعدادات</button></form><div class="card item" style="margin-top:12px"><div class="item-main"><h3>تثبيت التطبيق</h3><p>استخدم زر التثبيت أو قائمة Chrome</p></div><button id="forceInstall" class="btn soft">تثبيت</button></div>`;$("#settingsForm").onsubmit=async e=>{e.preventDefault();let logo=s.logo_url||null;const logoFile=$("#storeLogoFile").files[0];if(logoFile)logo=await uploadFile(logoFile,"branding");const payload={store_name:$("#setName").value,logo_url:logo,currency:$("#setCurrency").value,support_email:$("#setEmail").value,support_whatsapp:$("#setWhats").value,support_telegram:$("#setTelegram").value,updated_at:new Date().toISOString()};const q=s.id?supabase.from("store_settings").update(payload).eq("id",s.id):supabase.from("store_settings").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");toast("تم حفظ الإعدادات");await loadPublic();applyBranding();adminSettings()};$("#forceInstall").onclick=()=>$("#installButton").click()}
async function adminLogs(){
  const{data,count}=await listQuery("admin_activity_logs","*,admin:profiles(full_name)",q=>{if(S.query)q=q.ilike("action",`%${S.query}%`);return q});
  const r=data||[];
  $("#adminContent").innerHTML=`${adminHeader("سجل المدير","عمليات الإدارة مترجمة وقابلة للتحكم",`<button id="exportLogs" class="btn soft">تصدير CSV</button><button id="clearLogs" class="btn danger">مسح الكل</button>`)}<div class="list">${r.map(l=>`<div class="card item"><div class="item-main"><h3>${esc(logLabel(l.action))}</h3><p>${esc(l.admin?.full_name||"مدير")} • ${esc(l.target_type||"النظام")} • ${dt(l.created_at)}</p></div><button class="danger" data-log-delete="${l.id}">حذف</button></div>`).join("")||empty("لا توجد سجلات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;
  bindAdminSearch(adminLogs);bindPager(adminLogs);$("#exportLogs").onclick=()=>exportCsv("admin_activity_logs","admin-logs.csv");
  $("#clearLogs").onclick=async()=>{if(!confirm("مسح جميع السجلات؟"))return;const{error}=await supabase.from("admin_activity_logs").delete().neq("id","00000000-0000-0000-0000-000000000000");if(error)return toast(error.message,"error");toast("تم مسح السجل");adminLogs()};
  $$("[data-log-delete]").forEach(b=>b.onclick=()=>deleteRow("admin_activity_logs",b.dataset.logDelete,"السجل",adminLogs))
}
async function deleteRow(table,id,label,render){if(!confirm(`تأكيد حذف ${label}؟`))return;const{error}=await supabase.from(table).delete().eq("id",id);if(error)return toast(error.message,"error");toast("تم الحذف");render()}
async function exportCsv(table,filename){const{data,error}=await supabase.from(table).select("*").limit(5000);if(error)return toast(error.message,"error");if(!data?.length)return toast("لا توجد بيانات","error");const keys=Object.keys(data[0]),csv=[keys.join(","),...data.map(r=>keys.map(k=>`"${String(r[k]??"").replaceAll('"','""')}"`).join(","))].join("\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href)}
renderAuthMode();init();

// V12 safety: the loading screen may never block the application indefinitely.
const v12SplashSafety=setTimeout(()=>{
  document.querySelector("#splash")?.classList.add("hide");
},4500);
window.addEventListener("load",()=>setTimeout(()=>{
  clearTimeout(v12SplashSafety);
  document.querySelector("#splash")?.classList.add("hide");
},300));
