/* Keep one active tab per tab group and synchronize visual state and admin navigation (Zero-observer) */
(() => {
  const selectors = '.tabs .tab, .catalog-admin-tabs button, .catalog-top-tabs button, [data-admin-page]';

  const sync = (tab) => {
    const group = tab.closest('.tabs, .catalog-admin-tabs, .catalog-top-tabs');
    if (!group) return;
    group.querySelectorAll(selectors).forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
    });
  };

  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.(selectors);
    if (!tab) return;
    sync(tab);

    const adminPage = tab.dataset?.adminPage;
    if (adminPage && window.S) {
      window.S.adminPage = adminPage;
      const pageToGroup = {
        'orders': 'sales',
        'cancel_requests': 'sales',
        'catalog_items': 'catalog',
        'categories': 'catalog',
        'inventory': 'catalog',
        'deposits': 'finance',
        'transactions': 'finance',
        'payment_methods': 'finance',
        'cards': 'finance',
        'coupons': 'finance',
        'users': 'users',
        'slides': 'marketing',
        'announcements': 'marketing',
        'notifications': 'marketing',
        'faqs': 'marketing',
        'settings': 'system',
        'support': 'system',
        'logs': 'system'
      };
      if (pageToGroup[adminPage]) {
        window.S.adminGroup = pageToGroup[adminPage];
      }
      window.S.page = 1;
      window.S.query = '';
      window.S.filter = '';
      window.S.adminUserFilter = '';
      if (typeof window.renderAdminPage === 'function' && document.getElementById('adminContent')) {
        window.renderAdminPage();
      } else if (typeof window.admin === 'function') {
        window.admin();
      }
    }
  });

  function syncAll() {
    document.querySelectorAll('.tabs, .catalog-admin-tabs, .catalog-top-tabs').forEach((group) => {
      const active = group.querySelector('.active') || group.querySelector('[aria-selected="true"]');
      if (active) sync(active);
    });
  }

  window.addEventListener('hashchange', () => setTimeout(syncAll, 60));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAll, { once: true });
  } else {
    syncAll();
  }
})();
