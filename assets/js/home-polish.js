/* AliShop home organization: reorders existing sections only; it never removes content. */
(() => {
  let lastApp;
  function organize() {
    const app = document.querySelector('#app');
    if (!app) return;
    const hello = app.querySelector('.home-hello');
    const search = app.querySelector('.home-search');
    const hero = app.querySelector('.hero-slider');
    const wallet = app.querySelector('.wallet-card');
    if (!hello || !search || !hero || !wallet) return;
    if (app !== lastApp) {
      lastApp = app;
      app.classList.add('home-organized');
      if (hello) hello.classList.add('home-priority');
      if (search) search.classList.add('home-priority');
      if (hero) hero.classList.add('home-priority', 'home-hero');
      if (wallet) wallet.classList.add('home-priority', 'home-wallet');
      /* Put the four priority blocks first in the exact intended order. */
      const priority = [hello, search, hero, wallet];
      const restAnchor = [...app.children].find((child) => !priority.includes(child)) || null;
      const fragment = document.createDocumentFragment();
      priority.forEach((child) => fragment.appendChild(child));
      app.insertBefore(fragment, restAnchor);
      [...app.children].forEach((child, index) => {
        child.style.order = String(index + 10);
        child.classList.add('home-flow-item');
      });
      hello.style.order = '1';
      search.style.order = '2';
      hero.style.order = '3';
      wallet.style.order = '4';
    }
    [...app.querySelectorAll('.section')].forEach((section, index) => {
      section.classList.add('home-section', `home-section-${index + 1}`);
      const next = section.nextElementSibling;
      if (next?.classList.contains('platforms-rail')) next.classList.add('home-rail');
      if (next?.classList.contains('grid')) next.classList.add('home-product-grid');
    });
    app.querySelectorAll('a,button').forEach((control) => {
      const text = (control.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/(فتح القسم|عرض الكل|عرض كل|^الكل$)/.test(text)) return;
      [...control.childNodes].forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = 'عرض الكل';
      });
      if (!control.textContent.includes('عرض الكل')) control.append('عرض الكل');
      control.classList.add('home-all-action');
    });
  }
  const observer = new MutationObserver(organize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', organize);
})();
