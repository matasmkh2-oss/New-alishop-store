/* AliShop luxury slider layer: additive, defensive, and reversible. */
(() => {
  const DEFAULT_BUTTON = 'استكشف';
  const DEFAULT_URLS = new Set(['#products', '#/products', 'products']);
  let timer;
  let paused = false;

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const meaningful = (value) => !['', '.', '…', '...', '—', '-'].includes((value || '').replace(/\s+/g, ' ').trim());
  const isDefaultButton = (button) => text(button) === DEFAULT_BUTTON && DEFAULT_URLS.has((button?.getAttribute('href') || '').trim());

  function enhance(root = document) {
    const slides = [...root.querySelectorAll('.hero-slider .slide')];
    if (!slides.length) return;

    slides.forEach((slide, index) => {
      slide.classList.add('luxury-slide');
      slide.style.setProperty('--luxury-index', index);
      const overlay = slide.querySelector('.slide-overlay');
      if (!overlay) return;
      overlay.classList.add('luxury-slide-overlay');
      const storeBadge = overlay.querySelector('.badge');
      if (storeBadge) storeBadge.hidden = true;

      const heading = overlay.querySelector('h1, h2, h3');
      const paragraph = overlay.querySelector('p');
      const button = overlay.querySelector('a.btn, button.btn, a');
      if (heading && !meaningful(text(heading))) heading.hidden = true;
      if (paragraph && !meaningful(text(paragraph))) paragraph.hidden = true;
      if (button && (!meaningful(text(button)) || isDefaultButton(button))) button.hidden = true;
      const hasContent = [heading, paragraph, button].some((element) => element && !element.hidden && meaningful(text(element)));
      overlay.classList.toggle('image-only', !hasContent);
      slide.classList.toggle('image-only-slide', !hasContent);
      slide.querySelector('.slide-shade')?.classList.toggle('hidden', !hasContent);
    });

    const slider = slides[0].closest('.hero-slider');
    if (!slider || slider.dataset.luxuryReady) return;
    slider.dataset.luxuryReady = 'true';
    slider.addEventListener('mouseenter', () => { paused = true; });
    slider.addEventListener('mouseleave', () => { paused = false; });
    slider.addEventListener('touchstart', () => { paused = true; }, { passive: true });
    slider.addEventListener('touchend', () => { setTimeout(() => { paused = false; }, 2200); }, { passive: true });

    if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearInterval(timer);
      timer = setInterval(() => {
        if (paused || document.hidden) return;
        const currentSlides = [...slider.querySelectorAll('.slide')];
        if (currentSlides.length < 2) return;
        const active = currentSlides.findIndex((slide) => slide.classList.contains('active'));
        const next = currentSlides[(active < 0 ? 0 : active + 1) % currentSlides.length];
        if (!next || next === currentSlides[active]) return;
        currentSlides.forEach((slide) => slide.classList.remove('leaving'));
        if (currentSlides[active]) currentSlides[active].classList.add('leaving');
        currentSlides.forEach((slide) => slide.classList.remove('active'));
        next.classList.add('active');
        const dots = [...slider.querySelectorAll('.dots button, .dot')];
        dots.forEach((dot, i) => dot.classList.toggle('active', i === (active + 1) % currentSlides.length));
      }, 6000);
    }
  }

  const observer = new MutationObserver(() => enhance());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('hashchange', () => setTimeout(enhance, 120));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhance(), { once: true });
  } else {
    enhance();
  }
})();
