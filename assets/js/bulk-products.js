/* Bulk products workspace: organizes existing product forms without duplicating product storage. */
(() => {
  const KEY = 'alishop-bulk-groups-v1';
  const readGroups = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const saveGroups = (groups) => localStorage.setItem(KEY, JSON.stringify(groups));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function findExistingAddButton() {
    return [...document.querySelectorAll('button')].find((b) => /إضافة|منتج جديد|منتج/.test(b.textContent || '') && !b.closest('#bulkProductsWorkspace'));
  }

  function workspace() {
    return document.querySelector('#bulkProductsWorkspace');
  }

  function render(mode = 'add') {
    const root = workspace(); if (!root) return;
    const groups = readGroups();
    root.innerHTML = `<div class="bulk-head"><div><span class="bulk-kicker">إدارة منظمة</span><h2>إدارة المنتجات المجمعة</h2><p>أضف المنتجات واحدًا تلو الآخر أو عدّل مجموعة محفوظة دون تغيير نموذج المنتج الأصلي.</p></div><button class="btn soft" data-bulk-back>العودة إلى الإدارة</button></div>
      <div class="bulk-tabs"><button class="${mode === 'add' ? 'active' : ''}" data-bulk-tab="add">إضافة المنتجات</button><button class="${mode === 'edit' ? 'active' : ''}" data-bulk-tab="edit">تعديل المنتجات</button></div>
      <div class="bulk-panel" data-bulk-panel="add" ${mode !== 'add' ? 'hidden' : ''}>${addView(groups)}</div>
      <div class="bulk-panel" data-bulk-panel="edit" ${mode !== 'edit' ? 'hidden' : ''}>${editView(groups)}</div>`;
    root.querySelectorAll('[data-bulk-tab]').forEach((b) => b.onclick = () => render(b.dataset.bulkTab));
    root.querySelector('[data-bulk-back]')?.addEventListener('click', () => location.hash = '#/admin');
    root.querySelector('[data-bulk-new]')?.addEventListener('click', () => { const g = { id: crypto.randomUUID(), name: root.querySelector('[data-bulk-name]').value.trim() || `مجموعة ${new Date().toLocaleDateString('ar')}`, products: [], createdAt: Date.now() }; groups.unshift(g); saveGroups(groups); render('add'); toast?.('تم إنشاء المجموعة. أضف المنتج الأول من النموذج الأصلي.', 'success'); setTimeout(() => findExistingAddButton()?.click(), 80); });
    root.querySelectorAll('[data-bulk-open]').forEach((b) => b.onclick = () => { const g = groups.find((x) => x.id === b.dataset.bulkOpen); if (g) { g.open = !g.open; saveGroups(groups); render('edit'); } });
    root.querySelectorAll('[data-bulk-delete]').forEach((b) => b.onclick = () => { const next = groups.filter((x) => x.id !== b.dataset.bulkDelete); saveGroups(next); render('edit'); toast?.('تم حذف تنظيم المجموعة، ولم يتم حذف المنتجات.', 'success'); });
  }

  function addView(groups) {
    return `<div class="bulk-create-card"><div class="bulk-icon">＋</div><div><h3>إضافة مجموعة جديدة</h3><p>بعد إنشاء المجموعة سيُفتح نموذج إضافة المنتج الموجود حاليًا في النظام.</p></div><label>اسم المجموعة<input data-bulk-name placeholder="مثال: منتجات شهر سبتمبر"></label><button class="btn primary" data-bulk-new>إنشاء المجموعة وإضافة المنتج</button></div><div class="bulk-note">كل منتج يُحفظ في جدول المنتجات الرئيسي مباشرة، والمجموعة تستخدم للتنظيم فقط.</div>${groups.length ? `<h3 class="bulk-subtitle">المجموعات الحالية</h3>${groups.map(groupCard).join('')}` : ''}`;
  }

  function editView(groups) {
    return groups.length ? `<div class="bulk-grid">${groups.map(groupCard).join('')}</div>` : `<div class="bulk-empty"><div>▦</div><h3>لا توجد مجموعات بعد</h3><p>ابدأ من تبويب إضافة المنتجات لإنشاء أول مجموعة.</p></div>`;
  }

  function groupCard(g) {
    return `<article class="bulk-group-card"><div class="bulk-group-top"><span class="bulk-group-mark">▦</span><div><h3>${esc(g.name)}</h3><p>${g.products?.length || 0} منتجات محفوظة</p></div><span class="bulk-group-date">${new Date(g.createdAt).toLocaleDateString('ar')}</span></div><div class="bulk-group-actions"><button class="btn soft" data-bulk-open="${g.id}">${g.open ? 'إخفاء المنتجات' : 'عرض المنتجات'}</button><button class="btn soft" data-bulk-delete="${g.id}">حذف التنظيم</button></div>${g.open ? `<div class="bulk-products-list"><div class="bulk-empty small"><p>ستظهر المنتجات المحفوظة هنا بعد ربط الحفظ بالمجموعة.</p></div></div>` : ''}</article>`;
  }

  function injectEntry() {
    const admin = document.querySelector('#adminContent') || document.querySelector('#app');
    const nav = document.querySelector('.admin-groups') || document.querySelector('[data-admin-groups]');
    const oldEntry = document.querySelector('[data-bulk-main-nav]');
    if (!nav) {
      oldEntry?.remove();
      return;
    }
    if (oldEntry || !admin) return;
    const entry = document.createElement('button');
    entry.type = 'button'; entry.dataset.bulkMainNav = '1'; entry.dataset.adminPage = 'bulk-products';
    entry.className = 'admin-tile bulk-main-nav';
    entry.innerHTML = '<span class="bulk-nav-mark">▦</span><span>المنتجات المجمعة</span>';
    entry.onclick = () => {
      const content = document.querySelector('#adminContent') || document.querySelector('#app');
      if (!content) return;
      content.innerHTML = '<section id="bulkProductsWorkspace"></section>';
      render('add');
    };
    nav.appendChild(entry);
  }
  new MutationObserver(injectEntry).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => window.setTimeout(injectEntry, 80));
  injectEntry();
})();
