import{CONFIG}from"./config.js";import{supabase}from"./supabase-client.js";
const APP_BUILD="13.0.0";
const $=(s,p=document)=>p.querySelector(s),$$=(s,p=document)=>[...p.querySelectorAll(s)];
const app=$("#app"),modal=$("#modalDialog"),auth=$("#authDialog");
const S={user:null,profile:null,wallet:{balance:0},products:[],categories:[],notes:[],slides:[],settings:{},authMode:"login",adminGroup:"dashboard",adminPage:"overview",page:1,query:"",filter:"",deferredInstall:null,productMode:"hub",orderTab:"digital",noteTab:"digital",platforms:[],socialCategories:[],adminBadges:{},floatingHidden:false,supportUnread:0};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=n=>`${Number(n||0).toFixed(2)} ${CONFIG.CURRENCY}`,dt=v=>new Date(v).toLocaleString("ar");
const debounce=(fn,ms=250)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
const LOG_LABELS={update_order:"تحديث طلب",set_user_status:"تغيير حالة مستخدم",adjust_wallet:"تعديل رصيد",approve_deposit:"قبول طلب شحن",reject_deposit:"رفض طلب شحن",create_product:"إضافة منتج",update_product:"تعديل منتج",delete_product:"حذف منتج",publish_announcement:"نشر إعلان",generate_cards:"توليد بطاقات شحن",update_slide:"تحديث سلايدر",delete_slide:"حذف سلايدر"};
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
  const message=event.error?.message||event.message;
  if(message&&!String(message).includes("ResizeObserver"))toast(friendlyError(message),"error");
});


function appConfirm({
  title="تأكيد العملية",
  message="هل أنت متأكد؟",
  confirmText="تأكيد",
  cancelText="إلغاء",
  icon="circle-alert",
  danger=false
}={}){
  return new Promise(resolve=>{
    openModal(`<div class="app-dialog">
      <div class="app-dialog-icon ${danger?"danger":""}"><i data-lucide="${icon}"></i></div>
      <div class="app-dialog-content">
        <h2>${esc(title)}</h2>
        <p>${esc(message)}</p>
      </div>
      <div class="app-dialog-actions">
        <button id="appDialogCancel" class="btn soft">${esc(cancelText)}</button>
        <button id="appDialogConfirm" class="btn ${danger?"danger":"primary"}">${esc(confirmText)}</button>
      </div>
    </div>`);
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      closeModal();
      resolve(value);
    };
    $("#appDialogCancel").onclick=()=>finish(false);
    $("#appDialogConfirm").onclick=()=>finish(true);
    const backdrop=$("#modal");
    const oldClose=backdrop?.onclick;
    if(backdrop)backdrop.onclick=e=>{
      if(e.target===backdrop)finish(false);
      else if(oldClose)oldClose(e);
    };
    refreshIcons();
  });
}

function appChoice({
  title="اختر",
  message="",
  icon="list-checks",
  options=[],
  current=null,
  confirmText="حفظ",
  cancelText="إلغاء"
}={}){
  return new Promise(resolve=>{
    let selected=current;
    openModal(`<div class="app-dialog">
      <div class="app-dialog-icon"><i data-lucide="${icon}"></i></div>
      <div class="app-dialog-content">
        <h2>${esc(title)}</h2>
        ${message?`<p>${esc(message)}</p>`:""}
        <div class="choice-dialog-options">
          ${options.map(option=>`<button type="button" class="choice-dialog-option ${option.value===current?"selected":""}" data-choice="${esc(option.value)}">
            <span><i data-lucide="${option.icon||"circle"}"></i></span>
            <strong>${esc(option.label)}</strong>
            <i data-lucide="${option.value===current?"circle-dot":"circle"}"></i>
          </button>`).join("")}
        </div>
      </div>
      <div class="app-dialog-actions">
        <button id="appDialogCancel" class="btn soft">${esc(cancelText)}</button>
        <button id="appDialogConfirm" class="btn primary">${esc(confirmText)}</button>
      </div>
    </div>`);
    $$("[data-choice]",modal).forEach(button=>button.onclick=()=>{
      selected=button.dataset.choice;
      $$("[data-choice]",modal).forEach(item=>item.classList.toggle("selected",item===button));
      refreshIcons();
    });
    $("#appDialogCancel").onclick=()=>{closeModal();resolve(null)};
    $("#appDialogConfirm").onclick=()=>{if(!selected)return toast("اختر أحد الخيارات","error");closeModal();resolve(selected)};
    refreshIcons();
  });
}

