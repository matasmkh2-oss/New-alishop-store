/* Bulk products workspace: stable admin flow with themed dialogs and no dashboard rebuild. */
(() => {
  const KEY = 'alishop-bulk-groups-v3';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (value) => localStorage.setItem(KEY, JSON.stringify(value));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z"/><path d="m4 7.5 8 3.5 8-3.5M12 11v9"/></svg>';
  const workspace = () => document.querySelector('#bulkProductsWorkspace');
  const notify = (message, type = 'success') => window.toast?.(message, type);
  const db = () => window.__alishopSupabase;
  const activeId = () => sessionStorage.getItem('alishop-active-bulk-group') || '';
  const setActive = (id) => id ? sessionStorage.setItem('alishop-active-bulk-group', id) : sessionStorage.removeItem('alishop-active-bulk-group');
  const existingProductButton = () => window.productForm ? () => window.productForm() : null;

  function dialog({ title, body, confirmText = 'حفظ', danger = false, onConfirm }) {
    document.querySelector('[data-bulk-dialog]')?.remove();
    const node = document.createElement('div');
    node.dataset.bulkDialog = '1'; node.className = 'bulk-dialog-backdrop';
    node.innerHTML = `<div class="bulk-dialog" role="dialog" aria-modal="true"><button class="bulk-dialog-close" type="button" data-bulk-close>×</button><h3>${title}</h3><div class="bulk-dialog-body">${body}</div><div class="bulk-dialog-actions"><button class="btn soft" type="button" data-bulk-close>إلغاء</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-bulk-confirm>${confirmText}</button></div></div>`;
    document.body.appendChild(node);
    node.querySelectorAll('[data-bulk-close]').forEach((button) => button.onclick = () => node.remove());
    node.addEventListener('click', (event) => { if (event.target === node) node.remove(); });
    node.querySelector('[data-bulk-confirm]').onclick = () => { onConfirm?.(node); node.remove(); };
    node.querySelector('input,textarea')?.focus();
  }

  function groupCard(group) {
    const products = Array.isArray(group.products) ? group.products : [];
    return `<article class="item bulk-group-card"><div class="item-main"><div class="bulk-group-heading"><span class="tile-icon bulk-group-icon">${icon}</span><div><h3>${esc(group.name)}</h3><p>${products.length} منتجات محفوظة · ${new Date(group.createdAt).toLocaleDateString('ar')}</p></div></div>${group.open ? `<div class="bulk-products-list">${products.length ? products.map((product, index) => `<div class="bulk-product-row"><span>${esc(product.name || `المنتج ${index + 1}`)}</span><small>${esc(product.price || '')}</small><button class="btn soft" data-bulk-edit-product="${esc(product.id || '')}">تعديل</button></div>`).join('') : '<div class="bulk-empty small"><strong>لا توجد منتجات مرتبطة بعد</strong><p>أنشئ المنتج الأول من زر الإضافة ليظهر هنا.</p></div>'}</div>` : ''}</div><div class="item-actions bulk-group-actions"><button class="icon-action" type="button" data-bulk-open="${esc(group.id)}">${group.open ? 'إخفاء' : 'عرض المنتجات'}</button>${activeId() === group.id && group.products?.length ? '<button class="icon-action bulk-complete" type="button" data-bulk-complete="'+esc(group.id)+'">حفظ المجموعة</button>' : ''}<button class="icon-action" type="button" data-bulk-rename="${esc(group.id)}">تعديل</button><button class="icon-action danger" type="button" data-bulk-delete="${esc(group.id)}">حذف</button></div></article>`;
  }

  function render(mode = 'add') {
    const root = workspace(); if (!root) return;
    const list = read();
    root.innerHTML = `<section class="page admin-page bulk-page"><div class="section-head"><div><small>لوحة الإدارة</small><h2>إدارة المنتجات المجمعة</h2><p>إضافة وتنظيم وتعديل مجموعات المنتجات بطريقة واضحة وآمنة.</p></div><button class="btn soft" type="button" data-bulk-back>العودة إلى لوحة الإدارة</button></div><div class="tabs bulk-tabs" role="tablist"><button class="tab ${mode === 'add' ? 'active' : ''}" type="button" data-bulk-tab="add">${icon} إضافة المنتجات</button><button class="tab ${mode === 'edit' ? 'active' : ''}" type="button" data-bulk-tab="edit">${icon} تعديل المنتجات</button></div><div class="bulk-panel" data-bulk-panel="add" ${mode !== 'add' ? 'hidden' : ''}><div class="card bulk-create-card"><span class="tile-icon bulk-create-icon">${icon}</span><div class="bulk-create-copy"><h3>إنشاء مجموعة جديدة</h3><p>اكتب الاسم ثم اضغط إنشاء. سيبقى القسم مفتوحًا ولن تعود إلى لوحة الإدارة.</p></div><label class="bulk-name-field">اسم المجموعة<input data-bulk-name placeholder="مثال: منتجات شهر سبتمبر"></label><button class="btn primary" type="button" data-bulk-new>إنشاء المجموعة</button></div><div class="admin-note-card bulk-note">تُحفظ المنتجات في جدول المنتجات الرئيسي، وتُستخدم المجموعة للتنظيم فقط.</div>${list.length ? `<h3 class="bulk-subtitle">المجموعات الحالية</h3><div class="list bulk-list">${list.map(groupCard).join('')}</div>` : '<div class="empty bulk-empty"><h3>لا توجد مجموعات بعد</h3><p>أنشئ المجموعة الأولى من الزر أعلاه.</p></div>'}</div><div class="bulk-panel" data-bulk-panel="edit" ${mode !== 'edit' ? 'hidden' : ''}>${list.length ? `<div class="list bulk-list">${list.map(groupCard).join('')}</div>` : '<div class="empty bulk-empty"><h3>لا توجد مجموعات بعد</h3><p>ابدأ من تبويب إضافة المنتجات.</p></div>'}</div></section>`;
    bind(root);
  }

  function bind(root) {
    root.querySelectorAll('[data-bulk-tab]').forEach((button) => button.onclick = () => render(button.dataset.bulkTab));
    root.querySelector('[data-bulk-back]')?.addEventListener('click', () => { workspace()?.remove(); injectEntry(); });
    root.querySelector('[data-bulk-new]')?.addEventListener('click', async () => {
      const input = root.querySelector('[data-bulk-name]'); const name = input?.value.trim();
      if (!name) return notify('اكتب اسم المجموعة أولًا.', 'error');
      const { data: created, error } = await db().from('bulk_product_groups').insert({ name, status: 'draft' }).select('id,name,created_at').single();
      if (error || !created) return notify('تعذر إنشاء المجموعة في قاعدة البيانات.', 'error');
      const list = read(); list.unshift({ id: created.id, name: created.name, products: [], createdAt: created.created_at || Date.now(), open: true }); save(list); setActive(created.id); render('add'); notify('تم إنشاء المجموعة. أضف المنتج الأول الآن.');
      window.setTimeout(() => existingProductButton()?.(), 160);
    });
    root.querySelectorAll('[data-bulk-open]').forEach((button) => button.onclick = () => { const list = read(); const group = list.find((item) => item.id === button.dataset.bulkOpen); if (!group) return; group.open = !group.open; save(list); render(root.querySelector('[data-bulk-tab].active')?.dataset.bulkTab || 'edit'); });
    root.querySelectorAll('[data-bulk-rename]').forEach((button) => button.onclick = () => { const group = read().find((item) => item.id === button.dataset.bulkRename); if (!group) return; dialog({ title: 'تعديل اسم المجموعة', body: `<label class="bulk-dialog-field">اسم المجموعة<input data-bulk-dialog-name value="${esc(group.name)}"></label>`, onConfirm: (node) => { const name = node.querySelector('[data-bulk-dialog-name]').value.trim(); if (!name) return notify('اكتب اسمًا صحيحًا للمجموعة.', 'error'); const list = read(); list.find((item) => item.id === group.id).name = name; save(list); render('edit'); notify('تم تعديل اسم المجموعة.'); } }); });
    root.querySelectorAll('[data-bulk-delete]').forEach((button) => button.onclick = () => { const group = read().find((item) => item.id === button.dataset.bulkDelete); if (!group) return; dialog({ title: 'حذف تنظيم المجموعة', body: `<p>سيتم حذف تنظيم «${esc(group.name)}» فقط، ولن تُحذف المنتجات من المتجر.</p>`, confirmText: 'حذف التنظيم', danger: true, onConfirm: async () => { const { error } = await db().from('bulk_product_groups').delete().eq('id', group.id); if (error) return notify('تعذر حذف المجموعة.', 'error'); save(read().filter((item) => item.id !== group.id)); if (activeId() === group.id) setActive(''); render('edit'); notify('تم حذف تنظيم المجموعة.'); } }); });
    root.querySelectorAll('[data-bulk-complete]').forEach((button) => button.onclick = async () => { const { error } = await db().from('bulk_product_groups').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', button.dataset.bulkComplete); if (error) return notify('تعذر حفظ المجموعة.', 'error'); if (activeId() === button.dataset.bulkComplete) setActive(''); render('edit'); notify('تم حفظ المجموعة كاملة بنجاح.'); });
    root.querySelectorAll('[data-bulk-edit-product]').forEach((button) => button.onclick = async () => {
      const { data, error } = await db().from('products').select('*').eq('id', button.dataset.bulkEditProduct).single();
      if (error || !data) return notify('تعذر تحميل بيانات المنتج للتعديل.', 'error');
      if (typeof window.productForm !== 'function') return notify('نموذج تعديل المنتج غير متاح حاليًا.', 'error');
      window.productForm(data, data.catalog_section);
    });
  }

  function showSection() { const app = document.querySelector('#app'); if (!app) return; app.innerHTML = '<div id="bulkProductsWorkspace"></div>'; render('add'); }
  function injectEntry() { const nav = document.querySelector('.admin-groups') || document.querySelector('[data-admin-groups]'); const old = document.querySelector('[data-bulk-main-nav]'); if (!nav) { old?.remove(); return; } if (old) return; const entry = document.createElement('article'); entry.className = 'admin-tile bulk-main-nav'; entry.dataset.bulkMainNav = '1'; entry.innerHTML = `<div class="tile-icon">${icon}</div><h3>المنتجات المجمعة</h3><p>إضافة وتنظيم وتعديل مجموعات المنتجات</p>`; entry.onclick = showSection; nav.appendChild(entry); }
  window.addEventListener('alishop:product-saved', async (event) => { const id = activeId(); const productId = event.detail?.id; if (!id || !productId || event.detail?.mode !== 'insert') return; const list = read(); const group = list.find((item) => item.id === id); if (!group) return; const position = group.products.length; const { error } = await db().from('bulk_product_group_items').upsert({ group_id: id, product_id: productId, position }, { onConflict: 'group_id,product_id' }); if (error) return notify('تم حفظ المنتج لكن تعذر ربطه بالمجموعة.', 'error'); group.products.push({ id: productId, name: event.detail.product?.name, price: event.detail.product?.price }); group.open = true; save(list); notify('تمت إضافة المنتج إلى المجموعة. يمكنك إضافة منتج آخر.'); window.setTimeout(() => { if (workspace()) render('add'); }, 120); });
  new MutationObserver(() => window.setTimeout(injectEntry, 0)).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => window.setTimeout(injectEntry, 80));
  injectEntry();
})();
