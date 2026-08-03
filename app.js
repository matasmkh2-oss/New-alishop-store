import { supabase, isConfigured } from "./supabase.js";

const app = document.querySelector("#app");
const authDialog = document.querySelector("#authDialog");
const productDialog = document.querySelector("#productDialog");
const authBtn = document.querySelector("#authBtn");
const adminNav = document.querySelector("#adminNav");
const toast = document.querySelector("#toast");

let authMode = "login";
let currentUser = null;
let profile = null;

const demoProducts = [
  { id: "demo-1", name: "اشتراك تصميم احترافي", description: "اشتراك رقمي يتم تسليمه فورياً بعد الشراء.", price: 12, icon: "🎨", category: "اشتراكات" },
  { id: "demo-2", name: "حزمة قوالب سوشيال ميديا", description: "أكثر من 100 قالب قابل للتعديل.", price: 8, icon: "📦", category: "قوالب" },
  { id: "demo-3", name: "كتاب التسويق الرقمي", description: "دليل عملي بصيغة PDF لتنمية المبيعات.", price: 5, icon: "📘", category: "كتب" },
];

const state = {
  products: [],
  orders: [],
  wallet: { balance: 0 },
};

function money(value) {
  return `${Number(value || 0).toFixed(2)} $`;
}

function notify(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  setTimeout(() => toast.className = "toast", 2800);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  document.querySelector("#themeBtn").textContent = theme === "dark" ? "☀" : "☾";
}
setTheme(localStorage.getItem("theme") || "light");

document.querySelector("#themeBtn").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

document.addEventListener("click", (event) => {
  const routeBtn = event.target.closest("[data-route]");
  if (routeBtn) {
    event.preventDefault();
    navigate(routeBtn.dataset.route);
  }
  if (event.target.matches("[data-close]")) authDialog.close();
});

authBtn.addEventListener("click", async () => {
  if (currentUser && supabase) {
    await supabase.auth.signOut();
    currentUser = null;
    profile = null;
    updateSessionUI();
    navigate("home");
    notify("تم تسجيل الخروج");
    return;
  }
  authDialog.showModal();
});

document.querySelector("#switchAuth").addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  document.querySelector("#authTitle").textContent =
    authMode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
  document.querySelector("#authSubmit").textContent =
    authMode === "login" ? "دخول" : "إنشاء الحساب";
  document.querySelector("#switchAuth").textContent =
    authMode === "login"
      ? "ليس لديك حساب؟ أنشئ حساباً"
      : "لديك حساب؟ سجل الدخول";
  document.querySelector("#fullName").parentElement.style.display =
    authMode === "login" ? "none" : "block";
});
document.querySelector("#fullName").parentElement.style.display = "none";

document.querySelector("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isConfigured) {
    notify("أضف بيانات Supabase داخل ملف supabase.js أولاً", "error");
    return;
  }

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const fullName = document.querySelector("#fullName").value.trim();
  const submit = document.querySelector("#authSubmit");
  submit.disabled = true;

  try {
    if (authMode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      notify("تم إنشاء الحساب. تحقق من بريدك إن كان التحقق مفعلاً.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      notify("مرحباً بك");
    }
    authDialog.close();
  } catch (error) {
    notify(error.message || "تعذر إتمام العملية", "error");
  } finally {
    submit.disabled = false;
  }
});

async function initSession() {
  if (!isConfigured) {
    updateSessionUI();
    navigate("home");
    return;
  }

  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    await loadProfile();
    updateSessionUI();
    navigate(location.hash.replace("#/", "") || "home");
  });

  await loadProfile();
  updateSessionUI();
  navigate(location.hash.replace("#/", "") || "home");
}