function appPrompt({
  title="أدخل المعلومات",
  message="",
  placeholder="",
  value="",
  confirmText="حفظ",
  cancelText="إلغاء",
  icon="message-square-text",
  required=true,
  multiline=true,
  danger=false
}={}){
  return new Promise(resolve=>{
    openModal(`<div class="app-dialog">
      <div class="app-dialog-icon ${danger?"danger":""}"><i data-lucide="${icon}"></i></div>
      <div class="app-dialog-content">
        <h2>${esc(title)}</h2>
        ${message?`<p>${esc(message)}</p>`:""}
        ${multiline
          ? `<textarea id="appDialogInput" class="app-dialog-input" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
          : `<input id="appDialogInput" class="app-dialog-input" placeholder="${esc(placeholder)}" value="${esc(value)}">`}
        <small id="appDialogError" class="app-dialog-error hidden">هذا الحقل مطلوب</small>
      </div>
      <div class="app-dialog-actions">
        <button id="appDialogCancel" class="btn soft">${esc(cancelText)}</button>
        <button id="appDialogConfirm" class="btn ${danger?"danger":"primary"}">${esc(confirmText)}</button>
      </div>
    </div>`);
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      closeModal();
      resolve(value);
    };
    $("#appDialogCancel").onclick=()=>finish(null);
    $("#appDialogConfirm").onclick=()=>{
      const input=$("#appDialogInput");
      const val=input.value.trim();
      if(required&&!val){
        $("#appDialogError").classList.remove("hidden");
        input.classList.add("invalid");
        input.focus();
        return;
      }
      finish(val);
    };
    $("#appDialogInput").oninput=e=>{
      e.target.classList.remove("invalid");
      $("#appDialogError").classList.add("hidden");
    };
    setTimeout(()=>$("#appDialogInput")?.focus(),80);
    refreshIcons();
  });
}


function selectDisplayText(select){
  const option=select.options[select.selectedIndex];
  return option?.textContent?.trim()||select.getAttribute("placeholder")||"اختر";
}
function refreshStyledSelect(select){
  const wrapper=select.closest(".styled-select");
  if(!wrapper)return;
  const text=wrapper.querySelector(".styled-select-text");
  if(text)text.textContent=selectDisplayText(select);
  wrapper.classList.toggle("disabled",select.disabled);
}
function styleSelect(select){
  if(!select||select.dataset.customSelect==="true"||select.multiple||select.size>1)return;
  select.dataset.customSelect="true";
  const wrapper=document.createElement("div");
  wrapper.className="styled-select";
  select.parentNode.insertBefore(wrapper,select);
  wrapper.appendChild(select);
  const button=document.createElement("button");
  button.type="button";
  button.className="styled-select-button";
  button.innerHTML=`<span class="styled-select-text"></span><i data-lucide="chevron-down"></i>`;
  wrapper.appendChild(button);
  const stopSelectActivation=event=>{
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  button.addEventListener("pointerdown",stopSelectActivation,true);
  button.addEventListener("mousedown",stopSelectActivation,true);
  button.addEventListener("touchstart",stopSelectActivation,{capture:true,passive:false});
  button.addEventListener("click",event=>{
    stopSelectActivation(event);
    if(select.disabled)return;
    openStyledSelect(select);
  },true);
  select.addEventListener("change",()=>refreshStyledSelect(select));
  refreshStyledSelect(select);
}
function styleAllSelects(scope=document){
  scope.querySelectorAll("select").forEach(styleSelect);
  refreshIcons();
}
function closeSelectOverlay(){
  const dialog=$("#selectChoiceDialog");
  if(!dialog)return;
  try{dialog.close()}catch{}
  dialog.remove();
}
function openStyledSelect(select){
  if(!select||!document.body.contains(select))return;

  closeSelectOverlay();

  const options=[...select.options].filter(option=>!option.hidden);
  const current=select.value;
  const label=select.closest("label");
  const title=label
    ? [...label.childNodes]
        .filter(node=>node.nodeType===Node.TEXT_NODE)
        .map(node=>node.textContent.trim())
        .filter(Boolean)[0]||"اختر من القائمة"
    : "اختر من القائمة";

  const dialog=document.createElement("dialog");
  dialog.id="selectChoiceDialog";
  dialog.className="select-choice-dialog";
  dialog.innerHTML=`<div class="select-dialog-sheet">
    <div class="select-overlay-handle"></div>
    <div class="sheet-head">
      <div><h2>${esc(title)}</h2><p>${options.length} خيارات متاحة</p></div>
      <button type="button" id="closeSelectChoice" aria-label="إغلاق"><i data-lucide="x"></i></button>
    </div>
    <div class="custom-select-search-wrap ${options.length>7?"":"hidden"}">
      <i data-lucide="search"></i>
      <input id="customSelectSearch" class="input" placeholder="بحث في الخيارات...">
    </div>
    <div id="customSelectOptions" class="custom-select-options">
      ${options.map((option,index)=>`<button type="button" class="custom-select-option ${option.value===current?"selected":""}" data-select-index="${index}" ${option.disabled?"disabled":""}>
        <span class="custom-radio"><i data-lucide="${option.value===current?"circle-dot":"circle"}"></i></span>
        <span>${esc(option.textContent.trim())}</span>
        ${option.disabled?`<small>غير متاح</small>`:""}
      </button>`).join("")}
    </div>
  </div>`;

  document.body.appendChild(dialog);

  dialog.addEventListener("cancel",event=>{
    event.preventDefault();
    closeSelectOverlay();
  });
  dialog.addEventListener("click",event=>{
    const rect=dialog.getBoundingClientRect();
    const inside=
      event.clientX>=rect.left&&event.clientX<=rect.right&&
      event.clientY>=rect.top&&event.clientY<=rect.bottom;
    if(!inside)closeSelectOverlay();
  });

  $("#closeSelectChoice",dialog).onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    closeSelectOverlay();
  };

  $$("[data-select-index]",dialog).forEach(button=>{
    button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();

      const option=options[Number(button.dataset.selectIndex)];
      if(!option||option.disabled||!document.body.contains(select))return;

      select.value=option.value;
      refreshStyledSelect(select);

      // Notify the original form while it is still present.
      select.dispatchEvent(new Event("change",{bubbles:true}));
      closeSelectOverlay();
    };
  });

  const search=$("#customSelectSearch",dialog);
  if(search){
    search.oninput=()=>{
      const query=search.value.trim().toLowerCase();
      $$("[data-select-index]",dialog).forEach(button=>{
        const option=options[Number(button.dataset.selectIndex)];
        button.classList.toggle(
          "hidden",
          !option.textContent.toLowerCase().includes(query)
        );
      });
    };
  }

  dialog.showModal();
  requestAnimationFrame(()=>dialog.classList.add("show"));
  if(search)setTimeout(()=>search.focus(),120);
  refreshIcons();
}

const selectObserver=new MutationObserver(mutations=>{
  for(const mutation of mutations){
    mutation.addedNodes.forEach(node=>{
      if(node.nodeType!==1)return;
      if(node.matches?.("select"))styleSelect(node);
      node.querySelectorAll?.("select").forEach(styleSelect);
    });
  }
});
function initStyledControls(){
  styleAllSelects(document);
  selectObserver.observe(document.body,{childList:true,subtree:true});
}


const ORDER_DIRECT_CANCEL_SECONDS=10;

function orderCancelMode(order){
  const finalStatuses=["delivered","cancelled","refunded","completed"];
  if(finalStatuses.includes(order.status))return "hidden";
  if(order.cancel_request_status==="pending")return "requested";
  if(!["pending","paid","processing"].includes(order.status))return "hidden";

  const createdAt=new Date(order.created_at).getTime();
  if(!Number.isFinite(createdAt))return "request";
  const elapsed=Math.max(0,Math.floor((Date.now()-createdAt)/1000));
  return elapsed<ORDER_DIRECT_CANCEL_SECONDS?"direct":"request";
}

function orderCancelSecondsLeft(order){
  const createdAt=new Date(order.created_at).getTime();
  if(!Number.isFinite(createdAt))return 0;
  return Math.max(0,ORDER_DIRECT_CANCEL_SECONDS-Math.floor((Date.now()-createdAt)/1000));
}

function orderCancelButton(order){
  const mode=orderCancelMode(order);
  if(mode==="hidden")return "";
  if(mode==="requested"){
    return `<button class="order-cancel-action requested" disabled><i data-lucide="clock-3"></i><span>طلب الإلغاء مرسل</span></button>`;
  }
  if(mode==="direct"){
    const left=orderCancelSecondsLeft(order);
    return `<button class="order-cancel-action direct" data-direct-cancel="${order.id}" data-order-created="${esc(order.created_at)}"><i data-lucide="x"></i><span>إلغاء</span><b data-cancel-countdown="${order.id}">${left}</b></button>`;
  }
  return `<button class="order-cancel-action request" data-request-cancel="${order.id}"><i data-lucide="message-square-warning"></i><span>طلب الإلغاء</span></button>`;
}

function startOrderCancelCountdown(orders,rerender){
  clearInterval(window.__orderCancelCountdown);
  const active=orders.some(order=>orderCancelMode(order)==="direct");
  if(!active)return;
  window.__orderCancelCountdown=setInterval(()=>{
    let needsRender=false;
    orders.forEach(order=>{
      const badge=$(`[data-cancel-countdown="${order.id}"]`);
      if(!badge)return;
      const left=orderCancelSecondsLeft(order);
      badge.textContent=left;
      if(left<=0)needsRender=true;
    });
    if(needsRender){
      clearInterval(window.__orderCancelCountdown);
      rerender();
    }
  },1000);
}

async function directCancelOrder(orderId){
  const approved=await appConfirm({
    title:"إلغاء الطلب",
    message:"ما زلت ضمن مهلة الإلغاء الفوري. سيُلغى الطلب ويُعاد الرصيد مباشرة.",
    confirmText:"إلغاء وإعادة الرصيد",
    icon:"rotate-ccw",
    danger:true
  });
  if(!approved)return;

  const{data,error}=await supabase.rpc("cancel_order_within_grace_period",{
    p_order_id:orderId
  });
  if(error)return toast(friendlyError(error),"error");
  toast(data?.message||"تم إلغاء الطلب وإعادة الرصيد");
  await loadIdentity();
  orders();
}

async function requestCancelOrder(orderId){
  const reason=await appPrompt({
    title:"طلب إلغاء الطلب",
    message:"انتهت مهلة الإلغاء الفوري. اكتب سبب الإلغاء ليتم مراجعته من الإدارة.",
    placeholder:"سبب طلب الإلغاء",
    confirmText:"إرسال الطلب",
    icon:"message-square-warning",
    danger:true
  });
  if(!reason)return;

  const{data,error}=await supabase.rpc("request_order_cancel",{
    p_order_id:orderId,
    p_reason:reason
  });
  if(error)return toast(friendlyError(error),"error");
  toast(data?.message||"تم إرسال طلب الإلغاء");
  orders();
}

function refreshIcons(){if(window.lucide)window.lucide.createIcons({attrs:{"stroke-width":1.9}})}
function iconButton(name,label,attrs=""){return `<button class="icon-action" title="${esc(label)}" aria-label="${esc(label)}" ${attrs}><i data-lucide="${name}"></i></button>`}
function playNotificationSound(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),g=c.createGain(),o1=c.createOscillator(),o2=c.createOscillator();g.connect(c.destination);o1.connect(g);o2.connect(g);o1.frequency.value=880;o2.frequency.value=1320;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.1,c.currentTime+.012);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.18);o1.start();o2.start(c.currentTime+.045);o1.stop(c.currentTime+.17);o2.stop(c.currentTime+.19)}catch{}}
const ADMIN_ICONS={sales:"receipt-text",catalog:"package-search",finance:"wallet-cards",users:"users-round",marketing:"megaphone",smm:"rocket",system:"settings-2"};

function toast(m,t="success"){const e=document.createElement("div");e.className=`toast ${t}`;e.textContent=m;$("#toastRoot").append(e);setTimeout(()=>e.remove(),3200)}
function badge(s){const m={pending:["قيد المراجعة","warning"],approved:["مقبول","success"],rejected:["مرفوض","danger"],paid:["مدفوع","success"],processing:["قيد التنفيذ","warning"],delivered:["تم التسليم","success"],cancelled:["ملغي","danger"],refunded:["مسترد","warning"],active:["نشط","success"],blocked:["محظور","danger"],available:["متاح","success"],paused:["موقوف","warning"],sold_out:["نفد","danger"]};const[t,c]=m[s]||[s||"-",""];return`<span class="badge ${c}">${t}</span>`}
function section(t,p,a=""){return`<div class="section"><div><h2>${t}</h2><p>${p}</p></div>${a}</div>`}
function empty(t,p="لا توجد بيانات"){return`<div class="card empty"><h2>${t}</h2><p>${p}</p></div>`}
function openModal(h){modal.innerHTML=`<div class="dialog-body"><div class="grip"></div>${h}</div>`;modal.showModal();document.body.style.overflow="hidden";$$("[data-close]",modal).forEach(b=>b.onclick=closeModal);setTimeout(()=>{styleAllSelects(modal);refreshIcons()},0)}
function closeModal(){closeSelectOverlay();modal.close();document.body.style.overflow=""}
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

    supabase.auth.onAuthStateChange(async(_,session)=>{
      try{
        S.user=session?.user||null;
        await loadIdentity();
        await loadNotes();
        await loadAdminBadges();
        updateHeader();
        renderFloatingContacts();
        route();
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
function bind(){setTimeout(initStyledControls,0);$("#themeButton").onclick=()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");$("#notificationButton").onclick=showNotes;$("#authForm").onsubmit=submitAuth;$("#switchAuth").onclick=()=>{S.authMode=S.authMode==="login"?"register":"login";renderAuthMode()};$$("[data-close-dialog]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.closeDialog).close());window.addEventListener("hashchange",route);window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();S.deferredInstall=e;$("#installButton").classList.remove("hidden")});$("#installButton").onclick=async()=>{if(!S.deferredInstall)return toast("استخدم خيار تثبيت التطبيق من قائمة Chrome","error");S.deferredInstall.prompt();await S.deferredInstall.userChoice;S.deferredInstall=null;$("#installButton").classList.add("hidden")}}
function setTheme(t){document.documentElement.dataset.theme=t;localStorage.theme=t;$("#themeButton").innerHTML=`<i data-lucide="${t==="dark"?"sun":"moon"}"></i>`;setTimeout(refreshIcons,0)}
function renderAuthMode(){const r=S.authMode==="register";$("#registerFields").classList.toggle("hidden",!r);$("#authTitle").textContent=r?"إنشاء حساب":"تسجيل الدخول";$("#authSubmit").textContent=r?"إنشاء الحساب":"دخول";$("#switchAuth").textContent=r?"لديك حساب؟ سجل الدخول":"ليس لديك حساب؟ أنشئ حسابًا"}
async function submitAuth(e){e.preventDefault();try{const email=$("#email").value.trim(),password=$("#password").value;if(S.authMode==="register"){const{error}=await supabase.auth.signUp({email,password,options:{data:{full_name:$("#fullName").value.trim(),phone:$("#phone").value.trim()}}});if(error)throw error}else{const{error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error}auth.close();toast("تمت العملية بنجاح")}catch(e){toast(e.message,"error")}}
async function loadIdentity(){S.profile=null;S.wallet={balance:0};if(!S.user)return;const[{data:p},{data:w}]=await Promise.all([supabase.from("profiles").select("*").eq("id",S.user.id).maybeSingle(),supabase.from("wallets").select("balance").eq("user_id",S.user.id).maybeSingle()]);S.profile=p;S.wallet=w||{balance:0}}
async function loadPublic(){const[{data:s},{data:a},{data:st}]=await Promise.all([supabase.from("store_slides").select("*").eq("is_active",true).order("sort_order"),supabase.from("announcements").select("*").eq("is_active",true).eq("kind","bar").order("created_at",{ascending:false}).limit(1),supabase.from("store_settings").select("*").limit(1).maybeSingle()]);S.slides=s||[];S.settings=st||{};applyBranding();renderFloatingContacts();const bar=$("#announcementBar");if(a?.[0]){bar.innerHTML=`${esc(a[0].message)}<button>×</button>`;bar.classList.remove("hidden");bar.classList.remove("news-enter");void bar.offsetWidth;bar.classList.add("news-enter");bar.querySelector("button").onclick=()=>bar.classList.add("hidden")}else bar.classList.add("hidden")}
async function loadNotes(){S.notes=[];if(!S.user)return;const{data}=await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(50);S.notes=data||[]}
function updateHeader(){$("#notificationButton").classList.toggle("hidden",!S.user);const n=S.notes.filter(x=>!x.is_read).length;$("#notificationCount").textContent=n;$("#notificationCount").classList.toggle("hidden",!n)}
function subscribeRealtime(){if(!S.user)return;supabase.channel(`notes-${S.user.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},async p=>{if(p.new.user_id===S.user.id||p.new.user_id===null){playNotificationSound();toast(p.new.title);await loadNotes();updateHeader()}}).subscribe();supabase.channel(`support-${S.user.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"support_messages"},async p=>{if(p.new.sender_id!==S.user.id){playChatSound(true);toast("رسالة جديدة من الدعم");renderFloatingContacts()}}).subscribe()}
async function showNotes(){
  if(!needUser())return;
  const digital=S.notes.filter(n=>n.type==="order"&&!String(n.body||"").includes("السوشل"));
  const social=S.notes.filter(n=>n.type==="social_order"||String(n.title||"").includes("السوشل")||String(n.body||"").includes("السوشل"));
  const finance=S.notes.filter(n=>["wallet","deposit","refund","recharge"].includes(n.type));
  const general=S.notes.filter(n=>!digital.includes(n)&&!social.includes(n)&&!finance.includes(n));
  const render=(list,icon)=>list.length?list.map(n=>`<div class="card notification-card ${n.is_read?"":"unread"}"><div class="notification-icon"><i data-lucide="${icon}"></i></div><div class="item-main"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><small>${dt(n.created_at)}</small></div></div>`).join(""):empty("لا توجد إشعارات");
  openModal(`<div class="sheet-head"><div><h2>الإشعارات</h2><p>مقسمة حسب نوع الطلب والحركة</p></div><button data-close>×</button></div>
  <div class="tabs notification-tabs"><button class="tab active" data-note-tab="digital"><i data-lucide="package"></i> المنتجات <span>${digital.length}</span></button><button class="tab" data-note-tab="social"><i data-lucide="messages-square"></i> السوشل <span>${social.length}</span></button><button class="tab" data-note-tab="finance"><i data-lucide="wallet-cards"></i> المالية <span>${finance.length}</span></button><button class="tab" data-note-tab="general"><i data-lucide="bell"></i> عامة <span>${general.length}</span></button></div>
  <div id="noteDigital" class="list">${render(digital,"package")}</div><div id="noteSocial" class="list hidden">${render(social,"messages-square")}</div><div id="noteFinance" class="list hidden">${render(finance,"wallet-cards")}</div><div id="noteGeneral" class="list hidden">${render(general,"bell")}</div>`);
  $$("[data-note-tab]",modal).forEach(b=>b.onclick=()=>{$$("[data-note-tab]",modal).forEach(x=>x.classList.remove("active"));b.classList.add("active");["Digital","Social","Finance","General"].forEach(x=>$(`#note${x}`,modal).classList.toggle("hidden",b.dataset.noteTab!==x.toLowerCase()))});
  const ids=S.notes.filter(n=>!n.is_read&&n.user_id===S.user.id).map(n=>n.id);if(ids.length){await supabase.from("notifications").update({is_read:true}).in("id",ids);await loadNotes();updateHeader()}refreshIcons();
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
async function buy(p){if(!needUser())return;const approved=await appConfirm({title:"تأكيد الشراء",message:`هل تريد شراء ${p.name}؟`,confirmText:"شراء الآن",icon:"shopping-cart"});if(!approved)return;const code=$("#couponCode")?.value.trim()||null;const customerData={};$$(`[data-order-field]`,modal).forEach(x=>customerData[x.dataset.fieldLabel]=x.value.trim());const{error}=await supabase.rpc("purchase_product_v6",{p_product_id:p.id,p_idempotency_key:crypto.randomUUID(),p_coupon_code:code,p_customer_data:customerData});if(error)return toast(error.message,"error");toast("تم الشراء");closeModal();await loadIdentity();location.hash="#/orders"}
async function orders(){
  if(!needUser())return app.innerHTML=empty("طلباتي","سجل الدخول");

  const [digitalResult,socialResult,cancelResult]=await Promise.all([
    supabase.from("orders")
      .select("*,product:products(name,image_url)")
      .eq("user_id",S.user.id)
      .order("created_at",{ascending:false})
      .limit(300),
    supabase.from("smm_orders")
      .select("*,service:smm_services(name,platform:social_platforms(name,icon))")
      .eq("user_id",S.user.id)
      .order("created_at",{ascending:false})
      .limit(300),
    supabase.from("order_cancel_requests")
      .select("order_id,status")
      .eq("user_id",S.user.id)
  ]);

  if(digitalResult.error||socialResult.error){
    app.innerHTML=`${section("طلباتي","تعذر تحميل الطلبات")}
      <div class="card empty"><h2>حدث خطأ</h2><p>${esc(friendlyError(digitalResult.error||socialResult.error))}</p><button id="retryOrders" class="btn primary">إعادة المحاولة</button></div>`;
    $("#retryOrders").onclick=orders;
    refreshIcons();
    return;
  }

  const cancelMap=Object.fromEntries((cancelResult.data||[]).map(x=>[x.order_id,x.status]));
  const digital=(digitalResult.data||[]).map(order=>({...order,cancel_request_status:cancelMap[order.id]||null}));
  const social=socialResult.data||[];
  const tab=S.orderTab||"digital";

  const render=()=>{
    const isDigital=(S.orderTab||"digital")==="digital";
    app.innerHTML=`${section("طلباتي","متابعة المنتجات الرقمية ومنتجات السوشل")}
      <div class="catalog-top-tabs">
        <button class="${isDigital?"active":""}" data-user-order-tab="digital"><i data-lucide="package"></i><span>منتجات رقمية</span><b>${digital.length}</b></button>
        <button class="${!isDigital?"active":""}" data-user-order-tab="social"><i data-lucide="messages-square"></i><span>منتجات السوشل</span><b>${social.length}</b></button>
      </div>
      <div class="list">${isDigital
        ? digital.map(order=>`<div class="card order-card">
            <button class="order-card-main" data-order-details="${order.id}">
              <div class="order-thumb">${order.product?.image_url?`<img src="${esc(order.product.image_url)}">`:`<i data-lucide="package"></i>`}</div>
              <div class="item-main"><h3>${esc(order.product?.name||"منتج رقمي")}</h3><p>${esc(order.order_number||"")} • ${money(order.total)} • ${dt(order.created_at)}</p></div>
              ${badge(order.status)}
            </button>
            <div class="order-card-actions">${orderCancelButton(order)}</div>
          </div>`).join("")||empty("لا توجد طلبات رقمية")
        : social.map(order=>`<div class="card order-card">
            <button class="order-card-main" data-social-order-details="${order.id}">
              <div class="platform-list-icon"><i data-lucide="${order.service?.platform?.icon||"messages-square"}"></i></div>
              <div class="item-main"><h3>${esc(order.service?.name||"منتج سوشل")}</h3><p>${order.quantity||0} • ${esc(order.order_number||"")} • ${dt(order.created_at)}</p></div>
              ${badge(order.status)}
            </button>
          </div>`).join("")||empty("لا توجد طلبات سوشل")}
      </div>`;

    $$("[data-user-order-tab]").forEach(button=>button.onclick=()=>{
      S.orderTab=button.dataset.userOrderTab;
      render();
    });
    $$("[data-order-details]").forEach(button=>button.onclick=()=>{
      const order=digital.find(x=>x.id===button.dataset.orderDetails);
      if(order)orderDetails(order);
    });
    $$("[data-direct-cancel]").forEach(button=>button.onclick=()=>directCancelOrder(button.dataset.directCancel));
    $$("[data-request-cancel]").forEach(button=>button.onclick=()=>requestCancelOrder(button.dataset.requestCancel));

    if(isDigital)startOrderCancelCountdown(digital,render);
    else clearInterval(window.__orderCancelCountdown);
    refreshIcons();
  };

  S.orderTab=tab;
  render();
}
async function wallet(){
  if(!needUser())return app.innerHTML=empty("المحفظة","سجل الدخول");

  const [txResult,depositResult,methodsResult]=await Promise.all([
    supabase.from("wallet_transactions").select("*").order("created_at",{ascending:false}).limit(300),
    supabase.from("deposit_requests").select("*").eq("user_id",S.user.id).order("created_at",{ascending:false}).limit(100),
    supabase.from("payment_methods").select("id,name")
  ]);

  if(txResult.error||depositResult.error){
    app.innerHTML=`${section("المحفظة","تعذر تحميل السجل")}<div class="card empty"><h2>حدث خطأ</h2><p>${esc(friendlyError(txResult.error||depositResult.error))}</p><button id="retryWallet" class="btn primary">إعادة المحاولة</button></div>`;
    $("#retryWallet").onclick=wallet;
    refreshIcons();
    return;
  }

  const tx=txResult.data||[];
  const methods=Object.fromEntries((methodsResult.data||[]).map(x=>[x.id,x.name]));
  const deposits=(depositResult.data||[]).map(d=>({...d,payment_method_name:methods[d.payment_method_id]||"طريقة دفع"}));

  const draw=()=>{
    const rows=tx.filter(x=>!S.walletType||x.type===S.walletType);
    app.innerHTML=`${section("المحفظة","الرصيد والحركات المالية",`<button id="deposit" class="btn primary"><i data-lucide="plus"></i> شحن</button>`)}
    <div class="stats">
      <div class="card stat"><small>الرصيد</small><strong>${money(S.wallet.balance)}</strong></div>
      <div class="card stat"><small>طلبات الشحن</small><strong>${deposits.length}</strong></div>
    </div>

    <div class="card item" style="margin-top:10px">
      <div class="item-main"><h3>استخدام بطاقة شحن</h3><p>أدخل الرمز لإضافة الرصيد</p></div>
      <button id="redeemCard" class="icon-action"><i data-lucide="scan-line"></i></button>
    </div>

    ${section("طلبات الشحن","تابع حالة الطلبات والإثباتات")}
    <div class="list deposit-history">
      ${deposits.map(d=>`<div class="card item">
        <div class="transaction-icon ${d.status==="approved"?"in":d.status==="rejected"?"out":"pending"}"><i data-lucide="${d.status==="approved"?"check":d.status==="rejected"?"x":"clock-3"}"></i></div>
        <div class="item-main">
          <h3>${money(d.amount)} • ${esc(d.payment_method_name)}</h3>
          <p>${esc(d.transfer_reference||d.reference_code||"-")} • ${dt(d.created_at)}</p>
          ${d.admin_note?`<small class="deposit-admin-note">${esc(d.admin_note)}</small>`:""}
        </div>
        <div class="item-actions">
          ${badge(d.status)}
          ${(d.receipt_url||d.proof_url)?iconButton("eye","معاينة الإثبات",`data-user-deposit-proof="${d.id}"`):""}
        </div>
      </div>`).join("")||empty("لا توجد طلبات شحن")}
    </div>

    ${section("الحركات المالية","فرز حسب نوع العملية")}
    <div class="wallet-filter-tabs">
      <button class="${!S.walletType?"active":""}" data-wallet-type="">الكل</button>
      <button class="${S.walletType==="purchase"?"active":""}" data-wallet-type="purchase">مشتريات</button>
      <button class="${S.walletType==="refund"?"active":""}" data-wallet-type="refund">استرداد</button>
      <button class="${S.walletType==="deposit"?"active":""}" data-wallet-type="deposit">شحن</button>
      <button class="${S.walletType==="recharge_card"?"active":""}" data-wallet-type="recharge_card">بطاقات</button>
    </div>
    <div class="list">
      ${rows.map(x=>`<div class="card item">
        <div class="transaction-icon ${Number(x.amount)>=0?"in":"out"}"><i data-lucide="${Number(x.amount)>=0?"arrow-down-left":"arrow-up-right"}"></i></div>
        <div class="item-main"><h3>${esc(x.description||x.type)}</h3><p>${dt(x.created_at)}</p></div>
        <strong class="${Number(x.amount)>=0?"amount-in":"amount-out"}">${Number(x.amount)>=0?"+":""}${money(x.amount)}</strong>
      </div>`).join("")||empty("لا توجد حركات")}
    </div>`;

    $("#deposit").onclick=depositForm;
    $("#redeemCard").onclick=async()=>{
      const code=await appPrompt({
        title:"استخدام بطاقة شحن",
        message:"أدخل رمز بطاقة الشحن لإضافة الرصيد إلى محفظتك.",
        placeholder:"ALI-XXXXXXXXXXXX",
        confirmText:"شحن الرصيد",
        icon:"scan-line",
        multiline:false
      });
      if(!code)return;
      const{data,error}=await supabase.rpc("redeem_recharge_card",{p_code:code.trim()});
      if(error)return toast(friendlyError(error),"error");
      toast(data.message||"تم شحن الرصيد");
      await loadIdentity();
      wallet();
    };

    $$("[data-wallet-type]").forEach(b=>b.onclick=()=>{S.walletType=b.dataset.walletType;draw()});
    $$("[data-user-deposit-proof]").forEach(button=>button.onclick=()=>{
      const d=deposits.find(x=>x.id===button.dataset.userDepositProof);
      const proof=d?.receipt_url||d?.proof_url;
      if(!proof)return toast("لا يوجد إثبات مرفوع","error");
      openModal(`<div class="sheet-head"><div><h2>إثبات الدفع</h2><p>${money(d.amount)} • ${esc(d.payment_method_name)}</p></div><button data-close>×</button></div><img class="deposit-proof-image" src="${esc(proof)}" alt="إثبات الدفع"><a class="btn soft block" href="${esc(proof)}" target="_blank"><i data-lucide="external-link"></i> فتح بالحجم الكامل</a>`);
    });
    refreshIcons();
  };
  draw();
}
async function depositForm(){const{data}=await supabase.from("payment_methods").select("*").eq("is_active",true).order("sort_order"),m=data||[];if(!m.length)return toast("لا توجد طرق دفع","error");openModal(`<div class="sheet-head"><h2>طلب شحن</h2><button data-close>×</button></div><form id="df"><label>طريقة الدفع<select id="method">${m.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>المبلغ<input id="amount" type="number" min="1" required></label><label>رقم التحويل<input id="ref" required></label><label>إثبات الدفع${imagePicker("receiptFile")}</label><button id="depositSubmit" class="btn primary block">إرسال</button></form>`);$("#df").onsubmit=async e=>{e.preventDefault();const btn=$("#depositSubmit");btn.disabled=true;try{const receipt=await uploadFile($("#receiptFile").files[0],"receipts");const{error}=await supabase.from("deposit_requests").insert({user_id:S.user.id,payment_method_id:$("#method").value,amount:+$("#amount").value,transfer_reference:$("#ref").value,receipt_url:receipt});if(error)throw error;toast("تم إرسال الطلب");closeModal();wallet()}catch(err){toast(err.message,"error")}finally{btn.disabled=false}}}
async function socialServices(){location.hash="#/products?tab=social"}
function smmOrderForm(){location.hash="#/social-services"}
function account(){if(!S.user){app.innerHTML=`${section("حسابي","سجل الدخول")}<div class="card empty"><h2>أهلًا بك</h2><button id="openAuth" class="btn primary">تسجيل الدخول</button></div>`;$("#openAuth").onclick=()=>auth.showModal();return}app.innerHTML=`${section("حسابي","المعلومات والإعدادات")}<div class="card item"><div class="item-main"><h3>${esc(S.profile?.full_name||"مستخدم")}</h3><p>${esc(S.user.email)}</p></div>${badge(S.profile?.status)}</div>${S.profile?.role==="admin"?`<a href="#/admin" class="card item" style="margin-top:11px"><div class="item-main"><h3>لوحة الإدارة</h3><p>إدارة المتجر بالكامل</p></div><span>›</span></a>`:""}<button id="logout" class="card item" style="width:100%;margin-top:11px;color:var(--bad)"><h3>تسجيل الخروج</h3></button>`;$("#logout").onclick=()=>supabase.auth.signOut()}

/* ---------- ADMIN ---------- */
async function admin(){if(!needAdmin())return;if(!validateAdminRegistry())return;if(S.adminGroup==="dashboard"){app.innerHTML=`${section("لوحة الإدارة","اختر القسم المطلوب")}<div class="admin-groups">${[["sales","المبيعات","الطلبات والإلغاء والاسترداد"],["catalog","الكتالوج","المنتجات والتصنيفات والمخزون"],["finance","الأموال","الشحن وطرق الدفع والبطاقات والكوبونات"],["users","المستخدمون","الحسابات والأرصدة والحظر"],["marketing","التسويق","السلايدر والإعلانات والإشعارات"],["system","النظام","إعدادات المتجر والسجلات"]].map(([id,t,p])=>`<button class="card admin-tile" data-group="${id}"><span class="tile-icon"><i data-lucide="${ADMIN_ICONS[id]||"circle-dot"}"></i>${adminBadge(id)}</span><h3>${t}</h3><p>${p}</p></button>`).join("")}</div>`;$$("[data-group]").forEach(b=>b.onclick=()=>{S.adminGroup=b.dataset.group;S.adminPage={sales:"orders",catalog:"catalog_items",finance:"deposits",users:"users",marketing:"slides",system:"settings"}[S.adminGroup];S.page=1;S.query="";S.filter="";admin()});return}const pages={sales:[["orders","الطلبات"],["cancel_requests","طلبات الإلغاء"]],catalog:[["catalog_items","الكتالوج"],["categories","التصنيفات"],["inventory","المخزون"]],finance:[["deposits","طلبات الشحن"],["transactions","الحركات المالية"],["payment_methods","طرق الدفع"],["cards","بطاقات الشحن"],["coupons","الكوبونات"]],users:[["users","المستخدمون"]],marketing:[["slides","السلايدر"],["announcements","الإعلانات"],["notifications","الإشعارات"]],system:[["settings","الإعدادات"],["support","الدعم"],["logs","سجل المدير"]]}[S.adminGroup];app.innerHTML=`${section("لوحة الإدارة",S.adminGroup,`<button id="backAdmin" class="btn soft">الرئيسية</button>`)}<div class="tabs">${pages.map(([id,n])=>`<button class="tab ${S.adminPage===id?"active":""}" data-admin-page="${id}">${n}${adminBadge(id)}</button>`).join("")}</div><div id="adminContent"></div>`;$("#backAdmin").onclick=()=>{S.adminGroup="dashboard";admin()};$$("[data-admin-page]").forEach(b=>b.onclick=()=>{S.adminPage=b.dataset.adminPage;S.page=1;S.query="";S.filter="";renderAdminPage()});renderAdminPage()}

function validateAdminRegistry(){
  const required={
    orders:adminOrders,
    cancel_requests:adminCancelRequests,
    catalog_items:adminCatalogItems,
    categories:adminCategories,
    inventory:adminInventory,
    deposits:adminDeposits,
    transactions:adminTransactions,
    payment_methods:adminPaymentMethods,
    cards:adminCards,
    coupons:adminCoupons,
    users:adminUsers,
    slides:adminSlides,
    announcements:adminAnnouncements,
    notifications:adminNotifications,
    settings:adminSettings,
    support:adminSupport,
    logs:adminLogs
  };
  const missing=Object.entries(required).filter(([,handler])=>typeof handler!=="function").map(([name])=>name);
  if(missing.length){
    console.error("Missing admin handlers:",missing);
    toast(`صفحات إدارة غير متاحة: ${missing.join(", ")}`,"error");
    return false;
  }
  return true;
}

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
async function adminCancelRequests(){const{data,count}=await listQuery("order_cancel_requests","*,order:orders(order_number,total,status),profile:profiles(full_name)",q=>{if(S.filter)q=q.eq("status",S.filter);return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("طلبات الإلغاء","مراجعة طلبات العملاء")}<div class="list">${r.map(x=>`<div class="card item"><div class="item-main"><h3>${esc(x.order?.order_number||"-")}</h3><p>${esc(x.profile?.full_name||"-")} • ${esc(x.reason)}</p></div><div class="item-actions">${badge(x.status)}${x.status==="pending"?`<button class="success" data-cancel-approve="${x.id}">قبول</button><button class="danger" data-cancel-reject="${x.id}">رفض</button>`:""}</div></div>`).join("")||empty("لا توجد طلبات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminCancelRequests,[["pending","معلق"],["approved","مقبول"],["rejected","مرفوض"]]);bindPager(adminCancelRequests);$$("[data-cancel-approve]").forEach(b=>b.onclick=()=>reviewCancel(b.dataset.cancelApprove,true));$$("[data-cancel-reject]").forEach(b=>b.onclick=()=>reviewCancel(b.dataset.cancelReject,false))}
async function reviewCancel(id,approve){const reason=approve?"قبول طلب الإلغاء":await appPrompt({title:"رفض طلب الإلغاء",message:"اكتب سبب رفض طلب الإلغاء ليظهر للمستخدم.",placeholder:"سبب الرفض",confirmText:"رفض الطلب",icon:"circle-x",danger:true});if(!approve&&!reason)return;const{error}=await supabase.rpc("admin_review_cancel_request",{p_request_id:id,p_approve:approve,p_reason:reason});if(error)return toast(error.message,"error");toast("تمت معالجة الطلب");adminCancelRequests()}

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
    const preview=$("#productLivePreview");
    if(!preview)return;
    const name=$("#pn")?.value?.trim()||"اسم المنتج";
    const price=Number($("#pp")?.value||0);
    const file=$("#productImageFile")?.files?.[0];
    const image=file?URL.createObjectURL(file):(p?.image_url||null);
    preview.innerHTML=`<div class="mini-product-preview">${image?`<img src="${image}">`:`<div><i data-lucide="image"></i></div>`}<span><small>معاينة</small><strong>${esc(name)}</strong><b>${money(price)}</b></span></div>`;
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

async function adminCategories(){
  let query=supabase
    .from("categories")
    .select("*",{count:"exact"})
    .order("sort_order",{ascending:true})
    .order("created_at",{ascending:false});

  if(S.query)query=query.ilike("name",`%${S.query}%`);
  if(S.filter==="active")query=query.eq("is_active",true);
  if(S.filter==="inactive")query=query.eq("is_active",false);
  if(S.filter==="root")query=query.is("parent_id",null);
  if(S.filter==="child")query=query.not("parent_id","is",null);

  const from=(S.page-1)*CONFIG.PAGE_SIZE;
  const [result,parentsResult]=await Promise.all([
    query.range(from,from+CONFIG.PAGE_SIZE-1),
    supabase.from("categories").select("id,name")
  ]);

  if(result.error){
    $("#adminContent").innerHTML=`${section("التصنيفات","تعذر تحميل التصنيفات")}
      <div class="card empty"><h2>حدث خطأ أثناء تحميل التصنيفات</h2><p>${esc(friendlyError(result.error))}</p><button id="retryCategories" class="btn primary">إعادة المحاولة</button></div>`;
    $("#retryCategories").onclick=adminCategories;
    refreshIcons();
    return;
  }

  const parentNames=Object.fromEntries((parentsResult.data||[]).map(item=>[item.id,item.name]));
  const rows=result.data||[];
  $("#adminContent").innerHTML=`${adminHeader("التصنيفات","الأقسام الرئيسية والفرعية للمنتجات الرقمية",`<button id="addCategory" class="btn primary"><i data-lucide="folder-plus"></i><span>إضافة تصنيف</span></button>`)}
  <div class="list">${rows.map(category=>`<div class="card item">
    <div class="order-thumb">${category.image_url?`<img src="${esc(category.image_url)}" alt="">`:`<i data-lucide="${category.parent_id?"folder":"folders"}"></i>`}</div>
    <div class="item-main"><h3>${esc(category.name)}</h3><p>${category.parent_id?`داخل ${esc(parentNames[category.parent_id]||"قسم فرعي")}`:"قسم رئيسي"} • الترتيب ${category.sort_order||0}</p></div>
    <div class="item-actions">${category.is_active?badge("active"):badge("blocked")}${iconButton("pencil","تعديل",`data-category-edit="${category.id}"`)}${iconButton("trash-2","حذف",`data-category-delete="${category.id}"`)}</div>
  </div>`).join("")||empty("لا توجد تصنيفات")}</div>${pager(S.page,result.count||0,CONFIG.PAGE_SIZE)}`;

  bindAdminSearch(adminCategories,[["active","المفعلة"],["inactive","الموقوفة"],["root","الرئيسية"],["child","الفرعية"]]);
  bindPager(adminCategories);
  $("#addCategory").onclick=()=>categoryForm();
  $$('[data-category-edit]').forEach(button=>button.onclick=async()=>{
    const record=await supabase.from("categories").select("*").eq("id",button.dataset.categoryEdit).single();
    if(record.error)return toast(friendlyError(record.error),"error");
    categoryForm(record.data);
  });
  $$('[data-category-delete]').forEach(button=>button.onclick=()=>deleteRow("categories",button.dataset.categoryDelete,"التصنيف",adminCategories));
  refreshIcons();
}
async function categoryForm(category=null){
  const allResult=await supabase
    .from("categories")
    .select("id,name,parent_id")
    .order("name");

  if(allResult.error)return toast(friendlyError(allResult.error),"error");
  const allCategories=allResult.data||[];

  openModal(`<div class="sheet-head">
    <div><h2>${category?"تعديل":"إضافة"} تصنيف</h2><p>قسم رئيسي أو فرعي داخل المنتجات الرقمية</p></div>
    <button data-close>×</button>
  </div>
  <form id="categoryForm">
    <label>اسم التصنيف
      <input id="categoryName" value="${esc(category?.name||"")}" required maxlength="120">
    </label>
    <label>الوصف
      <textarea id="categoryDescription" maxlength="1000">${esc(category?.description||"")}</textarea>
    </label>
    ${imagePicker("categoryImageFile",category?.image_url||"")}
    <label>القسم الأب
      <select id="categoryParent">
        <option value="">قسم رئيسي</option>
        ${allCategories
          .filter(item=>item.id!==category?.id)
          .map(item=>`<option value="${item.id}" ${category?.parent_id===item.id?"selected":""}>${esc(item.name)}</option>`)
          .join("")}
      </select>
    </label>
    <label>ترتيب الظهور
      <input id="categoryOrder" type="number" value="${category?.sort_order||0}">
    </label>
    <label class="switch-label">
      <input id="categoryActive" type="checkbox" ${category?.is_active!==false?"checked":""}>
      التصنيف مفعّل
    </label>
    <button type="submit" class="btn primary block">
      <i data-lucide="save"></i><span>حفظ التصنيف</span>
    </button>
  </form>`);

  $("#categoryForm").onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    if(!form.reportValidity())return;

    setFormBusy(form,true);
    try{
      const name=$("#categoryName").value.trim();
      if(name.length<2)throw new Error("اسم التصنيف قصير جدًا.");

      let imageUrl=category?.image_url||null;
      const imageFile=$("#categoryImageFile").files?.[0];
      if(imageFile)imageUrl=await uploadFile(imageFile,"categories");

      const payload={
        name,
        description:$("#categoryDescription").value.trim()||null,
        image_url:imageUrl,
        parent_id:$("#categoryParent").value||null,
        sort_order:Number($("#categoryOrder").value||0),
        is_active:$("#categoryActive").checked,
        updated_at:new Date().toISOString()
      };

      const result=category?.id
        ? await supabase.from("categories").update(payload).eq("id",category.id).select("id").single()
        : await supabase.from("categories").insert(payload).select("id").single();

      if(result.error)throw result.error;

      toast(category?"تم تعديل التصنيف":"تمت إضافة التصنيف");
      closeModal();
      S.page=1;S.query="";S.filter="";
      await adminCategories();
    }catch(error){
      console.error("Category save error:",error);
      toast(friendlyError(error),"error");
    }finally{
      setFormBusy(form,false);
    }
  };

  refreshIcons();
}

async function adminInventory(){let q=supabase.from("digital_inventory").select("*,product:products(name)",{count:"exact"}).order("created_at",{ascending:false});if(S.filter)q=q.eq("is_used",S.filter==="used");const from=(S.page-1)*CONFIG.PAGE_SIZE,{data,count}=await q.range(from,from+CONFIG.PAGE_SIZE-1),r=data||[];$("#adminContent").innerHTML=`${adminHeader("المخزون الرقمي","إضافة وحذف وتصدير",`<button id="addInventory" class="btn primary">إضافة مخزون</button><button id="exportInventory" class="btn soft">تصدير CSV</button>`)}<div class="list">${r.map(i=>`<div class="card item"><div class="item-main"><h3>${esc(i.product?.name||"-")}</h3><p>${i.is_used?"مستخدم":"متاح"} • ${dt(i.created_at)}</p></div><div class="item-actions">${i.is_used?badge("delivered"):badge("available")}${!i.is_used?`<button class="danger" data-inv-delete="${i.id}">حذف</button>`:""}</div></div>`).join("")||empty("لا يوجد مخزون")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminInventory,[["available","متاح"],["used","مستخدم"]]);bindPager(adminInventory);$("#addInventory").onclick=inventoryForm;$("#exportInventory").onclick=()=>exportCsv("digital_inventory","inventory.csv");$$("[data-inv-delete]").forEach(b=>b.onclick=()=>deleteRow("digital_inventory",b.dataset.invDelete,"عنصر المخزون",adminInventory))}
async function inventoryForm(){const{data:p}=await supabase.from("products").select("id,name").eq("delivery_type","automatic").order("name");openModal(`<div class="sheet-head"><h2>إضافة مخزون</h2><button data-close>×</button></div><form id="invForm"><label>المنتج<select id="ip">${(p||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>كل كود في سطر<textarea id="iv" required></textarea></label><button class="btn primary block">إضافة</button></form>`);$("#invForm").onsubmit=async e=>{e.preventDefault();const vals=$("#iv").value.split("\n").map(x=>x.trim()).filter(Boolean);const{error}=await supabase.from("digital_inventory").insert(vals.map(secret_value=>({product_id:$("#ip").value,secret_value})));if(error)return toast(error.message,"error");toast(`تمت إضافة ${vals.length} عناصر`);closeModal();adminInventory()}}
async function adminDeposits(){
  const depositsResult=await supabase
    .from("deposit_requests")
    .select("*")
    .order("created_at",{ascending:false})
    .limit(500);

  if(depositsResult.error){
    $("#adminContent").innerHTML=`${section("طلبات الشحن","تعذر تحميل الطلبات")}
      <div class="card empty">
        <h2>حدث خطأ أثناء تحميل طلبات الشحن</h2>
        <p>${esc(friendlyError(depositsResult.error))}</p>
        <button id="retryDeposits" class="btn primary">إعادة المحاولة</button>
      </div>`;
    $("#retryDeposits").onclick=adminDeposits;
    refreshIcons();
    return;
  }

  const deposits=depositsResult.data||[];
  const userIds=[...new Set(deposits.map(x=>x.user_id).filter(Boolean))];
  const methodIds=[...new Set(deposits.map(x=>x.payment_method_id).filter(Boolean))];

  const [profilesResult,methodsResult]=await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id,full_name,phone").in("id",userIds)
      : Promise.resolve({data:[],error:null}),
    methodIds.length
      ? supabase.from("payment_methods").select("id,name").in("id",methodIds)
      : Promise.resolve({data:[],error:null})
  ]);

  const profiles=Object.fromEntries((profilesResult.data||[]).map(x=>[x.id,x]));
  const methods=Object.fromEntries((methodsResult.data||[]).map(x=>[x.id,x]));

  const rows=deposits
    .map(x=>({...x,profile:profiles[x.user_id]||null,payment_method:methods[x.payment_method_id]||null}))
    .filter(x=>{
      const text=`${x.profile?.full_name||""} ${x.reference_code||""}`.toLowerCase();
      return (!S.query||text.includes(S.query.toLowerCase())) &&
             (!S.adminUserFilter||(x.profile?.full_name||"").toLowerCase().includes(S.adminUserFilter.toLowerCase())) &&
             (!S.filter||x.status===S.filter);
    });

  $("#adminContent").innerHTML=`${section("طلبات الشحن","مراجعة الإثباتات واعتماد الرصيد")}
    <div class="catalog-filter-bar">
      <input id="depositSearch" class="input" placeholder="بحث بالاسم أو المرجع" value="${esc(S.query||"")}">
      <input id="depositUser" class="input" placeholder="اسم المستخدم" value="${esc(S.adminUserFilter||"")}">
      <select id="depositStatus" class="input">
        <option value="">كل الحالات</option>
        <option value="pending">معلقة</option>
        <option value="approved">مقبولة</option>
        <option value="rejected">مرفوضة</option>
      </select>
    </div>
    <div class="list">${rows.map(d=>`<div class="card item">
      <div class="item-main">
        <h3>${esc(d.profile?.full_name||"مستخدم")}</h3>
        <p>${money(d.amount)} • ${esc(d.payment_method?.name||"طريقة دفع")} • ${esc(d.transfer_reference||d.reference_code||"-")} • ${dt(d.created_at)}</p>
      </div>
      <div class="item-actions">
        ${badge(d.status)}
        ${(d.receipt_url||d.proof_url)?iconButton("eye","معاينة إثبات الدفع",`data-deposit-proof="${d.id}"`):""}
        ${d.status==="pending"?iconButton("check","قبول",`data-deposit-approve="${d.id}"`):""}
        ${d.status==="pending"?iconButton("x","رفض",`data-deposit-reject="${d.id}"`):""}
      </div>
    </div>`).join("")||empty("لا توجد طلبات شحن")}</div>`;

  $("#depositStatus").value=S.filter||"";
  $("#depositSearch").oninput=debounce(()=>{S.query=$("#depositSearch").value.trim();adminDeposits()},220);
  $("#depositUser").oninput=debounce(()=>{S.adminUserFilter=$("#depositUser").value.trim();adminDeposits()},220);
  $("#depositStatus").onchange=()=>{S.filter=$("#depositStatus").value;adminDeposits()};

  $$("[data-deposit-proof]").forEach(button=>button.onclick=()=>{
    const deposit=rows.find(x=>x.id===button.dataset.depositProof);
    const proof=deposit?.receipt_url||deposit?.proof_url;
    if(!proof)return toast("لا يوجد إثبات مرفوع","error");
    openModal(`<div class="sheet-head"><div><h2>إثبات الدفع</h2><p>${esc(deposit.profile?.full_name||"مستخدم")} • ${money(deposit.amount)}</p></div><button data-close>×</button></div><img class="deposit-proof-image" src="${esc(proof)}" alt="إثبات الدفع"><a class="btn soft block" href="${esc(proof)}" target="_blank"><i data-lucide="external-link"></i> فتح بالحجم الكامل</a>`);
  });
  $$("[data-deposit-approve]").forEach(button=>button.onclick=()=>processDeposit(button.dataset.depositApprove,true));
  $$("[data-deposit-reject]").forEach(button=>button.onclick=()=>processDeposit(button.dataset.depositReject,false));
  refreshIcons();
}

async function processDeposit(id,approve){
  const note=approve?null:await appPrompt({
    title:"رفض طلب الشحن",
    message:"اكتب سبب الرفض ليظهر للمستخدم في سجل المحفظة.",
    placeholder:"مثال: صورة الإثبات غير واضحة",
    confirmText:"رفض الطلب",
    icon:"circle-x",
    danger:true
  });
  if(!approve&&note===null)return;
  const{data,error}=await supabase.rpc("admin_process_deposit_v13",{
    p_deposit_id:id,
    p_approve:approve,
    p_note:note
  });
  if(error)return toast(friendlyError(error),"error");
  toast(data?.message||(approve?"تم قبول طلب الشحن":"تم رفض طلب الشحن"));
  await loadAdminBadges();
  await adminDeposits();
}

async function reviewDeposit(id,ok){const reason=ok?null:await appPrompt({title:"رفض طلب الشحن",message:"اكتب سبب الرفض ليظهر للمستخدم.",placeholder:"سبب الرفض",confirmText:"رفض الطلب",icon:"circle-x",danger:true});if(!ok&&!reason)return;const{error}=await supabase.rpc(ok?"approve_deposit":"reject_deposit",ok?{p_deposit_id:id}:{p_deposit_id:id,p_reason:reason});if(error)return toast(error.message,"error");toast(ok?"تم القبول":"تم الرفض");await loadAdminBadges();adminDeposits()}

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
async function adminUsers(){let q=supabase.from("profiles").select("id,full_name,phone,role,status,created_at,wallets(balance)",{count:"exact"}).order("created_at",{ascending:false});if(S.query)q=q.ilike("full_name",`%${S.query}%`);if(S.filter)q=q.eq("status",S.filter);const from=(S.page-1)*CONFIG.PAGE_SIZE,{data,count}=await q.range(from,from+CONFIG.PAGE_SIZE-1),r=data||[];$("#adminContent").innerHTML=`${adminHeader("المستخدمون","الرصيد والحظر والدور",`<button id="exportUsers" class="btn soft">تصدير CSV</button>`)}<div class="list">${r.map(u=>`<div class="card item"><div class="item-main"><h3>${esc(u.full_name||"-")}</h3><p>${money(u.wallets?.[0]?.balance||0)} • ${u.role} • ${esc(u.phone||"-")}</p></div><div class="item-actions">${badge(u.status)}${u.phone?`<a class="whatsapp-btn" href="https://wa.me/${String(u.phone).replace(/\D/g,"")}" target="_blank">◉ واتساب</a>`:""}<button class="small" data-user-wallet="${u.id}">الرصيد</button><button class="small" data-user-role="${u.id}">الدور</button><button class="${u.status==="blocked"?"success":"danger"}" data-user-status="${u.id}" data-current="${u.status}">${u.status==="blocked"?"فك الحظر":"حظر"}</button></div></div>`).join("")||empty("لا يوجد مستخدمون")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminUsers,[["active","نشط"],["blocked","محظور"]]);bindPager(adminUsers);$("#exportUsers").onclick=()=>exportCsv("profiles","users.csv");$$("[data-user-wallet]").forEach(b=>b.onclick=()=>adjustWallet(b.dataset.userWallet));$$("[data-user-role]").forEach(b=>b.onclick=()=>changeRole(b.dataset.userRole));$$("[data-user-status]").forEach(b=>b.onclick=()=>changeStatus(b.dataset.userStatus,b.dataset.current))}
async function adjustWallet(id){const amountText=await appPrompt({title:"تعديل رصيد المستخدم",message:"أدخل مبلغًا موجبًا للإضافة أو سالبًا للخصم.",placeholder:"مثال: 10 أو -5",confirmText:"متابعة",icon:"wallet-cards",multiline:false});if(amountText===null)return;const amount=Number(amountText);if(!Number.isFinite(amount)||amount===0)return toast("أدخل مبلغًا صالحًا","error");const reason=await appPrompt({title:"سبب تعديل الرصيد",message:"سيُحفظ السبب في سجل الحركات المالية.",placeholder:"سبب العملية",confirmText:"تنفيذ العملية",icon:"message-square-text"});if(!reason)return;const{error}=await supabase.rpc("admin_adjust_wallet",{p_user_id:id,p_amount:amount,p_reason:reason});if(error)return toast(error.message,"error");toast("تم تعديل الرصيد");adminUsers()}
async function changeRole(id){const role=await appChoice({title:"تغيير دور المستخدم",message:"اختر الصلاحية الجديدة.",icon:"shield-check",options:[{value:"user",label:"مستخدم",icon:"user"},{value:"admin",label:"مدير",icon:"shield"}],current:"user",confirmText:"حفظ الدور"});if(!role)return;const{error}=await supabase.from("profiles").update({role}).eq("id",id);if(error)return toast(error.message,"error");toast("تم تغيير الدور");adminUsers()}
async function changeStatus(id,current){const status=current==="blocked"?"active":"blocked";const reason=await appPrompt({title:status==="blocked"?"حظر المستخدم":"إلغاء حظر المستخدم",message:"اكتب سبب تغيير حالة الحساب.",placeholder:"سبب التغيير",confirmText:status==="blocked"?"حظر":"إلغاء الحظر",icon:status==="blocked"?"ban":"unlock",danger:status==="blocked"});if(reason===null)return;const{error}=await supabase.rpc("admin_set_user_status",{p_user_id:id,p_status:status,p_reason:reason});if(error)return toast(error.message,"error");toast("تم تحديث الحالة");adminUsers()}
async function adminSlides(){const{data,count}=await listQuery("store_slides","*",q=>{if(S.query)q=q.ilike("title",`%${S.query}%`);if(S.filter)q=q.eq("is_active",S.filter==="active");return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("السلايدر","إضافة وتعديل وحذف وترتيب",`<button id="addSlide" class="btn primary">إضافة سلايد</button>`)}<div class="list">${r.map(s=>`<div class="card item"><div class="item-main"><h3>${esc(s.title)}</h3><p>الترتيب ${s.sort_order} • ${esc(s.button_text||"-")}</p></div><div class="item-actions">${s.is_active?badge("active"):badge("blocked")}${iconButton("eye","معاينة",`data-slide-preview="${s.id}"`)}${iconButton("pencil","تعديل",`data-slide-edit="${s.id}"`)}${iconButton("trash-2","حذف",`data-slide-delete="${s.id}"`)}</div></div>`).join("")||empty("لا توجد شرائح")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminSlides,[["active","مفعّل"],["inactive","موقوف"]]);bindPager(adminSlides);$("#addSlide").onclick=()=>slideForm();$$("[data-slide-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("store_slides").select("*").eq("id",b.dataset.slideEdit).single();slideForm(data)});$$("[data-slide-preview]").forEach(b=>b.onclick=()=>previewSlide(r.find(x=>x.id===b.dataset.slidePreview)));$$("[data-slide-delete]").forEach(b=>b.onclick=()=>deleteRow("store_slides",b.dataset.slideDelete,"السلايد",adminSlides))}
function slideForm(s=null){openModal(`<div class="sheet-head"><h2>${s?"تعديل":"إضافة"} سلايد</h2><button data-close>×</button></div><form id="slideForm"><label>العنوان<input id="st" value="${esc(s?.title||"")}" required></label><label>النص<textarea id="ss">${esc(s?.subtitle||"")}</textarea></label>${imagePicker("slideImageFile",s?.image_url||"")}<label>نص الزر<input id="sb" value="${esc(s?.button_text||"استكشف")}"></label><label>رابط الزر<input id="su" value="${esc(s?.button_url||"#/products")}"></label><label>الترتيب<input id="so" type="number" value="${s?.sort_order||0}"></label><label><input id="sa" type="checkbox" ${s?.is_active!==false?"checked":""}> مفعّل</label><button class="btn primary block">حفظ</button></form>`);$("#slideForm").onsubmit=async e=>{e.preventDefault();let imageUrl=s?.image_url||null;const imageFile=$("#slideImageFile").files[0];if(imageFile)imageUrl=await uploadFile(imageFile,"slides");const payload={title:$("#st").value,subtitle:$("#ss").value,image_url:imageUrl,button_text:$("#sb").value,button_url:$("#su").value,sort_order:+$("#so").value,is_active:$("#sa").checked};const q=s?supabase.from("store_slides").update(payload).eq("id",s.id):supabase.from("store_slides").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");toast("تم الحفظ");closeModal();adminSlides()}}
function previewSlide(s){openModal(`<div class="sheet-head"><h2>معاينة السلايد</h2><button data-close>×</button></div><section class="slide active" style="${s.image_url?`background-image:linear-gradient(90deg,rgba(23,19,55,.72),rgba(23,19,55,.25)),url('${esc(s.image_url)}')`:""}"><div class="slide-overlay"><h1>${esc(s.title)}</h1><p>${esc(s.subtitle||"")}</p><span class="btn primary">${esc(s.button_text||"استكشف")}</span></div></section>`)}
async function adminAnnouncements(){const{data,count}=await listQuery("announcements","*",q=>{if(S.query)q=q.or(`title.ilike.%${S.query}%,message.ilike.%${S.query}%`);if(S.filter)q=q.eq("kind",S.filter);return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("الإعلانات","شريط علوي وإعلانات عامة",`<button id="addAnnouncement" class="btn primary">إضافة إعلان</button>`)}<div class="list">${r.map(a=>`<div class="card item"><div class="item-main"><h3>${esc(a.title||"إعلان")}</h3><p>${esc(a.message)} • ${a.kind}</p></div><div class="item-actions">${a.is_active?badge("active"):badge("blocked")}<button class="small" data-ann-edit="${a.id}">تعديل</button><button class="danger" data-ann-delete="${a.id}">حذف</button></div></div>`).join("")||empty("لا توجد إعلانات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminAnnouncements,[["bar","شريط علوي"],["notification","إشعار عام"]]);bindPager(adminAnnouncements);$("#addAnnouncement").onclick=()=>announcementForm();$$("[data-ann-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("announcements").select("*").eq("id",b.dataset.annEdit).single();announcementForm(data)});$$("[data-ann-delete]").forEach(b=>b.onclick=()=>deleteRow("announcements",b.dataset.annDelete,"الإعلان",adminAnnouncements))}
function announcementForm(a=null){openModal(`<div class="sheet-head"><h2>${a?"تعديل":"إضافة"} إعلان</h2><button data-close>×</button></div><form id="annForm"><label>العنوان<input id="at" value="${esc(a?.title||"")}"></label><label>النص<textarea id="am" required>${esc(a?.message||"")}</textarea></label><label>النوع<select id="ak"><option value="bar">شريط علوي</option><option value="notification" ${a?.kind==="notification"?"selected":""}>إشعار عام</option></select></label><label>تاريخ البداية<input id="as" type="datetime-local"></label><label>تاريخ النهاية<input id="ae" type="datetime-local"></label><label><input id="aa" type="checkbox" ${a?.is_active!==false?"checked":""}> مفعّل</label><button class="btn primary block">حفظ</button></form>`);$("#annForm").onsubmit=async e=>{e.preventDefault();const payload={title:$("#at").value,message:$("#am").value,kind:$("#ak").value,starts_at:$("#as").value||new Date().toISOString(),ends_at:$("#ae").value||null,is_active:$("#aa").checked,created_by:S.user.id};const q=a?supabase.from("announcements").update(payload).eq("id",a.id):supabase.from("announcements").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");if(!a&&payload.kind==="notification")await supabase.from("notifications").insert({user_id:null,title:payload.title||"إعلان",body:payload.message,type:"announcement"});toast("تم الحفظ");closeModal();adminAnnouncements()}}
async function adminNotifications(){const{data,count}=await listQuery("notifications","*",q=>{if(S.query)q=q.or(`title.ilike.%${S.query}%,body.ilike.%${S.query}%`);if(S.filter==="global")q=q.is("user_id",null);if(S.filter==="personal")q=q.not("user_id","is",null);return q});const r=data||[];$("#adminContent").innerHTML=`${adminHeader("الإشعارات","إرسال عام أو خاص",`<button id="sendNotification" class="btn primary">إرسال إشعار</button>`)}<div class="list">${r.map(n=>`<div class="card item"><div class="item-main"><h3>${esc(n.title)}</h3><p>${esc(n.body)} • ${n.user_id?"خاص":"عام"}</p></div><div class="item-actions"><button class="danger" data-note-delete="${n.id}">حذف</button></div></div>`).join("")||empty("لا توجد إشعارات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;bindAdminSearch(adminNotifications,[["global","عامة"],["personal","خاصة"]]);bindPager(adminNotifications);$("#sendNotification").onclick=notificationForm;$$("[data-note-delete]").forEach(b=>b.onclick=()=>deleteRow("notifications",b.dataset.noteDelete,"الإشعار",adminNotifications))}
async function notificationForm(){const{data:u}=await supabase.from("profiles").select("id,full_name").order("full_name").limit(500);openModal(`<div class="sheet-head"><h2>إرسال إشعار</h2><button data-close>×</button></div><form id="noteForm"><label>المستلم<select id="nu"><option value="">جميع المستخدمين</option>${(u||[]).map(x=>`<option value="${x.id}">${esc(x.full_name||x.id)}</option>`).join("")}</select></label><label>العنوان<input id="nt" required></label><label>النص<textarea id="nb" required></textarea></label><button class="btn primary block">إرسال</button></form>`);$("#noteForm").onsubmit=async e=>{e.preventDefault();const{error}=await supabase.from("notifications").insert({user_id:$("#nu").value||null,title:$("#nt").value,body:$("#nb").value,type:"manual"});if(error)return toast(error.message,"error");toast("تم الإرسال");closeModal();adminNotifications()}}

async function adminSocialPlatforms(){
  const{data,count}=await listQuery("social_platforms","*",q=>{if(S.query)q=q.ilike("name",`%${S.query}%`);return q});const r=data||[];
  $("#adminContent").innerHTML=`${adminHeader("منصات السوشل ميديا","أضف المنصات مرة واحدة لتظهر في اختيار الخدمات",`<button id="addPlatform" class="btn primary"><i data-lucide="plus"></i> إضافة منصة</button>`)}
  <div class="list">${r.map(p=>`<div class="card item"><div class="platform-list-icon"><i data-lucide="${p.icon||"circle"}"></i></div><div class="item-main"><h3>${esc(p.name)}</h3><p>${esc(p.slug)} • الترتيب ${p.sort_order}</p></div><div class="item-actions">${p.is_active?badge("active"):badge("blocked")}${iconButton("pencil","تعديل",`data-platform-edit="${p.id}"`)}${iconButton("trash-2","حذف",`data-platform-delete="${p.id}"`)}</div></div>`).join("")||empty("لا توجد منصات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;
  bindAdminSearch(adminSocialPlatforms);bindPager(adminSocialPlatforms);$("#addPlatform").onclick=()=>platformForm();$$("[data-platform-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("social_platforms").select("*").eq("id",b.dataset.platformEdit).single();platformForm(data)});$$("[data-platform-delete]").forEach(b=>b.onclick=()=>deleteRow("social_platforms",b.dataset.platformDelete,"المنصة",adminSocialPlatforms));refreshIcons()
}

function platformForm(p=null){
  const predefined=[
    {name:"Instagram",slug:"instagram",icon:"instagram"},
    {name:"Facebook",slug:"facebook",icon:"facebook"},
    {name:"YouTube",slug:"youtube",icon:"youtube"},
    {name:"TikTok",slug:"tiktok",icon:"music-2"},
    {name:"Telegram",slug:"telegram",icon:"send"},
    {name:"X / Twitter",slug:"x-twitter",icon:"twitter"},
    {name:"LinkedIn",slug:"linkedin",icon:"linkedin"},
    {name:"WhatsApp",slug:"whatsapp",icon:"message-circle"},
    {name:"Snapchat",slug:"snapchat",icon:"ghost"},
    {name:"Pinterest",slug:"pinterest",icon:"pin"},
    {name:"Twitch",slug:"twitch",icon:"twitch"},
    {name:"Discord",slug:"discord",icon:"messages-square"},
    {name:"Reddit",slug:"reddit",icon:"message-square-more"},
    {name:"Spotify",slug:"spotify",icon:"circle-play"}
  ];
  openModal(`<div class="sheet-head"><h2>${p?"تعديل":"إضافة"} منصة</h2><button data-close>×</button></div><form id="platformForm"><label>اختر المنصة<select id="platformPreset">${predefined.map(x=>`<option value="${x.slug}" ${p?.slug===x.slug?"selected":""}>${x.name}</option>`).join("")}</select></label><div id="platformPreview" class="chosen-platform"></div><label>الترتيب<input id="platformOrder" type="number" value="${p?.sort_order||0}"></label><label><input id="platformActive" type="checkbox" ${p?.is_active!==false?"checked":""}> مفعلة</label><button class="btn primary block">حفظ</button></form>`);
  const draw=()=>{const item=predefined.find(x=>x.slug===$("#platformPreset").value);$("#platformPreview").innerHTML=`<i data-lucide="${item.icon}"></i><strong>${item.name}</strong><small>الاسم والأيقونة يضافان تلقائيًا</small>`;refreshIcons()};
  $("#platformPreset").onchange=draw;draw();
  $("#platformForm").onsubmit=async e=>{e.preventDefault();const item=predefined.find(x=>x.slug===$("#platformPreset").value);const payload={name:item.name,slug:item.slug,icon:item.icon,sort_order:+$("#platformOrder").value,is_active:$("#platformActive").checked};const q=p?supabase.from("social_platforms").update(payload).eq("id",p.id):supabase.from("social_platforms").insert(payload);const{error}=await q;if(error)return toast(error.message,"error");toast("تم حفظ المنصة");closeModal();adminSocialPlatforms()}
}
async function adminSmmServices(){
  const{data,count}=await listQuery("smm_services","*,platform:social_platforms(name,icon)",q=>{if(S.query)q=q.ilike("name",`%${S.query}%`);return q});const r=data||[];
  $("#adminContent").innerHTML=`${adminHeader("خدمات السوشل ميديا","إضافة وتعديل الخدمات من المنصات المحفوظة",`<button id="addSmmService" class="btn primary"><i data-lucide="plus"></i> إضافة خدمة</button>`)}
  <div class="list">${r.map(x=>`<div class="card item"><div class="platform-list-icon"><i data-lucide="${x.platform?.icon||"circle"}"></i></div><div class="item-main"><h3>${esc(x.name)}</h3><p>${esc(x.platform?.name||"-")} • ${esc(x.service_category||"خدمات عامة")} • ${money(x.price_per_1000)}/1000</p></div><div class="item-actions">${x.is_active?badge("active"):badge("blocked")}${iconButton("pencil","تعديل",`data-smm-edit="${x.id}"`)}${iconButton("trash-2","حذف",`data-smm-delete="${x.id}"`)}</div></div>`).join("")||empty("لا توجد خدمات")}</div>${pager(S.page,count||0,CONFIG.PAGE_SIZE)}`;
  bindAdminSearch(adminSmmServices);bindPager(adminSmmServices);$("#addSmmService").onclick=()=>smmServiceForm();$$("[data-smm-edit]").forEach(b=>b.onclick=async()=>{const{data}=await supabase.from("smm_services").select("*").eq("id",b.dataset.smmEdit).single();smmServiceForm(data)});$$("[data-smm-delete]").forEach(b=>b.onclick=()=>deleteRow("smm_services",b.dataset.smmDelete,"الخدمة",adminSmmServices));refreshIcons()
}
async function smmServiceForm(s=null){
  const platformsResult=await supabase.from("social_platforms").select("*").eq("is_active",true).order("sort_order");
  if(platformsResult.error)return toast(friendlyError(platformsResult.error),"error");
  const platforms=platformsResult.data||[];
  if(!platforms.length){
    toast("لا توجد منصات مفعلة. شغّل ملف SQL المرفق لإضافة المنصات تلقائيًا.","error");
    return;
  }

  openModal(`<div class="sheet-head"><div><h2>${s?"تعديل":"إضافة"} منتج سوشل ميديا</h2><p>اختر المنصة وأدخل معلومات الخدمة</p></div><button data-close>×</button></div>
  <div id="socialLivePreview" class="catalog-live-preview"></div>
  <form id="smmServiceForm">
    <label>المنصة<select id="servicePlatform">${platforms.map(p=>`<option value="${p.id}" ${s?.platform_id===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label>
    <div id="chosenPlatformPreview" class="chosen-platform"></div>
    <label>فئة الخدمة<input id="serviceCategory" value="${esc(s?.service_category||"متابعون")}" placeholder="متابعون، مشاهدات، إعجابات" required></label>
    <label>اسم الخدمة<input id="sn" value="${esc(s?.name||"")}" required maxlength="180"></label>
    <label>الوصف<textarea id="sd" maxlength="4000">${esc(s?.description||"")}</textarea></label>
    <label>السعر لكل 1000<input id="spr" type="number" min="0" step=".0001" value="${s?.price_per_1000??0}" required></label>
    <div class="social-form-grid">
      <label>الحد الأدنى<input id="smin" type="number" min="1" value="${s?.min_quantity||100}" required></label>
      <label>الحد الأقصى<input id="smax" type="number" min="1" value="${s?.max_quantity||10000}" required></label>
    </div>
    <label class="switch-label"><input id="sactive" type="checkbox" ${s?.is_active!==false?"checked":""}> الخدمة مفعلة</label>
    <button type="submit" class="btn primary block"><i data-lucide="save"></i><span>حفظ منتج السوشل</span></button>
  </form>`);

  const selectedPlatform=()=>platforms.find(x=>x.id===$("#servicePlatform").value);
  const drawPreview=()=>{
    const platform=selectedPlatform();
    const platformPreview=$("#chosenPlatformPreview");
    const livePreview=$("#socialLivePreview");
    const nameInput=$("#sn");
    const priceInput=$("#spr");
    if(!platformPreview||!livePreview)return;
    platformPreview.innerHTML=`<i data-lucide="${platform?.icon||"messages-square"}"></i><strong>${esc(platform?.name||"منصة")}</strong><small>تُضاف المنصة والأيقونة تلقائيًا</small>`;
    livePreview.innerHTML=`<div class="mini-social-preview"><span><i data-lucide="${platform?.icon||"messages-square"}"></i></span><div><small>معاينة</small><strong>${esc(nameInput?.value?.trim()||"اسم الخدمة")}</strong><b>${money(Number(priceInput?.value||0))}/1000</b></div></div>`;
    refreshIcons();
  };
  $("#servicePlatform").onchange=drawPreview;
  $("#sn").oninput=drawPreview;
  $("#spr").oninput=drawPreview;
  drawPreview();

  $("#smmServiceForm").onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    if(!form.reportValidity())return;
    setFormBusy(form,true);
    try{
      const platform=selectedPlatform();
      if(!platform)throw new Error("اختر منصة صالحة.");
      const name=$("#sn").value.trim();
      const category=$("#serviceCategory").value.trim();
      if(name.length<2)throw new Error("اسم الخدمة قصير جدًا.");
      if(!category)throw new Error("فئة الخدمة مطلوبة.");
      const price=validatePositiveNumber($("#spr").value,"السعر لكل 1000",true);
      const minimum=Math.trunc(validatePositiveNumber($("#smin").value,"الحد الأدنى"));
      const maximum=Math.trunc(validatePositiveNumber($("#smax").value,"الحد الأقصى"));
      if(maximum<minimum)throw new Error("الحد الأقصى يجب أن يكون أكبر من أو مساويًا للحد الأدنى.");

      const payload={
        platform_id:platform.id,
        platform:platform.name,
        icon:platform.icon||"messages-square",
        service_category:category,
        name,
        description:$("#sd").value.trim()||null,
        price_per_1000:price,
        min_quantity:minimum,
        max_quantity:maximum,
        is_active:$("#sactive").checked,
        updated_at:new Date().toISOString()
      };

      let result;
      if(s?.id){
        result=await supabase.from("smm_services").update(payload).eq("id",s.id).select("id").single();
      }else{
        result=await supabase.from("smm_services").insert(payload).select("id").single();
      }
      if(result.error)throw result.error;

      toast(s?"تم تعديل منتج السوشل بنجاح":"تمت إضافة منتج السوشل بنجاح");
      closeModal();
      S.filter="social";S.query="";S.catalogStatus="";S.catalogPlatform="";
      await adminCatalogItems();
    }catch(error){
      console.error("Social product save error:",error);
      toast(friendlyError(error),"error");
    }finally{
      setFormBusy(form,false);
    }
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
  $("#clearLogs").onclick=async()=>{if(!await appConfirm({title:"تأكيد العملية",message:"مسح جميع السجلات؟"}))return;const{error}=await supabase.from("admin_activity_logs").delete().neq("id","00000000-0000-0000-0000-000000000000");if(error)return toast(error.message,"error");toast("تم مسح السجل");adminLogs()};
  $$("[data-log-delete]").forEach(b=>b.onclick=()=>deleteRow("admin_activity_logs",b.dataset.logDelete,"السجل",adminLogs))
}
async function deleteRow(table,id,label,render){const approved=await appConfirm({title:`حذف ${label}`,message:"لا يمكن التراجع عن هذه العملية بعد تنفيذها.",confirmText:"حذف",icon:"trash-2",danger:true});if(!approved)return;const{error}=await supabase.from(table).delete().eq("id",id);if(error)return toast(error.message,"error");toast("تم الحذف");render()}
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

window.alert=message=>toast(String(message||""),"info");
