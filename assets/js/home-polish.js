/* AliShop home organization: clean, debounced, lightweight optimizer */
(() => {
  function toLatinDigits(str) {
    if (str == null) return '';
    return String(str).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => c.charCodeAt(0) & 0xf);
  }
  window.toLatinDigits = toLatinDigits;

  let isOrganizing = false;
  let organizeTimer = null;

  function organize() {
    if (isOrganizing) return;
    if (location.hash && location.hash !== '#' && location.hash !== '#/' && location.hash !== '#/home') {
      return; // Not on home page
    }

    const app = document.querySelector('#view-home') || document.querySelector('#app');
    if (!app) return;

    isOrganizing = true;
    try {
      const headerRow = app.querySelector('.home-header-row');
      const hello = app.querySelector('.home-hello');
      const search = app.querySelector('.home-search');
      const hero = app.querySelector('.hero-slider');
      const wallet = app.querySelector('.wallet-card');

      if (headerRow) headerRow.remove();
      if (hello) hello.remove();
      if (search) search.remove();

      // Sync wallet balance
      const balanceStrong = app.querySelector('.wallet-card-top strong, .home-wallet strong, .balance');
      if (balanceStrong && window.S) {
        const bal = window.S.wallet?.balance ?? window.S.profile?.balance ?? window.S.profile?.wallet_balance ?? 0;
        const cur = window.S.settings?.currency || window.CONFIG?.CURRENCY || 'USD';
        const formatted = typeof window.money === 'function' 
          ? window.money(bal) 
          : (toLatinDigits(Number(bal).toFixed(2)) + ' ' + cur);
        if (balanceStrong.dataset.lastBal !== String(bal) || balanceStrong.dataset.lastCur !== cur) {
          balanceStrong.dataset.lastBal = String(bal);
          balanceStrong.dataset.lastCur = cur;
          balanceStrong.textContent = formatted;
        }
      }

      if (hero && !hero.classList.contains('home-hero')) {
        hero.classList.add('home-priority', 'home-hero');
        hero.style.order = '1';
      }
      if (wallet && !wallet.classList.contains('home-wallet')) {
        wallet.classList.add('home-priority', 'home-wallet');
        wallet.style.order = '2';
      }

      app.querySelectorAll('.section:not(.home-section)').forEach((section, index) => {
        section.classList.add('home-section', `home-section-${index + 1}`);
        const next = section.nextElementSibling;
        if (next?.classList.contains('platforms-rail')) next.classList.add('home-rail');
        if (next?.classList.contains('grid') && !next.classList.contains('recent-products-slider') && !next.querySelector('.recent-products-track')) {
          next.classList.add('home-product-grid', 'home-grid-compact', 'view-compact');
        }
      });
    } finally {
      isOrganizing = false;
    }
  }

  function scheduleOrganize() {
    if (organizeTimer) clearTimeout(organizeTimer);
    organizeTimer = setTimeout(organize, 50);
  }

  function syncWalletDiscount() {
    const app = document.querySelector('#view-home') || document.querySelector('#app');
    if (!app) return;
    const wallet = app.querySelector('.wallet-card') || app.querySelector('.home-wallet');
    if (!wallet) return;

    const discountPercent = Number(window.S?.profile?.discount_percent) || 0;
    const currentKey = String(discountPercent);

    if (wallet.dataset.syncedDiscount === currentKey) return;
    wallet.dataset.syncedDiscount = currentKey;

    const topRow = wallet.querySelector('.wallet-card-top');
    let discountBadge = wallet.querySelector('.wallet-discount-inline-badge');

    if (discountPercent > 0) {
      if (!discountBadge) {
        discountBadge = document.createElement('div');
        discountBadge.className = 'wallet-discount-inline-badge';
        if (topRow) {
          topRow.appendChild(discountBadge);
        } else {
          wallet.prepend(discountBadge);
        }
      }
      const desiredHtml = `<i data-lucide="percent"></i>خصم خاص <strong>${discountPercent}%</strong>`;
      if (discountBadge.innerHTML !== desiredHtml) {
        discountBadge.innerHTML = desiredHtml;
        if (window.refreshIcons) window.refreshIcons(discountBadge);
      }
      discountBadge.style.display = 'inline-flex';
    } else {
      if (discountBadge) discountBadge.remove();
    }
  }

  window.syncWalletDiscount = syncWalletDiscount;

  window.addEventListener('alishop:identity-loaded', syncWalletDiscount);
  window.addEventListener('alishop:profile-updated', syncWalletDiscount);
  window.addEventListener('alishop:branding-updated', syncWalletDiscount);
  window.addEventListener('hashchange', () => {
    scheduleOrganize();
    syncWalletDiscount();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      organize();
      syncWalletDiscount();
    }, { once: true });
  } else {
    organize();
    syncWalletDiscount();
  }
})();
