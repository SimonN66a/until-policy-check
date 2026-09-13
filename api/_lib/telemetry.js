import { supabase, isConfigured } from "./supabase.js";

/**
 * Mirrors the browser's evidence check, for telemetry only. The page runs its own
 * check against the text it extracted and that is what the UI shows; this one exists
 * so the unverified-quote rate -- the product's single most important quality signal
 * -- is recorded somewhere the team can actually see it.
 */
export function normalise(s) {
  return String(s || "").toLowerCase().replace(/[\s\u00a0]+/g, " ")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').trim();
}
export function quoteIsFound(quote, haystack) {
  const q = normalise(quote);
  if (q.length < 12) return null;
  if (haystack.includes(q)) return true;
  return haystack.includes(q.slice(0, Math.min(q.length, 90)));
}

/**
 * Anonymous product telemetry. Records how a reading turned out and nothing about
 * whose reading it was: no policy text, no quotes, no policy holder, no policy
 * number, and no link to a lead or an enquiry. Never throws and never delays the
 * response -- if it fails, the visitor still gets their answer.
 */
export function recordRun(data, prompt, meta, durationMs) {
  if (!isConfigured()) return;
  try {
    const services = Array.isArray(data?.services) ? data.services : [];
    const tally = (k) => services.filter((s) => s?.status === k).length;

    const haystack = normalise(prompt);
    let unverified = 0;
    for (const s of services) {
      if (s?.evidence && quoteIsFound(s.evidence, haystack) === false) unverified += 1;
    }

    const str = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
    const policy = data?.policy || {};

    supabase().from("analysis_runs").insert({
      insurer: str(policy.insurer?.value, 120),
      plan_name: str(policy.planName?.value, 120),
      doc_type: str(data?.docType, 120),
      source: meta?.source === "paste" ? "paste" : "pdf",
      doc_chars: Number.isFinite(meta?.chars) ? Math.min(meta.chars, 2000000) : null,
      duration_ms: durationMs,
      covered: tally("covered"),
      limited: tally("limited"),
      not_covered: tally("not_covered"),
      not_stated: tally("not_stated"),
      unverified_quotes: unverified,
    }).then(({ error }) => { if (error) console.error("analysis_runs insert failed", error); },
            (err) => console.error("analysis_runs insert threw", err));
  } catch (err) {
    console.error("recordRun threw", err);
  }
}
