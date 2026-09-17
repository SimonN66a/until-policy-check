/**
 * Status vocabulary for a reading.
 *
 * Until v1.6.0 there were four statuses and "limited" was one of them. It read
 * badly: a member with six paid physiotherapy sessions saw "0 covered", which is
 * both wrong and discouraging. Cover with a condition attached is still cover.
 * So there are now three statuses, and the condition lives in the row's "limit"
 * field, where it is still shown on every card.
 *
 * This runs server-side as well as in the browser because the model is swappable:
 * a different provider, or a cached older prompt, can still emit "limited", and
 * the API response should be in the current vocabulary whatever answered it.
 */

export const STATUSES = ["covered", "not_covered", "not_stated"];

/** Old labels mapped onto the current three. */
const LEGACY = {
  limited: "covered",
  partial: "covered",
  partially_covered: "covered",
  conditional: "covered",
};

export function canonicalStatus(raw) {
  const s = String(raw == null ? "" : raw).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (STATUSES.includes(s)) return s;
  if (LEGACY[s]) return LEGACY[s];
  return "not_stated";
}

/**
 * Rewrites every service row onto the current vocabulary, in place.
 * Returns the count of rows whose status was changed, which is worth logging:
 * a number that stays high means the prompt is not landing with the live model.
 */
export function mergeStatuses(data) {
  const rows = Array.isArray(data?.services) ? data.services : [];
  let changed = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const before = row.status;
    const after = canonicalStatus(before);
    if (after !== before) { row.status = after; changed += 1; }
  }
  return changed;
}
