/* Safe, idempotent brand synchronization for header, splash, favicon and PWA metadata. */
(() => {
  const logoKeys = ['logo_url', 'logoUrl', 'store_logo', 'storeLogo', 'brand_logo', 'brandLogo', 'image_url', 'imageUrl'];
  let lastLogo = '';
  let lastName = '';

  function findLogo() {
    const sources = [window.__alishopSettings, window.storeSettings, window.settings, window.__storeSettings];
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      const value = logoKeys.map((key) => source[key]).find((item) => typeof item === 'string' && item.trim());
      if (value) return value.trim();
    }
    return document.querySelector('.brand-logo img')?.getAttribute('src') || '';
  }

  function setImage(container, logo, name) {
    if (!container || !logo) return;
    const current = container.querySelector('img');
    if (current?.getAttribute('src') === logo) return;
    const image = current || document.createElement('img');
    image.src = logo;
    image.alt = name || 'شعار المتجر';
    if (!current) {
      container.textContent = '';
      container.appendChild(image);
    }
    container.classList.add('has-image');
  }

  function sync() {
    const name = document.querySelector('#storeName')?.textContent?.trim() || '';
    if (name && name !== lastName) {
      const splashName = document.querySelector('#splashName');
      if (splashName) splashName.textContent = name;
      if (document.title !== name) document.title = name;
      lastName = name;
    }

    const logo = findLogo();
    if (!logo || logo === lastLogo) return;
    lastLogo = logo;

    setImage(document.querySelector('#splashLogo'), logo, name);
    setImage(document.querySelector('.brand-logo'), logo, name);

    let favicon = document.querySelector('#dynamicFavicon');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.id = 'dynamicFavicon';
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    if (favicon.getAttribute('href') !== logo) favicon.href = logo;
    // Keep the original manifest URL stable; do not append a potentially huge image URL.
  }

  document.addEventListener('DOMContentLoaded', sync, { once: true });
  window.addEventListener('alishop:branding-updated', sync);
  setTimeout(sync, 1200);
  setTimeout(sync, 3500);
})();