async function loadProfile() {
  if (!currentUser || !supabase) {
    profile = null;
    state.wallet.balance = 0;
    return;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, status")
    .eq("id", currentUser.id)
    .maybeSingle();

  profile = data;

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  state.wallet.balance = wallet?.balance || 0;
}

function updateSessionUI() {
  authBtn.textContent = currentUser ? "تسجيل الخروج" : "تسجيل الدخول";
  adminNav.classList.toggle("hidden", profile?.role !== "admin");
}

async function loadProducts() {
  if (!isConfigured) {
    state.products = demoProducts;
    return;
  }
  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,price,image_url,category_id,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  state.products = error || !data?.length ? demoProducts : data;
}

function productCards(products) {
  return products.map(product => `
    <article class="card product-card">
      <div class="product-image">${product.icon || "🛍️"}</div>
      <div class="product-content">
        <span class="badge">${product.category || "منتج رقمي"}</span>
        <h3>${product.name}</h3>
        <p>${product.description || "منتج رقمي مميز يتم تسليمه بعد إتمام الشراء."}</p>
        <div class="product-bottom">
          <span class="price">${money(product.price)}</span>
          <button class="primary-btn" data-product="${product.id}">التفاصيل</button>
        </div>
      </div>
    </article>
  `).join("");
}

async function renderHome() {
  await loadProducts();
  app.innerHTML = `
    <section class="hero">
      <div>
        <span class="badge">متجر رقمي متكامل</span>
        <h1>كل ما تحتاجه رقمياً في مكان واحد</h1>
        <p>تصفح المنتجات، اشحن محفظتك، واشترِ بسهولة مع تسليم رقمي سريع وآمن.</p>
        <button class="primary-btn" id="browseBtn">استعراض المنتجات</button>
      </div>
      <div class="hero-card">
        <small>رصيد محفظتك</small>
        <div class="balance">${money(state.wallet.balance)}</div>
        <p>${currentUser ? "رصيدك جاهز للاستخدام في عمليات الشراء." : "سجل الدخول لتتمكن من الشراء وإدارة محفظتك."}</p>
      </div>
    </section>

    <section>
      <div class="section-head">
        <div>
          <h2>المنتجات الرقمية</h2>
          <p>اختر المنتج المناسب لك.</p>
        </div>
        <input id="productSearch" class="search" placeholder="ابحث عن منتج..." />
      </div>
      <div id="productsGrid" class="grid">${productCards(state.products)}</div>
    </section>
  `;

  document.querySelector("#browseBtn").addEventListener("click", () =>
    document.querySelector("#productsGrid").scrollIntoView()
  );

  document.querySelector("#productSearch").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const filtered = state.products.filter(p =>
      `${p.name} ${p.description || ""}`.toLowerCase().includes(query)
    );
    document.querySelector("#productsGrid").innerHTML =
      filtered.length ? productCards(filtered) : `<div class="card empty">لا توجد نتائج.</div>`;
    bindProductButtons();
  });
  bindProductButtons();
}

function bindProductButtons() {
  document.querySelectorAll("[data-product]").forEach(button => {
    button.addEventListener("click", () => openProduct(button.dataset.product));
  });
}

function openProduct(productId) {
  const product = state.products.find(p => String(p.id) === String(productId));
  if (!product) return;

  productDialog.innerHTML = `
    <div class="modal-head">
      <div><h2>${product.name}</h2><p>${product.category || "منتج رقمي"}</p></div>
      <button class="close-btn" id="closeProduct">×</button>
    </div>
    <div class="product-image">${product.icon || "🛍️"}</div>
    <p style="line-height:1.9;color:var(--muted)">${product.description || ""}</p>
    <div class="product-bottom">
      <span class="price">${money(product.price)}</span>
      <button id="buyBtn" class="primary-btn">شراء الآن</button>
    </div>
  `;
  productDialog.showModal();
  document.querySelector("#closeProduct").onclick = () => productDialog.close();
  document.querySelector("#buyBtn").onclick = () => buyProduct(product);
}

