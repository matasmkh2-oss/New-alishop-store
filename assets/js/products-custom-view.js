/**
 * AliShop - Master Section Hero & Responsive Custom Views (V11)
 * يشمل:
 * 1. الهيدر الذكي المتنحي (Smart Auto-Hide on Scroll Down & Reveal on Scroll Up)
 *    لإفساح المجال لشريط الأقسام ليطفو وحيداً في قمة الشاشة دون أي تداخل نهائياً.
 * 2. الضمان الكامل لتطبيق التصميم الفاخر للعناصر العلوية والقائمة وشريط الأدوات بدون أي تأثر بالتحميل غير المتزامن.
 */
(function() {
  'use strict';

  const ICONS = {
    layers: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    grid: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
    compact: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>'
  };

  const VIEW_MODES = [
    { id: 'grid', iconKey: 'grid', title: 'عرض شبكة (عمودين)' },
    { id: 'compact', iconKey: 'compact', title: 'عرض مضغوط (3 أعمدة)' },
    { id: 'list', iconKey: 'list', title: 'عرض قائمة (سطر)' }
  ];

  function getModeIndex(modeId) {
    const idx = VIEW_MODES.findIndex(m => m.id === modeId);
    return idx >= 0 ? idx : 0;
  }

  /* ==========================================================================
     1. نظام الهيدر الذكي المتنحي (Smart Auto-Hide on Scroll Down)
     ========================================================================== */
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  let isScrollTicking = false;

  function isProductsViewActive() {
    const hash = window.location.hash || '';
    if (hash === '#/products' || hash.startsWith('#/products?') || hash.startsWith('#/products/')) {
      return true;
    }
    const productsView = document.getElementById('view-products');
    return productsView && productsView.classList.contains('active');
  }

  function setHeaderVisibility(visible) {
    const header = document.querySelector('header.native-app-bar, .app-header, header');
    if (visible) {
      document.body.classList.remove('header-is-hidden');
      if (header) header.classList.remove('header-auto-hidden');
    } else {
      document.body.classList.add('header-is-hidden');
      if (header) header.classList.add('header-auto-hidden');
    }
  }

  function handleSmartScroll() {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    // إذا لم نكن في صفحة المنتجات، نتأكد دائماً أن الهيدر ظاهر
    if (!isProductsViewActive()) {
      setHeaderVisibility(true);
      lastScrollY = currentScrollY;
      isScrollTicking = false;
      return;
    }

    // إذا كانت القائمة المنسدلة للملف الشخصي مفتوحة، نبقي الهيدر ظاهراً
    const isProfileMenuOpen = document.querySelector('.pdm-active, .profile-dropdown-menu.active, #profileMenu.active');
    if (isProfileMenuOpen) {
      setHeaderVisibility(true);
      lastScrollY = currentScrollY;
      isScrollTicking = false;
      return;
    }

    // في أعلى الصفحة: الهيدر ظاهر دائماً
    if (currentScrollY <= 45) {
      setHeaderVisibility(true);
      lastScrollY = currentScrollY;
      isScrollTicking = false;
      return;
    }

    const deltaY = currentScrollY - lastScrollY;

    // التمرير للأسفل (بفارق ملحوظ > 5px): إخفاء الهيدر
    if (deltaY > 5 && currentScrollY > 70) {
      setHeaderVisibility(false);
    }
    // التمرير للأعلى (بفارق ملحوظ < -6px): إظهار الهيدر
    else if (deltaY < -6) {
      setHeaderVisibility(true);
    }

    lastScrollY = currentScrollY;
    isScrollTicking = false;
  }

  window.addEventListener('scroll', function() {
    if (!isScrollTicking) {
      window.requestAnimationFrame(handleSmartScroll);
      isScrollTicking = true;
    }
  }, { passive: true });

  // عند تغيير المسار نرجع الهيدر فوراً لوضعه الطبيعي
  window.addEventListener('hashchange', function() {
    setHeaderVisibility(true);
    lastScrollY = window.pageYOffset || 0;
    staggeredInit();
  });

  window.addEventListener('alishop:route', function() {
    setHeaderVisibility(true);
    lastScrollY = window.pageYOffset || 0;
    staggeredInit();
  });


  /* ==========================================================================
     2. تثبيت وتنسيق عناصر صفحة المنتجات (Custom Products View)
     ========================================================================== */
  let isRunning = false;
  let observer = null;
  let debounceTimer = null;

  function initProductsCustomView() {
    if (!isProductsViewActive()) {
      return;
    }

    if (isRunning) return;
    isRunning = true;

    try {
      // 1. تنظيف وتنسيق هيدر الأقسام وضمان بقائه خفيفاً ومتجاوباً
      const topTabs = document.querySelector('.catalog-top-tabs');
      if (topTabs) {
        if (!topTabs.classList.contains('segmented-responsive-island')) {
          topTabs.classList.add('segmented-responsive-island');
        }
        const tabButtons = topTabs.querySelectorAll('button[data-catalog-tab]');
        tabButtons.forEach(btn => {
          btn.classList.add('segmented-item-btn');
          const oldWrap = btn.querySelector('.tab-icon-wrap');
          if (oldWrap) {
            const icon = oldWrap.querySelector('svg') || oldWrap.querySelector('i');
            if (icon) {
              btn.insertBefore(icon, oldWrap);
            }
            oldWrap.remove();
          }
        });
      }

      // 2. معالجة بطاقة الشرح وشريط الأدوات
      const hero = document.querySelector('.section-hero-pro');
      const toolbar = document.querySelector('.catalog-toolbar');

      if (toolbar) {
        // دمج شريط الأدوات داخل الجزء السفلي لبطاقة شرح القسم إن وُجدت
        if (hero && toolbar.parentElement !== hero) {
          hero.appendChild(toolbar);
          hero.classList.add('hero-with-toolbar');
        }

        // إزالة كلاس input العام لمنع تضارب الحدود والأنماط القديمة
        const catSelect = toolbar.querySelector('select.catalog-toolbar-cat');
        if (catSelect && catSelect.classList.contains('input')) {
          catSelect.classList.remove('input');
        }

        // 3. زر تبديل نمط العرض الفردي السريع
        const switchContainer = toolbar.querySelector('.catalog-view-switch');
        if (switchContainer) {
          const buttons = switchContainer.querySelectorAll('button[data-view-mode]');
          if (buttons && buttons.length >= 2) {
            let currentModeId = 'grid';
            if (window.S && window.S.productView) {
              currentModeId = window.S.productView;
            } else {
              const activeBtn = switchContainer.querySelector('button.active');
              if (activeBtn && activeBtn.dataset.viewMode) {
                currentModeId = activeBtn.dataset.viewMode;
              }
            }

            if (!switchContainer.classList.contains('single-toggle-ready')) {
              switchContainer.classList.add('single-toggle-ready');
            }

            let singleToggle = switchContainer.querySelector('.catalog-single-toggle-btn');
            if (!singleToggle) {
              singleToggle = document.createElement('button');
              singleToggle.type = 'button';
              singleToggle.className = 'catalog-single-toggle-btn';
              singleToggle.setAttribute('aria-label', 'تبديل نمط العرض');
              switchContainer.appendChild(singleToggle);
            }

            function updateSingleButtonUI(modeId) {
              const mode = VIEW_MODES.find(m => m.id === modeId) || VIEW_MODES[0];
              singleToggle.setAttribute('title', mode.title);
              singleToggle.setAttribute('data-current-mode', mode.id);
              singleToggle.innerHTML = ICONS[mode.iconKey] || ICONS.grid;
            }

            updateSingleButtonUI(currentModeId);

            singleToggle.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();

              const activeNow = (window.S && window.S.productView) || singleToggle.getAttribute('data-current-mode') || 'grid';
              const curIdx = getModeIndex(activeNow);
              const nextIdx = (curIdx + 1) % VIEW_MODES.length;
              const nextMode = VIEW_MODES[nextIdx];

              const targetOriginalBtn = switchContainer.querySelector(`button[data-view-mode="${nextMode.id}"]`);
              if (targetOriginalBtn) {
                targetOriginalBtn.click();
              } else if (window.S) {
                window.S.productView = nextMode.id;
                try { localStorage.setItem('alishop_product_view', nextMode.id); } catch(e){}
                const grid = document.getElementById('catalogGrid') || document.querySelector('.catalog-image-grid');
                if (grid) grid.className = 'catalog-image-grid view-' + nextMode.id;
              }

              updateSingleButtonUI(nextMode.id);
            };
          }
        }

        // 4. هيكلة القائمة المنسدلة بدون أي تداخل
        if (catSelect) {
          let wrapper = toolbar.querySelector('.catalog-cat-select-wrapper');
          if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'catalog-cat-select-wrapper';
            catSelect.parentNode.insertBefore(wrapper, catSelect);
            wrapper.appendChild(catSelect);

            const display = document.createElement('div');
            display.className = 'cat-select-display';
            display.innerHTML = `
              <span class="cat-select-icon">${ICONS.layers}</span>
              <span class="cat-select-label">كل الأقسام</span>
              <span class="cat-select-arrow">${ICONS.chevronDown}</span>
            `;
            wrapper.insertBefore(display, catSelect);

            const syncLabel = function() {
              const label = display.querySelector('.cat-select-label');
              if (label && catSelect.selectedIndex >= 0 && catSelect.options[catSelect.selectedIndex]) {
                label.textContent = catSelect.options[catSelect.selectedIndex].text || 'كل الأقسام';
              }
            };

            catSelect.addEventListener('change', syncLabel);
            catSelect.addEventListener('input', syncLabel);
            syncLabel();
          } else {
            const label = wrapper.querySelector('.cat-select-label');
            if (label && catSelect.selectedIndex >= 0 && catSelect.options[catSelect.selectedIndex]) {
              const currentTxt = catSelect.options[catSelect.selectedIndex].text || 'كل الأقسام';
              if (label.textContent !== currentTxt) {
                label.textContent = currentTxt;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Notice products custom view:", err);
    } finally {
      isRunning = false;
    }
  }

  function debouncedInit() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(initProductsCustomView, 35);
  }

  // تشغيل متتابع يضمن تطبيق التنسيق حتى في حال تأخر استجابة Supabase
  function staggeredInit() {
    debouncedInit();
    setTimeout(debouncedInit, 120);
    setTimeout(debouncedInit, 300);
    setTimeout(debouncedInit, 700);
    setTimeout(debouncedInit, 1300);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    const target = document.getElementById('view-products') || document.getElementById('app') || document.body;
    if (!target) return;

    // المراقبة الذكية العميقة (subtree: true) لضمان التقاط تحديثات #catalogDynamic بعد التحميل من قاعدة البيانات
    observer = new MutationObserver(function(mutations) {
      if (isProductsViewActive()) {
        let shouldUpdate = false;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.type === 'childList' && m.addedNodes.length > 0) {
            for (let j = 0; j < m.addedNodes.length; j++) {
              const node = m.addedNodes[j];
              if (node.nodeType === 1) {
                if (
                  node.classList?.contains('catalog-toolbar') ||
                  node.classList?.contains('section-hero-pro') ||
                  node.classList?.contains('catalog-top-tabs') ||
                  node.id === 'catalogDynamic' ||
                  node.querySelector?.('.catalog-toolbar, .section-hero-pro, .catalog-top-tabs')
                ) {
                  shouldUpdate = true;
                  break;
                }
              }
            }
          }
          if (shouldUpdate) break;
        }
        if (shouldUpdate) {
          debouncedInit();
        }
      }
    });

    observer.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      staggeredInit();
      startObserver();
    }, { once: true });
  } else {
    staggeredInit();
    startObserver();
  }

  // دعم التنقل المباشر
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href*="products"], [data-route="products"], [data-catalog-tab]');
    if (link) {
      staggeredInit();
    }
  });

  window.initProductsCustomView = initProductsCustomView;
})();
