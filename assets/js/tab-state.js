/* Keep one active tab per tab group and synchronize visual state. */
(() => {
  const selectors = '.tabs .tab,.catalog-admin-tabs button,.catalog-top-tabs button';
  const sync = (tab) => {
    const group = tab.closest('.tabs,.catalog-admin-tabs,.catalog-top-tabs');
    if (!group) return;
    group.querySelectorAll(selectors).forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
    });
  };
  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.(selectors);
    if (tab) sync(tab);
  }, true);
  const observer = new MutationObserver(() => {
    document.querySelectorAll('.tabs,.catalog-admin-tabs,.catalog-top-tabs').forEach((group) => {
      const active = group.querySelector('[aria-selected="true"]') || group.querySelector('.active');
      if (active) sync(active);
    });
  });
  document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
})();
