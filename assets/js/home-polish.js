/* AliShop home organization: reorders existing sections and normalizes numbers/currency to store settings */
(() => {
  let lastApp;

  // Convert any Eastern Arabic/Indic digits to Western Latin numerals (0-9)
  function toLatinDigits(str) {
    if (str == null) return '';
    return String(str).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => c.charCodeAt(0) & 0xf);
  }
  window.toLatinDigits = toLatinDigits;

  function organize() {
    const app = document.querySelector('#view-home') || document.querySelector('#app');
    if (!app) return;
    const hello = app.querySelector('.home-hello');
    const search = app.querySelector('.home-search');
    const headerRow = app.querySelector('.home-header-row');
    const hero = app.querySelector('.hero-slider');
    const wallet = app.querySelector('.wallet-card');

    // Remove redundant greeting and home search elements as requested
    if (headerRow) headerRow.remove();
    if (hello) hello.remove();
    if (search) search.remove();

    // Remove standalone external search button if present
    document.querySelectorAll('#homeSearchBtn, button#homeSearchBtn').forEach((btn) => btn.remove());

    // Ensure balance in wallet card is accurate and synced with dynamic store currency and Latin numerals
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

    // Normalize any price or numeral nodes to Latin digits
    app.querySelectorAll('.price, .wallet-card strong, .stat strong, del').forEach((el) => {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
        const txt = el.textContent;
        const normalized = toLatinDigits(txt);
        if (txt !== normalized) {
          el.textContent = normalized;
        }
      }
    });

    if (!hero && !wallet) return;

    if (app !== lastApp) {
      lastApp = app;
      app.classList.add('home-organized');
      if (hero) hero.classList.add('home-priority', 'home-hero');
      if (wallet) wallet.classList.add('home-priority', 'home-wallet');

      /* Put the priority blocks first in the exact intended order. */
      const priority = [hero, wallet].filter(Boolean);
      const restAnchor = [...app.children].find((child) => !priority.includes(child)) || null;
      const fragment = document.createDocumentFragment();
      priority.forEach((child) => fragment.appendChild(child));
      app.insertBefore(fragment, restAnchor);
      [...app.children].forEach((child, index) => {
        child.style.order = String(index + 10);
        child.classList.add('home-flow-item');
      });
      if (hero) hero.style.order = '1';
      if (wallet) wallet.style.order = '2';
    }
    [...app.querySelectorAll('.section')].forEach((section, index) => {
      section.classList.add('home-section', `home-section-${index + 1}`);
      const next = section.nextElementSibling;
      if (next?.classList.contains('platforms-rail')) next.classList.add('home-rail');
      if (next?.classList.contains('grid') && !next.classList.contains('recent-products-slider') && !next.querySelector('.recent-products-track')) {
        next.classList.add('home-product-grid', 'home-grid-compact', 'view-compact');
      }
    });
    app.querySelectorAll('.grid, .home-product-grid, .catalog-image-grid, #homeGrid').forEach((grid) => {
      if (grid.classList.contains('recent-products-slider') || grid.closest('.recent-products-slider') || grid.querySelector('.recent-products-track')) return;
      grid.classList.add('home-grid-compact', 'view-compact');
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

  function syncWalletDiscount() {
    const app = document.querySelector('#view-home') || document.querySelector('#app');
    if (!app) return;
    const wallet = app.querySelector('.wallet-card') || app.querySelector('.home-wallet');
    if (!wallet) return;

    const discountPercent = Number(window.S?.profile?.discount_percent) || 0;
    const currentKey = String(discountPercent);

    // Strict guard to prevent redundant DOM operations or loops
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
        if (window.lucide?.createIcons) {
          try {
            window.lucide.createIcons({
              nameAttr: 'data-lucide',
              attrs: { class: 'lucide' },
              elements: [discountBadge]
            });
          } catch (_) {}
        }
      }
      discountBadge.style.display = 'inline-flex';

      // Clean up old row element if present
      const oldRow = wallet.querySelector('.wallet-discount-row');
      if (oldRow) oldRow.remove();
    } else {
      if (discountBadge) discountBadge.remove();
      const oldRow = wallet.querySelector('.wallet-discount-row');
      if (oldRow) oldRow.remove();
    }
  }

  window.syncWalletDiscount = syncWalletDiscount;

  window.addEventListener('alishop:identity-loaded', syncWalletDiscount);
  window.addEventListener('alishop:profile-updated', syncWalletDiscount);
  window.addEventListener('alishop:branding-updated', syncWalletDiscount);
  window.addEventListener('hashchange', () => setTimeout(syncWalletDiscount, 50));
  window.addEventListener('focus', syncWalletDiscount);

  document.addEventListener('DOMContentLoaded', () => {
    organize();
    syncWalletDiscount();
  });
})();
