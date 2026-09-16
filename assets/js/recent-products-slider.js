/* Premium, seamless recent-products marquee. Existing cards are preserved; only a visual duplicate track is added. */
(() => {
  const sectionTitle = (section) => (section.querySelector('h2')?.textContent || '').replace(/\s+/g, ' ').trim();
  let prepared = new WeakSet();

  function setup() {
    document.querySelectorAll('#app .section').forEach((section) => {
      if (!/وصل\s*حديث|حديثاً|حديثا/.test(sectionTitle(section))) return;
      const grid = section.nextElementSibling;
      if (!grid || !grid.classList.contains('grid') || prepared.has(grid)) return;
      const cards = [...grid.children].filter((card) => card.matches('.catalog-image-card, .product-card'));
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
      for (let index = 0; index < Math.max(10, cards.length); index += 1) {
        const card = cards[index % cards.length];
        const item = index < cards.length ? card : card.cloneNode(true);
        if (index >= cards.length) { item.setAttribute('aria-hidden', 'true'); item.removeAttribute('id'); }
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
      const duration = Math.max(34, visibleCards.length * 4.2);
      track.style.setProperty('--recent-duration', `${duration}s`);
      const measure = () => {
        const distance = secondSet.getBoundingClientRect().left - firstSet.getBoundingClientRect().left;
        track.style.setProperty('--recent-distance', `${Math.max(0, distance)}px`);
      };
      measure();
      new ResizeObserver(measure).observe(secondSet);
      grid.addEventListener('mouseenter', () => track.classList.add('is-paused'));
      grid.addEventListener('mouseleave', () => track.classList.remove('is-paused'));
      grid.addEventListener('touchstart', () => track.classList.add('is-paused'), { passive: true });
      grid.addEventListener('touchend', () => window.setTimeout(() => track.classList.remove('is-paused'), 1800), { passive: true });
    });
  }

  new MutationObserver(setup).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', setup);
})();
