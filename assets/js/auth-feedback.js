/* Authentication feedback guard: gives immediate, clear feedback even if a request is slow. */
(() => {
  function install() {
    const form = document.querySelector('#authForm');
    if (!form || form.dataset.feedbackReady) return;
    form.dataset.feedbackReady = '1';
    form.addEventListener('submit', () => {
      const button = form.querySelector('#authSubmit');
      if (!button) return;
      button.dataset.originalText ||= button.textContent;
      button.disabled = true;
      button.textContent = 'جارٍ التحقق...';
      window.setTimeout(() => {
        if (!form.closest('dialog')?.open) return;
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'دخول';
      }, 30000);
    }, { capture: true });
    form.closest('dialog')?.addEventListener('close', () => {
      const button = form.querySelector('#authSubmit');
      if (!button) return;
      button.disabled = false;
      button.textContent = button.dataset.originalText || 'دخول';
    });
  }
  document.addEventListener('DOMContentLoaded', install, { once: true });
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
