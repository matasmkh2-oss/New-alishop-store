/* Arabic, user-friendly messages for every toast shown by the application. */
(() => {
  const messages = [
    [/jwt|token|session|not authenticated|unauthorized|غير مسجل/i, 'انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.'],
    [/permission|forbidden|row level security|ليس لديك صلاحية|غير مسموح/i, 'ليست لديك صلاحية لتنفيذ هذا الإجراء.'],
    [/network|fetch|failed to fetch|تعذر الاتصال|شبكة/i, 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'],
    [/duplicate|already exists|unique constraint|موجود مسبقًا|مكرر/i, 'هذه البيانات موجودة مسبقًا. اختر قيمة مختلفة.'],
    [/foreign key|violates|constraint|مرجع|قيد/i, 'لا يمكن حفظ البيانات لأنها مرتبطة بسجل آخر.'],
    [/invalid|incorrect|صيغة غير|غير صالح/i, 'البيانات المدخلة غير صحيحة. يرجى مراجعتها.'],
    [/not found|غير موجود|لم يتم العثور/i, 'العنصر المطلوب غير موجود أو لم يعد متاحًا.'],
    [/timeout|timed out|انتهت المهلة/i, 'استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.'],
    [/storage|upload|file|image|صورة|ملف|رفع/i, 'تعذر رفع الملف. تأكد من نوعه وحجمه ثم حاول مرة أخرى.'],
    [/required|empty|missing|مطلوب|فارغ/i, 'يرجى إكمال الحقول المطلوبة أولًا.'],
  ];

  function arabicMessage(input) {
    const raw = typeof input === 'string' ? input : (input?.message || input?.error_description || '');
    const text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
    if (/^[\u0600-\u06FF\s،؛؟.!:\-()\d%]+$/.test(text) && !/error|failed|undefined|null/i.test(text)) return text;
    const match = messages.find(([pattern]) => pattern.test(text));
    if (match) return match[1];
    return 'تعذر إتمام العملية الآن. حاول مرة أخرى بعد قليل.';
  }

  window.alishopMessage = arabicMessage;
})();
