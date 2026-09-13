import { supabase, isConfigured } from "./_lib/supabase.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The gate email. Deliberately quiet: the visitor is waiting on their analysis, so
// this never blocks them and never surfaces an error. A lost lead is a smaller cost
// than a lost reading.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "invalid_request" });
  const email = typeof req.body?.email === "string" ? req.body.email.trim().slice(0, 254) : "";
  if (!EMAIL.test(email)) return res.status(400).json({ code: "invalid_request" });
  if (!isConfigured()) return res.status(202).json({ ok: false, stored: false });

  const { error } = await supabase().from("leads").insert({
    email,
    source: typeof req.body?.source === "string" ? req.body.source.slice(0, 40) : "gate",
    referrer: String(req.headers.referer || "").slice(0, 500) || null,
    user_agent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
  });
  if (error) console.error("lead insert failed", error);

  res.setHeader("Cache-Control", "no-store");
  return res.status(202).json({ ok: true, stored: !error });
}
