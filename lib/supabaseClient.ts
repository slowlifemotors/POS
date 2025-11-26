//  lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// PUBLIC CLIENT — SAFE FOR BROWSER
// Uses publishable client-side keys only

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,      // public URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // publishable anon key
  {
    auth: { persistSession: true }
  }
);
