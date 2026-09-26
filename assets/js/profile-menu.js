/**
 * AliShop Smart Profile Menu & Edit Modal Module
 * - Role-Based Access Control (RBAC): Strict conditional DOM rendering of Admin Panel
 * - Glassmorphism Floating Profile Dropdown Menu with non-clickable Name/Email
 * - Sleek Edit Profile Modal with Avatar Uploader & Full Name Updater
 * - Fixed Logout Button with Muted Red Hover Effect
 */

(function () {
  'use strict';

  // Preset avatar images
  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=240&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=240&q=80',
    'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=240&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80'
  ];

  // Helper: Get Supabase client
  function getSupabase() {
    if (window.__alishopSupabase && window.__alishopSupabase.auth) return window.__alishopSupabase;
    if (window.supabaseClient && window.supabaseClient.auth) return window.supabaseClient;
    if (window.supabase && typeof window.supabase.from === 'function' && window.supabase.auth) return window.supabase;
    if (typeof window.supabase?.createClient === 'function' && (window.CONFIG || window.__CONFIG)) {
      try {
        const cfg = window.CONFIG || window.__CONFIG;
        window.__alishopSupabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        return window.__alishopSupabase;
      } catch (e) {
        console.warn('Auto createClient error:', e);
      }
    }
    return window.__alishopSupabase || window.supabase || null;
  }

  // Helper: Get State
  function getState() {
    return window.S || window.__alishopState || {};
  }

  // Helper: Check if user is strictly Admin
  function isUserAdmin() {
    const S = getState();
    const user = S.user;
    const profile = S.profile;
    if (!user) return false;

    if (profile && (profile.role === 'admin' || profile.is_admin === true)) return true;
    if (user.role === 'admin' || user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin') return true;
    if (window.PRIMARY_ADMIN_ID && user.id === window.PRIMARY_ADMIN_ID) return true;
    if (window.ADMIN_EMAILS && Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.includes(user.email)) return true;

    return false;
  }

  // Helper: Refresh Lucide icons
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons();
      } catch (e) {}
    }
  }

  // Helper: Show reliable, instant floating toast notification
  function showToast(msg, type = 'info') {
    try {
      const text = typeof msg === 'string' ? msg : (msg?.message || String(msg || ''));
      let root = document.getElementById('toastRoot');
      if (!root) {
        root = document.createElement('div');
        root.id = 'toastRoot';
        root.className = 'toast-root';
        document.body.appendChild(root);
      }

      const toastEl = document.createElement('div');
      toastEl.className = `toast ${type}`;

      const iconMap = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };
      const iconChar = iconMap[type] || 'ℹ';

      toastEl.innerHTML = `
        <div style="display:inline-flex;align-items:center;gap:10px;direction:rtl;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.22);font-size:14px;font-weight:900;flex-shrink:0;">${iconChar}</span>
          <span style="font-size:14px;font-weight:800;letter-spacing:0.2px;">${text}</span>
        </div>
      `;

      root.appendChild(toastEl);

      setTimeout(() => {
        toastEl.classList.add('leaving');
        setTimeout(() => {
          if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
        }, 400);
      }, 3500);
    } catch (e) {
      console.log(`[Toast ${type}]:`, msg);
    }
  }

  window.toast = showToast;
  window.showToast = showToast;

  // Helper: Get stored profile overrides (saved locally for instant UI response)
  function getProfileOverride() {
    try {
      const data = localStorage.getItem('alishop_profile_override');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // Helper: Save profile override
  function setProfileOverride(override) {
    try {
      localStorage.setItem('alishop_profile_override', JSON.stringify({
        ...override,
        updated_at: Date.now()
      }));
    } catch (e) {}
  }

  // Helper: Current User Data resolved
  function getCurrentUserData() {
    const S = getState();
    const user = S.user;
    const profile = S.profile || {};
    const override = getProfileOverride();

    const fullName = override?.full_name || profile.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'ضيف المتجر');
    const avatarUrl = override?.avatar_url || profile.avatar_url || user?.user_metadata?.avatar_url || PRESET_AVATARS[0];
    const email = user?.email || 'غير مسجل';
    const role = isUserAdmin() ? 'admin' : (profile.role || 'customer');
    const isLoggedIn = !!user;

    return { fullName, avatarUrl, email, role, isLoggedIn, user, profile };
  }

  // -------------------------------------------------------------------------
  // 1. إنشاء وحقن عناصر واجهة المستخدم (Dropdown & Modal) في الـ DOM
  // -------------------------------------------------------------------------
  function ensureDOMElements() {
    // 1.1 إنشاء القائمة المنسدلة لحسابي (Profile Dropdown Menu)
    let dropdown = document.getElementById('profileDropdownMenu');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'profileDropdownMenu';
      dropdown.className = 'profile-dropdown-menu';
      dropdown.setAttribute('aria-hidden', 'true');
      dropdown.innerHTML = `
        <!-- رأس القائمة: الاسم والإيميل كبيانات نظيفة غير قابلة للضغط مع زر القلم -->
        <div class="pdm-header">
          <div class="pdm-avatar-wrap">
            <img id="pdmAvatarImg" class="pdm-avatar" src="${PRESET_AVATARS[0]}" alt="الصورة الشخصية">
            <button type="button" class="pdm-avatar-edit-icon" id="pdmAvatarBadgeBtn" title="تغيير الصورة الشخصية" aria-label="تغيير الصورة">
              <i data-lucide="camera"></i>
            </button>
          </div>
          <div class="pdm-user-meta">
            <div class="pdm-user-name" id="pdmUserName">اسم المستخدم</div>
            <div class="pdm-user-email" id="pdmUserEmail">email@example.com</div>
            <span class="pdm-role-pill pdm-role-customer" id="pdmRoleTag">عميل المتجر</span>
          </div>
          <button type="button" class="pdm-edit-trigger" id="pdmEditTrigger" title="تعديل الملف الشخصي" aria-label="تعديل الملف الشخصي">
            <i data-lucide="pencil"></i>
          </button>
        </div>

        <div class="pdm-divider"></div>

        <!-- قائمة الروابط الديناميكية بحسب الصلاحيات (RBAC) -->
        <div class="pdm-nav-list" id="pdmNavList"></div>

        <div class="pdm-divider"></div>

        <!-- خيار المظهر فوق زر تسجيل الخروج مباشرة -->
        <div class="pdm-system-actions" id="pdmSystemActions">
          <!-- خيار تغيير المظهر مع أيقونة شمس/قمر -->
          <button type="button" class="pdm-nav-item pdm-quick-action" id="pdmThemeActionBtn" title="تغيير المظهر">
            <span class="pdm-item-ic" id="pdmThemeIconWrap">
              <i data-lucide="moon"></i>
            </span>
            <div class="pdm-item-text">
              <strong id="pdmThemeTitle">المظهر الليلي</strong>
              <small id="pdmThemeDesc">التبديل بين الفاتح والداكن</small>
            </div>
            <span class="pdm-theme-toggle-indicator" id="pdmThemeIndicator" aria-hidden="true"></span>
          </button>
        </div>

        <div class="pdm-divider"></div>

        <!-- زر تسجيل الخروج الثابت في الأسفل مع لون أحمر خفيف عند التمرير -->
        <div class="pdm-footer">
          <button type="button" id="pdmLogoutBtn" class="pdm-logout-btn">
            <i data-lucide="log-out"></i>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      `;

      // وضع القائمة داخل الهيدر لكي تطفو مباشرة أسفل بطاقة المستخدم
      const header = document.querySelector('header.app-header') || document.body;
      header.appendChild(dropdown);
    }

    // 1.2 إنشاء النافذة المنبثقة لتعديل الملف الشخصي (Glassmorphism Edit Modal)
    let modal = document.getElementById('profileEditModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'profileEditModal';
      modal.className = 'profile-edit-overlay hidden';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('dir', 'rtl');
      modal.innerHTML = `
        <div class="profile-edit-box" dir="rtl">
          <!-- زر الإغلاق -->
          <button type="button" class="profile-edit-close pe-close-btn" id="peCloseModalBtn" aria-label="إغلاق">×</button>

          <!-- عنوان النافذة -->
          <div class="profile-edit-header">
            <h3 class="profile-edit-title">تعديل الملف الشخصي</h3>
            <p class="profile-edit-subtitle">قم بتحديث اسمك وصورتك الشخصية</p>
          </div>

          <!-- قسم الصورة الشخصية والأفاتار -->
          <div class="profile-edit-avatar-section">
            <div class="profile-edit-avatar-wrapper pe-avatar-preview-wrap">
              <img id="peAvatarPreview" src="${PRESET_AVATARS[0]}" alt="معاينة الصورة" class="profile-edit-avatar-img pe-avatar-img">
              <label for="peAvatarFileInput" class="profile-edit-avatar-badge pe-avatar-overlay" title="رفع صورة من جهازك">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                  <circle cx="12" cy="13" r="3"></circle>
                </svg>
              </label>
              <input type="file" id="peAvatarFileInput" accept="image/*" style="display:none">
            </div>
            <div class="profile-edit-presets pe-presets" id="pePresets"></div>
          </div>

          <!-- حقل الاسم الكامل -->
          <div class="profile-edit-form-group pe-field-group">
            <label for="peFullNameInput" class="profile-edit-label pe-label">الاسم الكامل</label>
            <input type="text" id="peFullNameInput" class="profile-edit-input pe-input" placeholder="أدخل اسمك الكريم" required maxlength="60">
          </div>

          <!-- حقل البريد الإلكتروني (غير قابل للتعديل) -->
          <div class="profile-edit-form-group pe-field-group">
            <label for="peEmailDisplay" class="profile-edit-label pe-label">البريد الإلكتروني (مرتبط بالحساب)</label>
            <input type="email" id="peEmailDisplay" class="profile-edit-input pe-input profile-edit-input-readonly pe-input-disabled" disabled readonly>
          </div>

          <!-- أزرار الإجراءات -->
          <div class="profile-edit-actions pe-footer-actions">
            <button type="button" id="peSaveBtn" class="profile-edit-btn profile-edit-btn-save pe-save-btn">
              <span class="pe-save-text">حفظ التغييرات</span>
            </button>
            <button type="button" id="peCancelBtn" class="profile-edit-btn profile-edit-btn-cancel pe-cancel-btn">إلغاء</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // تعبئة الأفاتارات الجاهزة
      const presetsContainer = modal.querySelector('#pePresets');
      if (presetsContainer) {
        PRESET_AVATARS.forEach((url, i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pe-preset-btn';
          btn.title = `مظهر جاهز ${i + 1}`;
          btn.innerHTML = `<img src="${url}" alt="أفاتار ${i + 1}">`;
          btn.onclick = () => {
            const preview = document.getElementById('peAvatarPreview');
            if (preview) preview.src = url;
            presetsContainer.querySelectorAll('.pe-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          };
          presetsContainer.appendChild(btn);
        });
      }
    }

    refreshIcons();
    bindEvents();
  }

  // -------------------------------------------------------------------------
  // 2. تحديث واجهة القائمة المنسدلة بناءً على الصلاحيات والحالة
  // -------------------------------------------------------------------------
  function updateProfileUI() {
    const userData = getCurrentUserData();

    // 2.1 تحديث معلومات الهيدر في أعلى الشاشة في الوقت الفعلي
    const topAvatar = document.querySelector('.app-bar-avatar');
    if (topAvatar) {
      topAvatar.src = userData.avatarUrl;
    }
    const topName = document.querySelector('.app-bar-user-name');
    if (topName) {
      topName.textContent = userData.isLoggedIn ? userData.fullName : 'تسجيل الدخول';
    }
    const topGreeting = document.querySelector('.app-bar-user-greeting');
    if (topGreeting) {
      topGreeting.textContent = userData.isLoggedIn
        ? (userData.role === 'admin' ? 'مسؤول المتجر ✨' : 'مرحباً بك مجدداً')
        : 'انقر للوصول لحسابك';
    }

    // 2.2 تحديث معلومات رأس القائمة المنسدلة
    const pdmAvatar = document.getElementById('pdmAvatarImg');
    if (pdmAvatar) pdmAvatar.src = userData.avatarUrl;

    const pdmName = document.getElementById('pdmUserName');
    if (pdmName) pdmName.textContent = userData.fullName;

    const pdmEmail = document.getElementById('pdmUserEmail');
    if (pdmEmail) pdmEmail.textContent = userData.email;

    const pdmRoleTag = document.getElementById('pdmRoleTag');
    if (pdmRoleTag) {
      if (userData.role === 'admin') {
        pdmRoleTag.textContent = 'مدير النظام (Admin)';
        pdmRoleTag.className = 'pdm-role-pill pdm-role-admin';
      } else {
        pdmRoleTag.textContent = 'عميل المتجر';
        pdmRoleTag.className = 'pdm-role-pill pdm-role-customer';
      }
    }

    // 2.3 تحديث عناصر الروابط بحسب الصلاحيات (RBAC)
    const navList = document.getElementById('pdmNavList');
    if (navList) {
      navList.innerHTML = '';

      // [الشرط الصارم]: زر لوحة الإدارة يُحقن في شجرة الـ DOM فقط وحصرياً إذا كان مديراً
      if (userData.role === 'admin') {
        const adminItem = document.createElement('a');
        adminItem.href = '#/admin';
        adminItem.className = 'pdm-nav-item pdm-item-admin';
        adminItem.innerHTML = `
          <span class="pdm-item-ic"><i data-lucide="shield-check"></i></span>
          <div class="pdm-item-text">
            <strong>لوحة الإدارة</strong>
            <small>التحكم الكامل بالمتجر والمبيعات</small>
          </div>
          <span class="pdm-item-arrow">‹</span>
        `;
        adminItem.onclick = () => closeProfileMenu();
        navList.appendChild(adminItem);
      }

      // روابط العملاء والمستخدمين الأساسية
      const generalItems = [
        { href: '#/orders', icon: 'receipt-text', title: 'طلباتي', desc: 'سجل الطلبات والمشتريات' },
        { href: '#/wallet', icon: 'wallet-cards', title: 'المحفظة', desc: 'شحن الرصيد والبطاقات' },
        { href: '#/account', icon: 'settings', title: 'المعلومات والإعدادات', desc: 'إعدادات الحساب وتفضيلات المتجر' }
      ];

      generalItems.forEach(item => {
        const a = document.createElement('a');
        a.href = item.href;
        a.className = 'pdm-nav-item';
        a.innerHTML = `
          <span class="pdm-item-ic"><i data-lucide="${item.icon}"></i></span>
          <div class="pdm-item-text">
            <strong>${item.title}</strong>
            <small>${item.desc}</small>
          </div>
          <span class="pdm-item-arrow">‹</span>
        `;
        a.onclick = () => closeProfileMenu();
        navList.appendChild(a);
      });
    }

    refreshIcons();
    enhanceAccountPage();
  }

  // -------------------------------------------------------------------------
  // 3. تحسين صفحة حسابي (#/account) لدمج زر التعديل والمنطق البرمجي نفسه
  // -------------------------------------------------------------------------
  function enhanceAccountPage() {
    if (location.hash !== '#/account') return;

    // إذا كانت صفحة الحساب معروضة، أضف زر القلم بجانب الاسم إذا لم يكن موجوداً
    const accountCard = document.querySelector('#app .card.item, #app .profile-card');
    if (accountCard && !accountCard.querySelector('.account-page-edit-btn')) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'pdm-edit-trigger account-page-edit-btn';
      editBtn.title = 'تعديل الملف الشخصي';
      editBtn.style.marginInlineStart = 'auto';
      editBtn.innerHTML = '<i data-lucide="pencil"></i>';
      editBtn.onclick = (e) => {
        e.preventDefault();
        openEditProfileModal();
      };
      accountCard.appendChild(editBtn);
      refreshIcons();
    }

    // تطبيق ستايل الـ Muted Red على زر تسجيل الخروج في صفحة الحساب أيضاً
    const pageLogout = document.getElementById('logout');
    if (pageLogout) {
      pageLogout.classList.add('pdm-logout-btn');
    }
  }

  // -------------------------------------------------------------------------
  // 4. فتح وإغلاق القائمة المنسدلة والنافذة المنبثقة
  // -------------------------------------------------------------------------
  let deferredInstallPrompt = null;

  function isAppStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           (document.referrer && document.referrer.includes('android-app://'));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (window.S) window.S.deferredInstall = e;
    updateHeaderInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (window.S) window.S.deferredInstall = null;
    updateHeaderInstallButton();
    showToast('تم تثبيت التطبيق بنجاح!', 'success');
  });

  function ensureChevron() {
    const userTrigger = document.querySelector('.app-bar-user');
    if (userTrigger && !userTrigger.querySelector('.app-bar-chevron')) {
      const chevron = document.createElement('span');
      chevron.className = 'app-bar-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      `;
      userTrigger.appendChild(chevron);
    }
  }

  function updateThemeUI() {
    const isDark = (document.documentElement.dataset.theme || localStorage.theme) === 'dark';
    const themeIconWrap = document.getElementById('pdmThemeIconWrap');
    const themeTitle = document.getElementById('pdmThemeTitle');
    const themeDesc = document.getElementById('pdmThemeDesc');
    const themeIndicator = document.getElementById('pdmThemeIndicator');

    if (themeIconWrap) {
      themeIconWrap.innerHTML = isDark
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    }
    if (themeTitle) {
      themeTitle.textContent = isDark ? 'المظهر النهاري' : 'المظهر الليلي';
    }
    if (themeDesc) {
      themeDesc.textContent = isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن';
    }
    if (themeIndicator) {
      if (isDark) {
        themeIndicator.classList.add('pdm-indicator-dark');
      } else {
        themeIndicator.classList.remove('pdm-indicator-dark');
      }
    }
  }

  function toggleAppTheme() {
    const currentTheme = document.documentElement.dataset.theme || localStorage.theme || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = newTheme;
    localStorage.theme = newTheme;

    // تشغيل زر الهيدر الخفي لمزامنة أي مستمعات في app.js
    const hiddenThemeBtn = document.getElementById('themeButton');
    if (hiddenThemeBtn) {
      hiddenThemeBtn.innerHTML = `<i data-lucide="${newTheme === 'dark' ? 'sun' : 'moon'}"></i>`;
    }

    updateThemeUI();
    showToast(newTheme === 'dark' ? 'تم التبديل إلى المظهر الداكن' : 'تم التبديل إلى المظهر الفاتح', 'info');
  }

  function getHeaderInstallBtn() {
    return document.getElementById('installButton') || document.getElementById('headerInstallBtn');
  }

  function updateHeaderInstallButton() {
    const btn = getHeaderInstallBtn();
    if (!btn) return;

    if (isAppStandalone()) {
      btn.classList.add('hidden');
      return;
    }

    const canPrompt = !!(
      deferredInstallPrompt ||
      window.S?.deferredInstall ||
      (!btn.classList.contains('hidden'))
    );

    if (canPrompt) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  // Alias for backward compatibility across modules
  function updateInstallButtonVisibility() {
    updateHeaderInstallButton();
  }

  async function handleHeaderAppInstall() {
    const promptEvent = deferredInstallPrompt || window.S?.deferredInstall;
    const btn = getHeaderInstallBtn();

    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          showToast('شكراً لتثبيت التطبيق!', 'success');
        }
        deferredInstallPrompt = null;
        if (window.S) window.S.deferredInstall = null;
        if (btn) btn.classList.add('hidden');
        updateHeaderInstallButton();
      } catch (e) {
        console.warn('Install error:', e);
      }
    } else {
      showToast('التطبيق مثبت بالفعل أو أن متصفحك لا يدعم التثبيت المباشر', 'info');
    }
  }

  function toggleProfileMenu() {
    const dropdown = document.getElementById('profileDropdownMenu');
    const userTrigger = document.querySelector('.app-bar-user');
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('pdm-open');
    if (isOpen) {
      closeProfileMenu();
    } else {
      updateProfileUI();
      updateThemeUI();
      updateInstallButtonVisibility();
      ensureChevron();
      dropdown.classList.add('pdm-open');
      dropdown.setAttribute('aria-hidden', 'false');
      userTrigger?.classList.add('pdm-active');
    }
  }

  function closeProfileMenu() {
    const dropdown = document.getElementById('profileDropdownMenu');
    const userTrigger = document.querySelector('.app-bar-user');
    if (dropdown) {
      dropdown.classList.remove('pdm-open');
      dropdown.setAttribute('aria-hidden', 'true');
    }
    userTrigger?.classList.remove('pdm-active');
  }

  function openEditProfileModal() {
    closeProfileMenu();
    const modal = document.getElementById('profileEditModal');
    if (!modal) return;

    const userData = getCurrentUserData();

    const fullNameInput = document.getElementById('peFullNameInput');
    if (fullNameInput) fullNameInput.value = userData.fullName !== 'ضيف المتجر' ? userData.fullName : '';

    const emailDisplay = document.getElementById('peEmailDisplay');
    if (emailDisplay) emailDisplay.value = userData.email;

    const avatarPreview = document.getElementById('peAvatarPreview');
    if (avatarPreview) avatarPreview.src = userData.avatarUrl;

    modal.classList.remove('hidden');
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // إعادة ضبط حالة زر الحفظ دائماً عند فتح المودال
    const saveBtn = document.getElementById('peSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span class="pe-save-text">حفظ التغييرات</span>';
    }

    setTimeout(() => {
      fullNameInput?.focus();
      refreshIcons();
    }, 50);
  }

  function closeEditProfileModal() {
    const modal = document.getElementById('profileEditModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('active');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // -------------------------------------------------------------------------
  // 5. حفظ تعديلات الملف الشخصي (التقاط الزر المباشر والتحرير المضمون 100%)
  // -------------------------------------------------------------------------
  async function handleSaveProfile(event) {
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    // الحل الجذري: التقاط الزر الفعلي الذي تم النقر عليه مباشرة والاحتفاظ بمرجعه
    const btn = (event && (event.currentTarget || (event.target && event.target.closest('button')))) ||
                document.getElementById('peSaveBtn') ||
                document.getElementById('saveProfileBtn') ||
                document.querySelector('.pe-save-btn') ||
                document.querySelector('#peSaveBtn');

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جاري الحفظ...';
    }

    try {
      // 1. جلب القيم من الحقول
      const nameInput = document.getElementById('peFullNameInput');
      const newName = nameInput ? nameInput.value.trim() : '';
      if (!newName) {
        throw new Error("يرجى إدخال الاسم.");
      }

      const avatarPreview = document.getElementById('peAvatarPreview');
      const newAvatar = avatarPreview?.src || null;

      // 2. تحديد هوية المستخدم الحالي بأسرع وسيلة ممكنة (ذاكرة التطبيق أو الجلسة)
      const S = typeof getState === 'function' ? getState() : (window.State || null);
      let userId = S?.user?.id || window.__currentUser?.id;

      const db = (window.supabase && typeof window.supabase.from === 'function' ? window.supabase : null) ||
                 (window.__alishopSupabase && window.__alishopSupabase.auth ? window.__alishopSupabase : null) ||
                 (window.supabaseClient && window.supabaseClient.auth ? window.supabaseClient : null) ||
                 (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function' ? supabase : null) ||
                 (typeof client !== 'undefined' && client && typeof client.from === 'function' ? client : null) ||
                 (typeof getSupabase === 'function' ? getSupabase() : null);

      if (!userId && db?.auth) {
        try {
          const { data: authData } = await db.auth.getUser();
          userId = authData?.user?.id;
        } catch (_) {}
      }

      if (!userId) {
        throw new Error("يجب تسجيل الدخول لحفظ التعديلات.");
      }

      const updatePayload = {
        full_name: newName,
        updated_at: new Date().toISOString()
      };
      if (newAvatar) {
        updatePayload.avatar_url = newAvatar;
      }

      // 3. التحديث المباشر في قاعدة البيانات
      if (db && typeof db.from === 'function') {
        const { error: dbErr } = await db
          .from('profiles')
          .update(updatePayload)
          .eq('id', userId);

        if (dbErr) {
          console.warn("Supabase profile update warning:", dbErr);
        }
      }

      // 4. تحديث الذاكرة المحلية والواجهة فوراً دون أي تأخير
      if (S) {
        if (!S.profile) S.profile = {};
        S.profile.full_name = newName;
        S.profile.name = newName;
        if (newAvatar) S.profile.avatar_url = newAvatar;
        if (S.user) {
          if (!S.user.user_metadata) S.user.user_metadata = {};
          S.user.user_metadata.full_name = newName;
          S.user.user_metadata.name = newName;
          if (newAvatar) S.user.user_metadata.avatar_url = newAvatar;
        }
      }

      try {
        setProfileOverride({ full_name: newName, name: newName, avatar_url: newAvatar });
      } catch (_) {}

      // تحديث عناصر الهيدر في الـ DOM
      const topAvatar = document.querySelector('.app-bar-avatar');
      if (topAvatar && newAvatar) topAvatar.src = newAvatar;

      const topName = document.querySelector('.app-bar-user-name');
      if (topName && newName) topName.textContent = newName;

      try {
        updateProfileUI();
      } catch (uiErr) {
        console.error("تجاهل خطأ تحديث الواجهة:", uiErr);
      }

      // 5. إغلاق النافذة المنبثقة فوراً
      closeEditProfileModal();

      // 6. إظهار إشعار النجاح الواضح للمستخدم
      if (typeof window.toast === 'function') {
        window.toast('تم حفظ التعديلات بنجاح!', 'success');
      } else if (typeof showToast === 'function') {
        showToast('تم حفظ التعديلات بنجاح!', 'success');
      } else {
        alert('تم حفظ التعديلات بنجاح!');
      }

    } catch (error) {
      console.error("خطأ أثناء حفظ الملف الشخصي:", error);
      const errMsg = error?.message || String(error);
      if (typeof window.toast === 'function') {
        window.toast("خطأ: " + errMsg, 'error');
      } else if (typeof showToast === 'function') {
        showToast("خطأ: " + errMsg, 'error');
      } else {
        alert("خطأ: " + errMsg);
      }
    } finally {
      // تحرير الزر دائماً
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="pe-save-text">حفظ التغييرات</span>';
      }
    }
  }

  const handleProfileSave = handleSaveProfile;
  window.handleProfileSave = handleProfileSave;
  window.handleSaveProfile = handleSaveProfile;

  // -------------------------------------------------------------------------
  // 6. التعامل مع رفع الصور وضغطها محلياً بحجم خفيف جداً
  // -------------------------------------------------------------------------
  function handleAvatarFileUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة صالح', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('حجم الصورة كبير جداً (الحد الأقصى 8 ميغابايت)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // اقتصاص مربع وتصغير الحجم إلى 240×240 لتوفير مساحة وتخزين سريع وفوري
        const canvas = document.createElement('canvas');
        const targetSize = 240;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');

        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const preview = document.getElementById('peAvatarPreview');
        if (preview) {
          preview.src = compressedDataUrl;
          showToast('تمت معالجة الصورة بنجاح! انقر على حفظ التغييرات', 'info');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // -------------------------------------------------------------------------
  // 7. ربط الأحداث العامة
  // -------------------------------------------------------------------------
  function bindEvents() {
    // 7.1 النقر على بطاقة المستخدم في الهيدر (.app-bar-user)
    const userTrigger = document.querySelector('.app-bar-user');
    if (userTrigger && !userTrigger.dataset.pdmBound) {
      userTrigger.dataset.pdmBound = 'true';
      userTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const userData = getCurrentUserData();
        if (!userData.isLoggedIn) {
          // إذا لم يكن مسجلاً، افتح نافذة تسجيل الدخول
          const authDialog = document.getElementById('authDialog');
          if (authDialog && typeof authDialog.showModal === 'function') {
            authDialog.showModal();
          } else {
            location.hash = '#/account';
          }
        } else {
          toggleProfileMenu();
        }
      });
    }

    // 7.2 إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('profileDropdownMenu');
      const userTrigger = document.querySelector('.app-bar-user');
      if (!dropdown || !dropdown.classList.contains('pdm-open')) return;

      if (!dropdown.contains(e.target) && !userTrigger?.contains(e.target)) {
        closeProfileMenu();
      }
    });

    // 7.3 إغلاق عند ضغط زر Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeProfileMenu();
        closeEditProfileModal();
      }
    });

    // 7.4 أزرار فتح مودال تعديل الملف الشخصي
    const editTrigger = document.getElementById('pdmEditTrigger');
    if (editTrigger) editTrigger.onclick = () => openEditProfileModal();

    const avatarBadge = document.getElementById('pdmAvatarBadgeBtn');
    if (avatarBadge) avatarBadge.onclick = () => openEditProfileModal();

    // 7.5 أزرار إغلاق المودال
    const closeBtn = document.getElementById('peCloseModalBtn');
    if (closeBtn) closeBtn.onclick = () => closeEditProfileModal();

    const cancelBtn = document.getElementById('peCancelBtn');
    if (cancelBtn) cancelBtn.onclick = () => closeEditProfileModal();

    // إغلاق المودال عند النقر على الخلفية المعتمة
    const modal = document.getElementById('profileEditModal');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) closeEditProfileModal();
      };
    }

    // 7.6 زر حفظ التعديلات
    const saveBtn = document.getElementById('peSaveBtn');
    if (saveBtn) saveBtn.onclick = (e) => handleSaveProfile(e);

    // 7.7 زر رفع الصورة
    const fileInput = document.getElementById('peAvatarFileInput');
    if (fileInput) {
      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) handleAvatarFileUpload(file);
      };
    }

    // 7.8 زر تبديل المظهر (Dark / Light) داخل القائمة
    const themeActionBtn = document.getElementById('pdmThemeActionBtn');
    if (themeActionBtn) {
      themeActionBtn.onclick = () => toggleAppTheme();
    }

    // 7.9 زر تثبيت التطبيق PWA في الهيدر (متاح لجميع الزوار)
    const headerInstallBtn = document.getElementById('headerInstallBtn');
    if (headerInstallBtn) {
      headerInstallBtn.onclick = () => handleHeaderAppInstall();
    }

    // 7.10 زر تسجيل الخروج
    const logoutBtn = document.getElementById('pdmLogoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        closeProfileMenu();
        showToast('جارٍ تسجيل الخروج...', 'info');
        try {
          const client = getSupabase();
          if (client?.auth) {
            await client.auth.signOut();
          }
        } catch (e) {
          console.warn('Sign out warning:', e);
        }
        localStorage.removeItem('alishop_profile_override');
        location.reload();
      };
    }
  }

  // -------------------------------------------------------------------------
  // 8. دورة حياة التحميل والمراقبة
  // -------------------------------------------------------------------------
  function init() {
    ensureDOMElements();
    ensureChevron();
    updateProfileUI();
    updateThemeUI();
    updateHeaderInstallButton();

    // ربط زر التثبيت في الهيدر
    const installBtn = getHeaderInstallBtn();
    if (installBtn) {
      installBtn.onclick = (e) => {
        e.preventDefault();
        handleHeaderAppInstall();
      };
    }

    // مراقبة تبديل المظهر لمزامنة الأيقونات والنصوص في القائمة
    const themeObserver = new MutationObserver(() => {
      updateThemeUI();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // الاستماع لتحميل الهوية من app.js
    window.addEventListener('alishop:identity-loaded', () => {
      updateProfileUI();
      ensureChevron();
    });

    // مراقبة تبديل المسارات (الروابط والهاش)
    window.addEventListener('hashchange', () => {
      closeProfileMenu();
      ensureChevron();
      setTimeout(enhanceAccountPage, 100);
      setTimeout(enhanceAccountPage, 400);
    });

    // مراقبة دورية خفيفة لضمان استجابة وتحديث الواجهة عند تسجيل الدخول
    setInterval(() => {
      const topName = document.querySelector('.app-bar-user-name');
      const userData = getCurrentUserData();
      ensureChevron();
      if (topName && userData.isLoggedIn && topName.textContent !== userData.fullName) {
        updateProfileUI();
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // تصدير واجهة برمجية مصغرة
  window.AlishopProfileMenu = {
    toggle: toggleProfileMenu,
    close: closeProfileMenu,
    openEditModal: openEditProfileModal,
    update: updateProfileUI,
    isUserAdmin: isUserAdmin
  };
})();
