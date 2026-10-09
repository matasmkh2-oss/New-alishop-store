/* Arabic, user-friendly messages for every toast shown by the application. */
(() => {
  const messages = [
    [/jwt|token|session|not authenticated|unauthorized|غير مسجل/i, 'انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.'],
    [/permission|forbidden|row level security|ليس لديك صلاحية|غير مسموح/i, 'ليست لديك صلاحية لتنفيذ هذا الإجراء.'],
    [/schema cache|does not exist|function.*not found/i, 'يرجى تطبيق ملف التحديثات في قاعدة بيانات Supabase.'],
    [/network|fetch|failed to fetch|تعذر الاتصال|شبكة/i, 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'],
    [/duplicate|already exists|unique constraint|موجود مسبقًا|مكرر/i, 'هذه البيانات موجودة مسبقًا. اختر قيمة مختلفة.'],
    [/foreign key|violates|constraint|مرجع|قيد/i, 'لا يمكن حفظ البيانات لأنها مرتبطة بسجل آخر.'],
    [/(?:invalid[_\s]+(?:input|syntax|format|parameter)|incorrect|صيغة غير|غير صالح)/i, 'البيانات المدخلة غير صحيحة. يرجى مراجعتها.'],
    [/not found|غير موجود|لم يتم العثور/i, 'العنصر المطلوب غير موجود أو لم يعد متاحًا.'],
    [/timeout|timed out|انتهت المهلة/i, 'استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.'],
    [/storage|upload|file|image|صورة|ملف|رفع/i, 'تعذر رفع الملف. تأكد من نوعه وحجمه ثم حاول مرة أخرى.'],
    [/required|empty|missing|مطلوب|فارغ/i, 'يرجى إكمال الحقول المطلوبة أولًا.'],
  ];

  function arabicMessage(input) {
    const raw = typeof input === 'string' ? input : (input?.message || input?.error_description || '');
    const text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
    if (/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s،؛؟.,!:\-—–()\[\]"'/+%\d]+$/.test(text) && !/error|failed|undefined|null/i.test(text)) return text;
    const match = messages.find(([pattern]) => pattern.test(text));
    if (match) return match[1];
    return text || 'تعذر إتمام العملية الآن. حاول مرة أخرى بعد قليل.';
  }

  function displayToast(msg, type = 'info') {
    try {
      const rawText = typeof msg === 'string' ? msg : (msg?.message || String(msg || ''));
      const text = arabicMessage(rawText);
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
    } catch (_) {}
  }

  window.alishopMessage = arabicMessage;
  window.toast = displayToast;
  window.showToast = displayToast;
})();
