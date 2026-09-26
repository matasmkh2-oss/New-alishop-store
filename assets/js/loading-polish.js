/* Non-blocking skeleton overlay: it never replaces #app, so routing can render normally. */
(() => {
  const markup = `<div id="globalLoadingSkeleton" class="global-skeleton" aria-label="جارٍ تحميل المحتوى" role="status"><div class="gs-head"><span class="gs-avatar"></span><span class="gs-lines"><i></i><i></i></span></div><div class="gs-hero"></div><div class="gs-grid">${Array.from({ length: 6 }, () => '<div class="gs-card"><i></i><b></b><em></em></div>').join('')}</div><p class="gs-status">جارٍ جلب بيانات المتجر...</p></div>`;
  let overlay;
  let safetyTimer;

  function show() {
    const app = document.querySelector('#app');
    if (!app || overlay?.isConnected) return;
    overlay = document.createElement('div');
    overlay.innerHTML = markup;
    overlay = overlay.firstElementChild;
    app.appendChild(overlay);
    safetyTimer = window.setTimeout(() => hide(), 12000);
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.add('is-ready');
    window.clearTimeout(safetyTimer);
    window.setTimeout(() => overlay?.remove(), 420);
    overlay = null;
  }

  function watch() {
    const app = document.querySelector('#app');
    if (!app) return;
    if ([...app.children].some((node) => node.id !== 'globalLoadingSkeleton')) hide();
  }

  document.addEventListener('DOMContentLoaded', show, { once: true });
  window.addEventListener('hashchange', () => { hide(); show(); });
  new MutationObserver(watch).observe(document.documentElement, { childList: true, subtree: true });
})();
