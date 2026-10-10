import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Prevent stale caching in development / preview
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Permissions-Policy", "identity-credentials-get=(self \"https://accounts.google.com\")");
  next();
});

// Serve static assets
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  maxAge: 0
}));

// Parse JSON bodies
app.use(express.json());

// Server-side context fallback when AI models are experiencing capacity limits
function generateSupportFallback(message, storeContext) {
  const msg = String(message || "").toLowerCase();
  if (/محفظ|شحن|رصيد|دفع|ايداع|إيداع/.test(msg)) {
    return "أهلاً بك في علي شوب! 🌹\nيمكنك شحن رصيدك بكل سهولة عبر صفحة المحفظة. طرق الدفع المعتمدة: شام كاش، سيريتل كاش، USDT، وفودافون كاش. بعد التحويل يُرجى إرسال إشعار الدفع لتأكيد إيداع الرصيد فوراً.";
  }
  if (/طلب|كود|تتبع|حالة/.test(msg)) {
    return "أهلاً بك! يمكنك متابعة تفاصيل وحالة طلباتك وبيانات التسليم مباشرة عبر صفحة «طلباتي». وإن كان طلبك قيد المراجعة سيتولى فريق الدعم تنفيذه في أسرع وقت.";
  }
  if (/كوبون|خصم|تخفيض|برومو/.test(msg)) {
    return "لاستخدام كود الخصم، قم بكتابة رمز الكوبون في الخانة المخصصة داخل صفحة المنتج قبل الشراء وسيتم تطبيق الخصم فوراً ✨";
  }
  if (/سعر|أسعار|باقة|ببجي|جواهر|متابع|نتفلكس/.test(msg)) {
    return "أهلاً بك! يمكنك تصفح المنتجات والباقات والأسعار المعتمدة مباشرة بالضغط على المنتج في الصفحة الرئيسية أو صفحة المنتجات، وجميع الأسعار محدثة ومباشرة.";
  }
  return "أهلاً وسهلاً بك في متجر علي شوب! 👋\nتم استلام رسالتك، وفريق الدعم في خدمتك دائماً لمساعدتك في أي استفسار حول المنتجات أو الشحن.";
}

// Server-side Gemini AI support proxy with resilient retry & multi-model fallback
app.post("/api/support-ai", async (req, res) => {
  try {
    const { message, storeContext } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY || Buffer.from("QVEuQWI4Uk42Sm5MSUF1a3FrbTRiT1I0d1FSVUh3YVpHNGRHblVCaW1oVGkyNUhBcHdqUlE=", "base64").toString("utf-8");

    const prompt = `أنت المساعد الذكي الرسمي لخدمة عملاء متجر "علي شوب" (AliShop) لخدمات شحن الألعاب (ببجي، فري فاير، إلخ) والاشتراكات الرقمية وخدمات السوشيال ميديا.
مهمتك: الإجابة على استفسارات الزبائن بدقة واحترافية وبلهجة عربية مهذبة ومحترمة وودودة، بالاعتماد الحصري والكامل على بيانات المتجر الحقيقية المرفقة أدناه.

قواعد الإجابة الإلزامية:
1. استخدم حصراً المعلومات الحقيقية للمتجر المرفقة أدناه. لا تخترع أسعاراً أو خدمات أو باقات أو وسائل دفع غير موجودة في البيانات.
2. إذا سأل العميل عن سعر منتج، أعطه السعر الدقيق والباقات المتاحة من قائمة المنتجات أدناه مع العملة.
3. إذا سأل عن طرق الدفع، اذكر له طرق الدفع المتوفرة في المتجر وكيفية إيداع الرصيد عبر صفحة المحفظة.
4. إذا سأل عن كوبون أو كود خصم، وضّح له أنه يتم إدخاله في خانة الكوبون داخل صفحة المنتج أو إتمام الشراء.
5. إذا سأل عن متابعة طلب، اطلب منه التحقق من صفحة "طلباتي" لمعرفة الحالة وتفاصيل التسليم فوراً.
6. إذا لم تجد المعلومة في بيانات المتجر أو كانت استفساراً خاصاً، أخبره بلطف أن استفساره وصل وسيتولى فريق الدعم البشري متابعته فوراً.
7. أجب بأسلوب راقٍ ومختصر جداً (فقرة إلى فقرتين كحد أقصى) لتناسب شاشات المحادثة.

معلومات المتجر الحقيقية الحالية:
${storeContext || "متجر علي شوب"}

رسالة العميل:
${message}`;

    const models = [
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash"
    ];

    let reply = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 350,
                temperature: 0.4
              }
            })
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
            if (reply) break;
          } else if (response.status === 503 || response.status === 429) {
            // Transient busy spike, wait 400ms before retry
            await new Promise(r => setTimeout(r, 400));
          } else {
            break; // Non-retryable status (e.g. 404), move to next model
          }
        } catch (_) {
          break;
        }
      }

      if (reply) break;
    }

    if (!reply) {
      reply = generateSupportFallback(message, storeContext);
    }

    return res.json({ reply });
  } catch (_) {
    const fallbackReply = generateSupportFallback(req.body?.message, req.body?.storeContext);
    return res.json({ reply: fallbackReply });
  }
});

// Single Page Application route fallback
app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Ali Shop store running on http://0.0.0.0:${PORT}`);
});
