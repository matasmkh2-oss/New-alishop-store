/* Premium, seamless recent-products marquee: active, animated, and resilient */
(() => {
  const sectionTitle = (section) => (section.querySelector('h2, .section-title, .title')?.textContent || '').replace(/\s+/g, ' ').trim();
  const prepared = new WeakSet();
  let isRunning = false;
  let observer;

  function setup() {
    if (isRunning) return;
    isRunning = true;
    if (observer) observer.disconnect();

    try {
      const sections = document.querySelectorAll('#app .section, #view-home .section, .section');
      sections.forEach((section) => {
        const titleText = sectionTitle(section);
        const subText = (section.querySelector('p')?.textContent || '').trim();
        const fullText = `${titleText} ${subText}`;

        if (!/وصل\s*حديث|حديثاً|حديثا|أضيفت\s*خلال|جديد/i.test(fullText)) return;

        const grid = section.nextElementSibling;
        if (!grid || !grid.classList.contains('grid') || prepared.has(grid) || grid.querySelector('.recent-products-track')) return;

        const cards = [...grid.children].filter((card) => 
          card.matches('.catalog-image-card, .product-card, .pcard, .card, [data-open-product], [data-product-id]')
        );

        if (cards.length < 2) return;
        prepared.add(grid);
        grid.classList.add('recent-products-slider');

        const track = document.createElement('div');
        track.className = 'recent-products-track';
        const firstSet = document.createElement('div');
        firstSet.className = 'recent-products-set';
        const secondSet = document.createElement('div');
        secondSet.className = 'recent-products-set';
        const visibleCards = [];

        for (let index = 0; index < Math.max(8, cards.length); index += 1) {
          const card = cards[index % cards.length];
          const item = index < cards.length ? card : card.cloneNode(true);
          if (index >= cards.length) {
            item.setAttribute('aria-hidden', 'true');
            item.removeAttribute('id');
          }
          visibleCards.push(item);
          firstSet.appendChild(item);
        }

        visibleCards.forEach((card) => {
          const clone = card.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          clone.removeAttribute('id');
          secondSet.appendChild(clone);
        });

        track.append(firstSet, secondSet);
        grid.replaceChildren(track);

        const duration = Math.max(22, visibleCards.length * 3.5);
        track.style.setProperty('--recent-duration', `${duration}s`);
        requestAnimationFrame(() => {
          const dist = firstSet.offsetWidth || (visibleCards.length * 180);
          track.style.setProperty('--recent-distance', `${dist}px`);
        });

        grid.addEventListener('mouseenter', () => track.classList.add('is-paused'), { passive: true });
        grid.addEventListener('mouseleave', () => track.classList.remove('is-paused'), { passive: true });
        grid.addEventListener('touchstart', () => track.classList.add('is-paused'), { passive: true });
        grid.addEventListener('touchend', () => setTimeout(() => track.classList.remove('is-paused'), 1800), { passive: true });
      });
    } finally {
      isRunning = false;
      startObserver();
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();
    const app = document.getElementById('app') || document.body;
    if (!app) return;
    observer = new MutationObserver(() => setup());
    observer.observe(app, { childList: true, subtree: true });
  }

  window.addEventListener('hashchange', () => setTimeout(setup, 120));
  window.addEventListener('alishop:route', () => setTimeout(setup, 120));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