async function buyProduct(product) {
  if (!currentUser) {
    productDialog.close();
    authDialog.showModal();
    notify("سجل الدخول أولاً لإتمام الشراء", "error");
    return;
  }
  if (!isConfigured) {
    notify("النسخة الحالية للعرض. اربط Supabase لتفعيل الشراء.", "error");
    return;
  }

  const button = document.querySelector("#buyBtn");
  button.disabled = true;
  try {
    const idempotencyKey = crypto.randomUUID();
    const { data, error } = await supabase.rpc("purchase_product", {
      p_product_id: product.id,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    notify(data?.message || "تمت عملية الشراء بنجاح");
    productDialog.close();
    await loadProfile();
    navigate("orders");
  } catch (error) {
    notify(error.message || "تعذر إتمام الشراء", "error");
  } finally {
    button.disabled = false;
  }
}

async function renderOrders() {
  if (!currentUser) return renderLoginRequired("طلباتي");
  let orders = [];
  if (isConfigured) {
    const { data } = await supabase
      .from("orders")
      .select("id,order_number,total,status,created_at,products(name)")
      .order("created_at", { ascending: false });
    orders = data || [];
  }

  app.innerHTML = `
    <div class="section-head"><div><h2>طلباتي</h2><p>سجل مشترياتك الرقمية.</p></div></div>
    <section class="card panel table-wrap">
      ${orders.length ? `
        <table><thead><tr><th>رقم الطلب</th><th>المنتج</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
        <tbody>${orders.map(o => `<tr><td>${o.order_number}</td><td>${o.products?.name || "-"}</td><td>${money(o.total)}</td><td><span class="badge success">${o.status}</span></td><td>${new Date(o.created_at).toLocaleDateString("ar")}</td></tr>`).join("")}</tbody></table>
      ` : `<div class="empty">لا توجد طلبات حتى الآن.</div>`}
    </section>
  `;
}

async function renderWallet() {
  if (!currentUser) return renderLoginRequired("المحفظة");
  let transactions = [];
  if (isConfigured) {
    const { data } = await supabase
      .from("wallet_transactions")
      .select("id,type,amount,balance_after,description,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    transactions = data || [];
  }

  app.innerHTML = `
    <div class="section-head"><div><h2>المحفظة</h2><p>اشحن رصيدك وتابع جميع الحركات.</p></div><button class="primary-btn" id="depositBtn">طلب شحن رصيد</button></div>
    <div class="stats">
      <div class="card stat"><small>الرصيد الحالي</small><strong>${money(state.wallet.balance)}</strong></div>
      <div class="card stat"><small>عدد الحركات</small><strong>${transactions.length}</strong></div>
    </div>
    <section class="card panel table-wrap" style="margin-top:20px">
      ${transactions.length ? `
        <table><thead><tr><th>النوع</th><th>المبلغ</th><th>الرصيد بعد العملية</th><th>الوصف</th><th>التاريخ</th></tr></thead>
        <tbody>${transactions.map(t => `<tr><td>${t.type}</td><td>${money(t.amount)}</td><td>${money(t.balance_after)}</td><td>${t.description || "-"}</td><td>${new Date(t.created_at).toLocaleDateString("ar")}</td></tr>`).join("")}</tbody></table>
      ` : `<div class="empty">لا توجد حركات مالية.</div>`}
    </section>
  `;
  document.querySelector("#depositBtn").onclick = () =>
    notify("واجهة طلب الشحن ستكون في المرحلة التالية.");
}

function renderProfile() {
  if (!currentUser) return renderLoginRequired("حسابي");
  app.innerHTML = `
    <div class="section-head"><div><h2>حسابي</h2><p>معلومات الحساب الأساسية.</p></div></div>
    <section class="card panel">
      <h3>${profile?.full_name || currentUser.user_metadata?.full_name || "مستخدم"}</h3>
      <p>${currentUser.email}</p>
      <span class="badge">${profile?.role === "admin" ? "مدير" : "مستخدم"}</span>
    </section>
  `;
}

function renderAdmin() {
  if (profile?.role !== "admin") {
    app.innerHTML = `<div class="card empty">ليس لديك صلاحية للوصول إلى لوحة الإدارة.</div>`;
    return;
  }
  app.innerHTML = `
    <div class="section-head"><div><h2>لوحة الإدارة</h2><p>نظرة عامة على المتجر.</p></div></div>
    <div class="stats">
      <div class="card stat"><small>المنتجات</small><strong>${state.products.length}</strong></div>
      <div class="card stat"><small>الطلبات</small><strong>0</strong></div>
      <div class="card stat"><small>طلبات الشحن</small><strong>0</strong></div>
      <div class="card stat"><small>المستخدمون</small><strong>0</strong></div>
    </div>
    <section class="card panel" style="margin-top:20px">
      <h3>أدوات الإدارة</h3>
      <p style="color:var(--muted)">إدارة المنتجات وطرق الدفع وطلبات الشحن ستضاف في المرحلة التالية.</p>
    </section>
  `;
}

function renderLoginRequired(title) {
  app.innerHTML = `
    <div class="card empty">
      <h2>${title}</h2>
      <p>يجب تسجيل الدخول للوصول إلى هذه الصفحة.</p>
      <button class="primary-btn" id="loginRequiredBtn">تسجيل الدخول</button>
    </div>
  `;
  document.querySelector("#loginRequiredBtn").onclick = () => authDialog.showModal();
}

function navigate(route) {
  location.hash = `#/${route}`;
  document.querySelectorAll("[data-route]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.route === route)
  );

  const routes = {
    home: renderHome,
    orders: renderOrders,
    wallet: renderWallet,
    profile: renderProfile,
    admin: renderAdmin,
  };
  (routes[route] || renderHome)();
}

window.addEventListener("hashchange", () =>
  navigate(location.hash.replace("#/", "") || "home")
);

initSession();
