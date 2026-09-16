/* Bulk products workspace: a self-contained admin section using the existing visual language. */
(() => {
  const KEY = 'alishop-bulk-groups-v2';
  const groups = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (value) => localStorage.setItem(KEY, JSON.stringify(value));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z"/><path d="m4 7.5 8 3.5 8-3.5M12 11v9"/></svg>';
  let dashboardSnapshot = null;

  const appRoot = () => document.querySelector('#app');
  const workspace = () => document.querySelector('#bulkProductsWorkspace');
  const notify = (text, type = 'success') => window.toast?.(text, type);
  const existingProductButton = () => [...document.querySelectorAll('button')].find((button) => !button.closest('#bulkProductsWorkspace') && /إضافة منتج|منتج جديد|إضافة/.test(button.textContent || ''));

  function card(group) {
    const products = Array.isArray(group.products) ? group.products : [];
    return `<article class="item bulk-group-card" data-group-card="${esc(group.id)}">
      <div class="item-main"><div class="bulk-group-heading"><span class="tile-icon bulk-group-icon">${icon}</span><div><h3>${esc(group.name)}</h3><p>${products.length} منتجات محفوظة · ${new Date(group.createdAt).toLocaleDateString('ar')}</p></div></div>
      ${group.open ? `<div class="bulk-products-list">${products.length ? products.map((p, i) => `<div class="bulk-product-row"><span>${esc(p.name || `المنتج ${i + 1}`)}</span><small>${esc(p.price || '')}</small><button class="btn soft" data-bulk-edit-product="${esc(p.id || '')}">تعديل</button></div>`).join('') : '<div class="bulk-empty small"><strong>لا توجد منتجات محفوظة بعد</strong><p>ستظهر المنتجات هنا بعد ربط الحفظ بالمجموعة.</p></div>'}</div>` : ''}</div>
      <div class="item-actions bulk-group-actions"><button class="icon-action" title="${group.open ? 'إخفاء المنتجات' : 'عرض المنتجات'}" data-bulk-open="${esc(group.id)}">${group.open ? 'إخفاء' : 'عرض المنتجات'}</button><button class="icon-action" title="تعديل اسم المجموعة" data-bulk-rename="${esc(group.id)}">تعديل</button><button class="icon-action danger" title="حذف التنظيم" data-bulk-delete="${esc(group.id)}">حذف</button></div>
    </article>`;
  }

  function render(mode = 'add') {
    const root = workspace(); if (!root) return;
    const list = groups();
    root.innerHTML = `<section class="page admin-page bulk-page"><div class="section-head"><div><small>لوحة الإدارة</small><h2>إدارة المنتجات المجمعة</h2><p>إضافة وتنظيم المنتجات على شكل مجموعات بطريقة واضحة وآمنة.</p></div><button class="btn soft" data-bulk-back>العودة إلى لوحة الإدارة</button></div>
      <div class="tabs bulk-tabs" role="tablist"><button class="tab ${mode === 'add' ? 'active' : ''}" data-bulk-tab="add">${icon} إضافة المنتجات</button><button class="tab ${mode === 'edit' ? 'active' : ''}" data-bulk-tab="edit">${icon} تعديل المنتجات</button></div>
      <div class="bulk-panel" data-bulk-panel="add" ${mode !== 'add' ? 'hidden' : ''}><div class="card bulk-create-card"><span class="tile-icon bulk-create-icon">${icon}</span><div class="bulk-create-copy"><h3>إنشاء مجموعة جديدة</h3><p>اكتب اسم المجموعة ثم ابدأ بإضافة المنتجات باستخدام النموذج الأصلي.</p></div><label class="bulk-name-field">اسم المجموعة<input data-bulk-name placeholder="مثال: منتجات شهر سبتمبر"></label><button class="btn primary" data-bulk-new>إنشاء المجموعة</button></div><div class="admin-note-card bulk-note">تُحفظ المنتجات في جدول المنتجات الرئيسي، وتُستخدم المجموعة للتنظيم فقط.</div>${list.length ? `<h3 class="bulk-subtitle">المجموعات الحالية</h3><div class="list bulk-list">${list.map(card).join('')}</div>` : '<div class="empty bulk-empty"><h3>لا توجد مجموعات بعد</h3><p>أنشئ المجموعة الأولى من الزر أعلاه.</p></div>'}</div>
      <div class="bulk-panel" data-bulk-panel="edit" ${mode !== 'edit' ? 'hidden' : ''}>${list.length ? `<div class="list bulk-list">${list.map(card).join('')}</div>` : '<div class="empty bulk-empty"><h3>لا توجد مجموعات بعد</h3><p>ابدأ من تبويب إضافة المنتجات.</p></div>'}</div></section>`;
    bind(root);
  }

  function bind(root) {
    root.querySelectorAll('[data-bulk-tab]').forEach((button) => button.onclick = () => render(button.dataset.bulkTab));
    root.querySelector('[data-bulk-back]')?.addEventListener('click', restoreDashboard);
    root.querySelector('[data-bulk-new]')?.addEventListener('click', () => {
      const name = root.querySelector('[data-bulk-name]')?.value.trim();
      if (!name) return notify('اكتب اسم المجموعة أولًا.', 'error');
      const list = groups(); list.unshift({ id: crypto.randomUUID(), name, products: [], createdAt: Date.now(), open: false }); save(list); notify('تم إنشاء المجموعة بنجاح. سيتم فتح نموذج المنتج الآن.');
      restoreDashboard();
      window.setTimeout(() => existingProductButton()?.click(), 120);
    });
    root.querySelectorAll('[data-bulk-open]').forEach((button) => button.onclick = () => {
      const list = groups(); const group = list.find((item) => item.id === button.dataset.bulkOpen); if (!group) return;
      group.open = !group.open; save(list); render(root.querySelector('[data-bulk-tab].active')?.dataset.bulkTab || 'edit');
    });
    root.querySelectorAll('[data-bulk-rename]').forEach((button) => button.onclick = () => {
      const list = groups(); const group = list.find((item) => item.id === button.dataset.bulkRename); if (!group) return;
      const name = window.prompt('اكتب اسم المجموعة الجديد', group.name); if (!name?.trim()) return; group.name = name.trim(); save(list); render('edit'); notify('تم تعديل اسم المجموعة.');
    });
    root.querySelectorAll('[data-bulk-delete]').forEach((button) => button.onclick = () => {
      const list = groups(); const group = list.find((item) => item.id === button.dataset.bulkDelete); if (!group) return;
      if (!window.confirm(`هل تريد حذف تنظيم «${group.name}»؟ لن تُحذف المنتجات.`)) return; save(list.filter((item) => item.id !== group.id)); render('edit'); notify('تم حذف تنظيم المجموعة.');
    });
    root.querySelectorAll('[data-bulk-edit-product]').forEach((button) => button.onclick = () => notify('سيتم فتح نموذج تعديل المنتج بعد ربط المنتج بالمجموعة.', 'info'));
  }

  function showSection() {
    const app = appRoot(); if (!app) return;
    if (!dashboardSnapshot) dashboardSnapshot = app.innerHTML;
    app.innerHTML = '<div id="bulkProductsWorkspace"></div>';
    render('add');
  }
  function restoreDashboard() {
    const app = appRoot(); if (!app || !dashboardSnapshot) return;
    app.innerHTML = dashboardSnapshot; dashboardSnapshot = null; injectEntry();
  }
  function injectEntry() {
    const nav = document.querySelector('.admin-groups') || document.querySelector('[data-admin-groups]');
    const old = document.querySelector('[data-bulk-main-nav]');
    if (!nav) { old?.remove(); return; }
    if (old) return;
    const entry = document.createElement('article'); entry.className = 'admin-tile bulk-main-nav'; entry.dataset.bulkMainNav = '1';
    entry.innerHTML = `<div class="tile-icon">${icon}</div><h3>المنتجات المجمعة</h3><p>إضافة وتنظيم وتعديل مجموعات المنتجات</p>`;
    entry.onclick = showSection; nav.appendChild(entry);
  }
  new MutationObserver(() => window.setTimeout(injectEntry, 0)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => window.setTimeout(injectEntry, 80));
  injectEntry();
})();
