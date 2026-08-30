import{CONFIG}from"./config.js";
const lib=window.supabase;
if(!lib||!lib.createClient){throw new Error("تعذر تحميل مكتبة الاتصال بقاعدة البيانات — تأكد من وجود assets/vendor/supabase.min.js");}
export const supabase=lib.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
