import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "ضع_رابط_مشروعك_هنا";
const SUPABASE_ANON_KEY = "ضع_المفتاح_العام_هنا";

export const isConfigured =
  !SUPABASE_URL.includes("ضع_") &&
  !SUPABASE_ANON_KEY.includes("ضع_");

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
