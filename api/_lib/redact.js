/* Keeps third-party clinical providers out of the reading.
 *
 * WHY. Policies name the insurer's own preferred clinics and the route to them.
 * The Bupa trust guide, for instance, tells London employees to self refer for
 * physiotherapy through a named provider. Surfacing that hands the member a
 * competitor's pathway inside UNTIL's own tool.
 *
 * WHAT THIS DOES NOT DO. It never removes a condition the member has to satisfy
 * to be paid: pre-authorisation, the need for an insurer-recognised practitioner,
 * excesses, session caps, referral requirements. Those stay, in full. Hiding them
 * would send someone to an appointment believing they were covered when they were
 * not, and the bill would land on them. That is a worse outcome than naming a
 * competitor, and it would land on UNTIL.
 *
 * So the rule is: remove WHO to go to, keep WHAT you have to do.
 *
 * Insurers are deliberately not on the list. "Bupa", "AXA" and the rest have to
 * survive, because the policy panel names the insurer and the member needs to
 * know who to pre-authorise with.
 */

const DEFAULT_BLOCKED = [
  "HCA Roodlane", "Roodlane", "HCA Healthcare", "HCA UK",
  "Nuffield Health", "Spire Healthcare", "Spire",
  "Circle Health", "Circle Integrated Care",
  "Ramsay Health Care", "Ramsay",
  "Practice Plus Group", "Optegra", "Newmedica",
  "Peppy", "Bluecrest", "Thriva", "Babylon", "Livi", "Push Doctor",
  "Vita Health Group", "Ascenti", "Physio Med", "PhysioNow",
  "Connect Health", "IPRS Health", "Vitality GP", "Care Hub", "Onebright",
];

/* If a sentence carries one of these, it is doing work for the member and is
   kept: the provider's name is removed from it rather than the whole sentence. */
const PROTECTED = [
  "pre-auth", "preauth", "pre auth", "authoris", "authoriz",
  "recognis", "recogniz", "approved", "excess", "referral", "refer",
  "limit", "cap", "session", "eligib", "claim", "notify", "contact us",
  "before", "must", "need to", "required",
];

function blockedList() {
  const extra = (process.env.BLOCKED_PROVIDERS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  // Longest first, so "HCA Roodlane" is removed before "Roodlane" can match.
  return [...DEFAULT_BLOCKED, ...extra].sort((a, b) => b.length - a.length);
}

function namePattern(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp("\\b" + escaped + "\\b", "gi");
}

export function mentionsBlocked(text, blocked = blockedList()) {
  if (typeof text !== "string" || !text) return false;
  return blocked.some((n) => namePattern(n).test(text));
}

/** Strip the provider name and the preposition that introduced it. */
function stripNames(sentence, blocked) {
  let out = sentence;
  for (const n of blocked) {
    out = out.replace(
      new RegExp("(\\s*\\b(?:with|through|via|at|from|by|to)\\b)?\\s*" +
        n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "\\b", "gi"),
      "");
  }
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .trim();
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+/);
}

/**
 * Clean one free-text field. Sentences that only exist to route the member
 * elsewhere are dropped; sentences that also carry a condition keep the
 * condition and lose the name.
 */
export function cleanText(text, blocked = blockedList()) {
  if (typeof text !== "string" || !text) return text;
  if (!mentionsBlocked(text, blocked)) return text;

  const kept = [];
  for (const sentence of splitSentences(text)) {
    if (!mentionsBlocked(sentence, blocked)) { kept.push(sentence); continue; }
    const lower = sentence.toLowerCase();
    const worthKeeping = PROTECTED.some((k) => lower.includes(k));
    if (!worthKeeping) continue;                 // pure signposting, drop it
    const stripped = stripNames(sentence, blocked);
    // If removing the name left a fragment, it is not worth showing.
    if (stripped.replace(/[^a-z]/gi, "").length >= 12) kept.push(stripped);
  }
  return kept.join(" ").trim();
}

/**
 * Walk a reading and remove third-party providers from it.
 * Returns { data, redactions } so the change is visible in logs and telemetry
 * rather than happening silently.
 */
export function redactReading(data) {
  if (!data || typeof data !== "object") return { data, redactions: [] };
  const blocked = blockedList();
  const redactions = [];

  const scrub = (obj, field, label) => {
    const before = obj[field];
    if (typeof before !== "string" || !mentionsBlocked(before, blocked)) return;
    const after = cleanText(before, blocked);
    obj[field] = after || null;
    redactions.push({ where: label + "." + field });
  };

  for (const s of Array.isArray(data.services) ? data.services : []) {
    const label = s && s.name ? String(s.name) : "service";
    scrub(s, "headline", label);
    scrub(s, "detail", label);
    scrub(s, "limit", label);
    // Evidence is a verbatim quote and cannot be edited without making it a
    // misquote, so a quote that names a provider is dropped rather than altered.
    if (mentionsBlocked(s && s.evidence, blocked)) {
      s.evidence = null;
      redactions.push({ where: label + ".evidence", dropped: true });
    }
    // A headline reduced to nothing would render as a blank row.
    if (!s.headline) s.headline = "Covered, with conditions";
  }

  for (const x of Array.isArray(data.extras) ? data.extras : []) {
    if (mentionsBlocked(x && x.name, blocked) || mentionsBlocked(x && x.value, blocked)) {
      redactions.push({ where: "extras." + (x.name || "?"), dropped: true });
      x.__drop = true;
    }
  }
  if (Array.isArray(data.extras)) data.extras = data.extras.filter((x) => !x.__drop);

  scrub(data, "caveat", "reading");

  return { data, redactions };
}
