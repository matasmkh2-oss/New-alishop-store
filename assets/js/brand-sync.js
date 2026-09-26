/* Safe, idempotent brand synchronization for splash, favicon, auth modal, PWA manifest, and page metadata based on manager settings. */
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

    return document.querySelector('#splashLogo img')?.getAttribute('src') || '';
  }

  function findName() {
    const fromSettings = findSetting(nameKeys);
    if (fromSettings) return fromSettings;

    return document.querySelector('#storeName')?.textContent?.trim() || 'علي شوب';
  }

  function setImage(container, logo, name) {
    if (!container) return;

    if (!logo) {
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
  }

  function updateDynamicManifest(name, logo) {
    try {
      let manifestLink = document.querySelector('link[rel="manifest"]');
      if (!manifestLink) return;

      const manifestObj = {
        name: name || 'علي شوب',
        short_name: name || 'علي شوب',
        id: window.location.pathname,
        start_url: window.location.pathname + '#/home',
        scope: window.location.pathname,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f18',
        theme_color: '#11B8B1',
        lang: 'ar',
        dir: 'rtl',
        icons: logo ? [
          { src: logo, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: logo, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ] : [
          { src: './assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        description: 'متجر المنتجات الرقمية وخدمات السوشل ميديا'
      };

      const stringified = JSON.stringify(manifestObj);
      const blob = new Blob([stringified], { type: 'application/json' });
      const manifestUrl = URL.createObjectURL(blob);
      manifestLink.href = manifestUrl;
    } catch (e) {
      console.warn("Dynamic manifest update notice:", e);
    }
  }

  function sync() {
    const settings = getStoredSettings();
    if (settings && window.S?.settings && window.S.settings === settings) {
      try {
        localStorage.setItem('alishop_store_settings', JSON.stringify(settings));
      } catch (e) {}
    }

    const name = findName();
    let nameChanged = false;
    if (name && name !== lastName) {
      nameChanged = true;
      const nameElements = document.querySelectorAll('#storeName, #splashName');
      nameElements.forEach((el) => {
        if (el) el.textContent = name;
      });

      // Update Document Title
      document.title = name;

      // Update Meta Tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', name);

      lastName = name;
    }

    const logo = findLogo();
    let logoChanged = false;
    if (logo !== lastLogo || !lastLogo) {
      logoChanged = true;
      lastLogo = logo;

      // Update splash screen logo and auth modal mark only
      const logoContainers = document.querySelectorAll('#splashLogo, .auth-mark');
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

    if (nameChanged || logoChanged) {
      updateDynamicManifest(name || lastName, logo || lastLogo);
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

  const syncInterval = setInterval(sync, 400);
  setTimeout(() => {
    clearInterval(syncInterval);
    setInterval(sync, 2000);
  }, 10000);
})();
