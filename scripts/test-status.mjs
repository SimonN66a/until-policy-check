/* Tests for api/_lib/status.js -- the three-status vocabulary.
   Run: node scripts/test-status.mjs */
import { canonicalStatus, mergeStatuses, STATUSES } from "../api/_lib/status.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log("  ok   " + name); pass += 1; }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); fail += 1; }
}
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg || "") + "\n       got:      " + A + "\n       expected: " + B);
}

console.log("\nstatus vocabulary\n");

t("there are exactly three statuses", () => {
  eq(STATUSES, ["covered", "not_covered", "not_stated"]);
});

t("the three current statuses pass through unchanged", () => {
  for (const s of STATUSES) eq(canonicalStatus(s), s, s);
});

t('"limited" reads as covered -- this is the whole point of the change', () => {
  eq(canonicalStatus("limited"), "covered");
});

t("other partial-cover labels a different model might use also read as covered", () => {
  eq(canonicalStatus("partial"), "covered");
  eq(canonicalStatus("Partially Covered"), "covered");
  eq(canonicalStatus("conditional"), "covered");
});

t("case and spacing do not matter", () => {
  eq(canonicalStatus("  LIMITED "), "covered");
  eq(canonicalStatus("Not Covered"), "not_covered");
  eq(canonicalStatus("not stated"), "not_stated");
  eq(canonicalStatus("not-covered"), "not_covered");
});

t("an exclusion is never softened into cover", () => {
  eq(canonicalStatus("not_covered"), "not_covered");
  eq(canonicalStatus("excluded"), "not_stated", "unknown labels fall back, they do not become covered");
});

t("junk, null and undefined fall back to not_stated", () => {
  eq(canonicalStatus(null), "not_stated");
  eq(canonicalStatus(undefined), "not_stated");
  eq(canonicalStatus(""), "not_stated");
  eq(canonicalStatus(42), "not_stated");
  eq(canonicalStatus("banana"), "not_stated");
});

t("mergeStatuses rewrites rows in place and counts what it changed", () => {
  const data = { services: [
    { name: "Physiotherapy", status: "limited" },
    { name: "Dentistry", status: "limited" },
    { name: "Private GP", status: "covered" },
    { name: "Aesthetics", status: "not_covered" },
  ] };
  eq(mergeStatuses(data), 2, "two rows changed");
  eq(data.services.map((s) => s.status), ["covered", "covered", "covered", "not_covered"]);
});

t("a row's limit text is left completely alone", () => {
  const data = { services: [
    { name: "Physiotherapy", status: "limited", limit: "Up to 6 sessions", headline: "Six sessions" },
  ] };
  mergeStatuses(data);
  eq(data.services[0].limit, "Up to 6 sessions", "the condition must survive the merge");
  eq(data.services[0].headline, "Six sessions");
});

t("no services, bad services, or no data at all: does not throw", () => {
  eq(mergeStatuses({}), 0);
  eq(mergeStatuses({ services: null }), 0);
  eq(mergeStatuses({ services: [null, "nope", 7] }), 0);
  eq(mergeStatuses(null), 0);
  eq(mergeStatuses(undefined), 0);
});

t("a reading already in the new vocabulary is untouched", () => {
  const data = { services: [{ status: "covered" }, { status: "not_stated" }] };
  eq(mergeStatuses(data), 0);
});

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
