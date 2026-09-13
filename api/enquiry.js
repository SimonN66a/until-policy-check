import { supabase, isConfigured } from "./_lib/supabase.js";
import { checkLimits } from "./_lib/ratelimit.js";

const CLUBS = ["Marylebone", "Soho", "Liverpool Street", "Canary Wharf", "No preference"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : null);

function fail(res, status, code, message) {
  res.status(status).json({ code, message });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, 405, "invalid_request", "Send a POST request.");

  const b = req.body || {};
  const name = clip(b.name, 120);
  const email = clip(b.email, 254);
  if (!name) return fail(res, 400, "invalid_request", "Add your name so we know who to reply to.");
  if (!email || !EMAIL.test(email))
    return fail(res, 400, "invalid_request", "That email address does not look right.");

  const services = Array.isArray(b.services)
    ? b.services.filter((s) => typeof s === "string").slice(0, 20).map((s) => s.slice(0, 80))
    : [];
  const club = CLUBS.includes(b.club) ? b.club : null;

  if (!isConfigured()) {
    // No database on this deployment. Say so plainly rather than showing a
    // confirmation for a request that was never recorded.
    return fail(res, 503, "not_configured",
      "Requests are not switched on for this deployment yet. Call the club directly and they will book you in.");
  }

  const limited = await checkLimits(req, { scope: "enquiry", global: false });
  if (limited) return fail(res, limited.status, limited.code, limited.message);

  // `notes` is the field the form labels "Symptoms, timings, or a practitioner you
  // have seen before", so this row is health data under UK GDPR Article 9. It is
  // written to a table with RLS on and no policies, reachable only by the service
  // role. See supabase/migrations/0001_init.sql.
  const { error } = await supabase().from("enquiries").insert({
    name, email, club,
    insurer: clip(b.insurer, 120) || null,
    services,
    notes: clip(b.notes, 4000) || null,
  });

  if (error) {
    console.error("enquiry insert failed", error);
    return fail(res, 502, "upstream_error",
      "Your request could not be saved. Try again, or call the club directly.");
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(201).json({ ok: true });
}
