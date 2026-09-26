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
    if (unread > 0) {
      count.classList.remove('hidden');
      count.style.display = 'flex';
    } else {
      count.classList.add('hidden');
      count.style.display = 'none';
    }
    button.classList.toggle('has-live-notification', unread > 0);
  }

  async function refreshUnread(playSound = false) {
    try {
      const client = getClient();
      const userId = currentUserId();
      if (!client || !userId) return;
      const { data, error } = await client
        .from('notifications')
        .select('id,title,body,is_read,created_at')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(99);
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
    } catch (_) {
      // Safe network fallback
    }
  }

  const VAPID_PUBLIC_KEY = 'BNKro9vLOmExrbj1mC4d1gS0bLzMg18eX-MW4pRwdwwStUc9vSkmHMfq8nh-QPLsltCUEAG2TD4Td2kQaRpS3P8';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function subscribeUserToPush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return null;
      }
      if ('Notification' in window && Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return null;
      }
      const registration = await navigator.serviceWorker.ready;
      if (!registration || !registration.pushManager) return null;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      if (subscription) {
        const client = getClient();
        const userId = currentUserId();
        if (client && userId) {
          try {
            const subJson = subscription.toJSON ? subscription.toJSON() : JSON.parse(JSON.stringify(subscription));
            const { error: profileErr } = await client
              .from('profiles')
              .update({
                push_subscription: subJson
              })
              .eq('id', userId);

            if (profileErr) {
              console.error('خطأ في حفظ اشتراك الإشعارات:', profileErr);
            } else {
              console.log('تم حفظ اشتراك الإشعارات بنجاح');
            }

            // Also keep push_subscriptions table synced if present
            await client.from('push_subscriptions').upsert({
              user_id: userId,
              endpoint: subscription.endpoint,
              p256dh: subJson.keys?.p256dh || '',
              auth: subJson.keys?.auth || '',
              subscription_json: subJson,
              updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' }).catch(() => {});
          } catch (updateErr) {
            console.error('خطأ أثناء حفظ اشتراك الإشعارات:', updateErr);
          }
        }
      }
      return subscription;
    } catch (err) {
      console.warn('Push subscription notice:', err);
      return null;
    }
  }

  window.subscribeUserToPush = subscribeUserToPush;
  window.urlBase64ToUint8Array = urlBase64ToUint8Array;

  async function requestPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') await audioContext.resume();
      if ('Notification' in window && Notification.permission === 'granted') {
        subscribeUserToPush().catch(() => {});
      }
    } catch (_) {}
  }

  function subscribe() {
    try {
      const client = getClient();
      const userId = currentUserId();
      if (!client || !userId || channel) return;
      channel = client.channel(`live-notifications-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
          refreshUnread(true).catch(() => {});
        })
        .subscribe();
    } catch (_) {}
  }

  async function boot() {
    if (initialized) return;
    initialized = true;
    try {
      const client = getClient();
      if (client?.auth?.getSession) {
        const { data } = await client.auth.getSession().catch(() => ({ data: {} }));
        if (data?.session) window.__alishopSession = data.session;
      }
      client?.auth?.onAuthStateChange?.((_event, session) => {
        if (session?.user?.id) {
          window.__alishopSession = session;
          refreshUnread(false).catch(() => {});
          subscribe();
        }
      });
      document.addEventListener('pointerdown', requestPermission, { once: true, passive: true });
      document.addEventListener('keydown', requestPermission, { once: true });
      $('#notificationButton')?.addEventListener('click', () => {
        requestPermission();
        setTimeout(() => refreshUnread(false).catch(() => {}), 100);
      });
      refreshUnread(false).catch(() => {});
      subscribe();
      window.setInterval(() => {
        refreshUnread(false).catch(() => {});
        subscribe();
      }, 30000);
    } catch (_) {}
  }

  const observer = new MutationObserver(() => {
    if (currentUserId()) boot();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('focus', () => {
    refreshUnread(false).catch(() => {});
  });
})();
