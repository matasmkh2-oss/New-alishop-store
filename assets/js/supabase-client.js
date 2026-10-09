import { CONFIG } from "./config.js";

const lib = window.supabase;
if (!lib || !lib.createClient) {
  throw new Error("تعذر تحميل مكتبة الاتصال بقاعدة البيانات — تأكد من وجود assets/vendor/supabase.min.js");
}

export const supabase = lib.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: "alishop_auth_session",
    flowType: "pkce"
  }
});

window.__alishopSupabase = supabase;
window.supabaseClient = supabase;


// Automatic cleanup of revoked/stale refresh tokens
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    try {
      localStorage.removeItem("alishop_auth_session");
      localStorage.removeItem("alishop_auth_session-code-verifier");
      localStorage.removeItem("sb-jcnbbingctwuathvfqty-auth-token");
      localStorage.removeItem("sb-jcnbbingctwuathvfqty-auth-token-code-verifier");
    } catch (_) {}
  }
});
