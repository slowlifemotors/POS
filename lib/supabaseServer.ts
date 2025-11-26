//  lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

// Correct server-side Supabase client
export const supabaseServer = createClient(
  process.env.SUPABASE_URL!,          // ✅ secure backend URL (non-public)
  process.env.SUPABASE_SERVICE_KEY!,  // ✅ service role key
  {
    auth: {
      persistSession: false,
    },
  }
);
