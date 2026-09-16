/* Live notifications: realtime badge refresh, in-app sound, and optional browser notification. */
(() => {
  let channel;
  let audioContext;
  let lastSeen = new Set();
  let initialized = false;

  const $ = (selector) => document.querySelector(selector);
  const currentUserId = () => window.__alishopUser?.id || window.currentUser?.id || window.__user?.id || window.__alishopSession?.user?.id || null;
  const getClient = () => window.__alishopSupabase || window.supabase || null;

  function playNotificationSound() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      [0, 0.13].forEach((offset, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = index ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.24);
      });
    } catch (_) { /* Browsers may require a user gesture; the next interaction enables it. */ }
  }

  function updateBell(unread) {
    const button = $('#notificationButton');
    const count = $('#notificationCount');
    if (!button || !count) return;
    button.classList.remove('hidden');
    count.textContent = unread > 99 ? '99+' : String(unread);
    count.classList.toggle('hidden', unread < 1);
    button.classList.toggle('has-live-notification', unread > 0);
  }

  async function refreshUnread(playSound = false) {
    const client = getClient();
    const userId = currentUserId();
    if (!client || !userId) return;
    const { data, error } = await client.from('notifications').select('id,title,body,is_read,created_at').or(`user_id.eq.${userId},user_id.is.null`).eq('is_read', false).order('created_at', { ascending: false }).limit(99);
    if (error) return;
    const rows = data || [];
    const newRows = rows.filter((row) => !lastSeen.has(row.id));
    updateBell(rows.length);
    rows.forEach((row) => lastSeen.add(row.id));
    if (playSound && newRows.length) {
      playNotificationSound();
      const newest = newRows[0];
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(newest.title || 'إشعار جديد', { body: newest.body || '', icon: './assets/icons/icon-192.png', tag: newest.id });
      }
    }
  }

  async function requestPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') await audioContext.resume();
    } catch (_) {}
  }

  function subscribe() {
    const client = getClient();
    const userId = currentUserId();
    if (!client || !userId || channel) return;
    channel = client.channel(`live-notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => refreshUnread(true))
      .subscribe();
  }

  async function boot() {
    if (initialized) return;
    initialized = true;
    const client = getClient();
    const { data } = await client?.auth?.getSession?.() || { data: {} };
    if (data?.session) window.__alishopSession = data.session;
    client?.auth?.onAuthStateChange?.((_event, session) => {
      if (session?.user?.id) { window.__alishopSession = session; refreshUnread(false); subscribe(); }
    });
    document.addEventListener('pointerdown', requestPermission, { once: true, passive: true });
    document.addEventListener('keydown', requestPermission, { once: true });
    $('#notificationButton')?.addEventListener('click', () => { requestPermission(); setTimeout(() => refreshUnread(false), 100); });
    refreshUnread(false);
    subscribe();
    window.setInterval(() => { refreshUnread(false); subscribe(); }, 30000);
  }

  const observer = new MutationObserver(() => { if (currentUserId()) boot(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('focus', () => refreshUnread(false));
})();
