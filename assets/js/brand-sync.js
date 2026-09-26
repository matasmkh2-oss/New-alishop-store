/* Safe, idempotent brand synchronization for header, splash, favicon, auth modal, and PWA metadata based on manager settings. */
(() => {
  const logoKeys = ['logo_url', 'logoUrl', 'store_logo', 'storeLogo', 'brand_logo', 'brandLogo', 'image_url', 'imageUrl'];
  const nameKeys = ['store_name', 'storeName', 'site_name', 'siteName', 'brand_name', 'brandName', 'name'];

  let lastLogo = '';
  let lastName = '';

  function getStoredSettings() {
    const sources = [
      window.S?.settings,
      window.__alishopSettings,
      window.storeSettings,
      window.settings,
      window.__storeSettings
    ];

    for (const src of sources) {
      if (src && typeof src === 'object' && Object.keys(src).length > 0) return src;
    }

    try {
      const cached = localStorage.getItem('alishop_store_settings') || localStorage.getItem('alishop_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      // Ignore JSON parse error
    }

    return null;
  }

  function findSetting(keys) {
    const settings = getStoredSettings();
    if (!settings) return '';

    for (const key of keys) {
      const val = settings[key];
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
    return '';
  }

  function findLogo() {
    const fromSettings = findSetting(logoKeys);
    if (fromSettings) return fromSettings;

    // Fallback check DOM if image already set
    return document.querySelector('.brand-logo img, #splashLogo img')?.getAttribute('src') || '';
  }

  function findName() {
    const fromSettings = findSetting(nameKeys);
    if (fromSettings) return fromSettings;

    // Fallback check DOM
    return document.querySelector('#storeName')?.textContent?.trim() || 'علي شوب';
  }

  function setImage(container, logo, name) {
    if (!container) return;

    if (!logo) {
      // Show first character of store name if no logo image uploaded
      const firstChar = (name && name.trim()) ? name.trim().charAt(0) : 'A';
      if (!container.querySelector('img')) {
        container.textContent = firstChar;
      }
      container.classList.remove('has-image');
      return;
    }

    const current = container.querySelector('img');
    if (current?.getAttribute('src') === logo) return;

    const image = current || document.createElement('img');
    image.src = logo;
    image.alt = name || 'شعار المتجر';
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'cover';
    image.style.borderRadius = 'inherit';

    if (!current) {
      container.textContent = '';
      container.appendChild(image);
    }
    container.classList.add('has-image');
    container.classList.remove('hidden');
  }

  function sync() {
    const settings = getStoredSettings();
    if (settings && window.S?.settings && window.S.settings === settings) {
      try {
        localStorage.setItem('alishop_store_settings', JSON.stringify(settings));
      } catch (e) {}
    }

    const name = findName();
    if (name && name !== lastName) {
      // Update all name elements
      const nameElements = document.querySelectorAll('#storeName, #splashName, .store-name-text, .brand-title-text, .app-bar-store-name, .top-bar-title');
      nameElements.forEach((el) => {
        if (el) el.textContent = name;
      });

      // Update Document Title
      if (name !== 'علي شوب' && (!document.title || document.title.includes('علي شوب'))) {
        document.title = document.title.replace(/علي شوب/g, name);
      } else if (!document.title) {
        document.title = name;
      }

      // Update Meta Tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', name);

      lastName = name;
    }

    const logo = findLogo();
    if (logo !== lastLogo || !lastLogo) {
      lastLogo = logo;

      // Update all logo elements (splash, brand header, auth modal mark, etc.)
      const logoContainers = document.querySelectorAll('#splashLogo, .brand-logo, #storeLogo, .auth-mark, .header-brand-logo, .app-brand-logo, .top-bar-logo');
      logoContainers.forEach((container) => {
        setImage(container, logo, name || lastName);
      });

      if (logo) {
        // Dynamic Favicon
        let favicon = document.querySelector('#dynamicFavicon');
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.id = 'dynamicFavicon';
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        if (favicon.getAttribute('href') !== logo) favicon.href = logo;

        // Apple Touch Icon
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon && appleIcon.getAttribute('href') !== logo) {
          appleIcon.href = logo;
        }
      }
    }
  }

  async function fetchStoreSettingsFromSupabase() {
    try {
      const url = "https://jcnbbingctwuathvfqty.supabase.co/rest/v1/store_settings?select=*&limit=1";
      const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbmJiaW5nY3R3dWF0aHZmcXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzg3NTUsImV4cCI6MjEwMTM1NDc1NX0.jQY17YOKCYD9g5O04WX6RuqQkHJx_NyGUzEWc_Rh8s4";
      const res = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0]) {
          const settings = data[0];
          if (window.S) window.S.settings = settings;
          localStorage.setItem('alishop_store_settings', JSON.stringify(settings));
          sync();
        }
      }
    } catch (e) {
      console.warn("Brand sync fetch notice:", e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    sync();
    fetchStoreSettingsFromSupabase();
  }, { once: true });

  window.addEventListener('alishop:branding-updated', () => {
    fetchStoreSettingsFromSupabase();
    sync();
  });
  window.addEventListener('storage', sync);

  fetchStoreSettingsFromSupabase();

  // Interval checks to handle async Supabase settings loading instantly
  const syncInterval = setInterval(sync, 400);
  setTimeout(() => {
    clearInterval(syncInterval);
    setInterval(sync, 2000);
  }, 10000);
})();
