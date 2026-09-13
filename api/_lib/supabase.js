import { createClient } from "@supabase/supabase-js";

// The service role key bypasses RLS, so it must never reach the browser. It is read
// here, inside a serverless function, and nowhere else. If you ever add a client-side
// Supabase call, it uses the anon key and needs RLS policies written for it first.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;

/** Returns the client, or null when Supabase is not configured for this deployment. */
export function supabase() {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "until-policy-check" } },
    });
  }
  return client;
}

export const isConfigured = () => Boolean(url && key);
