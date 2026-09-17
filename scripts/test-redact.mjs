/* The rule under test: remove WHO to go to, keep WHAT you must do. */
import assert from "node:assert";
const mod = new URL("../api/_lib/redact.js", import.meta.url).href;
const { cleanText, mentionsBlocked, redactReading } = await import(mod);

let passed = 0, failed = 0;
const t = (name, fn) => {
  try { fn(); console.log("  ok   " + name); passed++; }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); failed++; }
};

t("spots a named provider", () => {
  assert.equal(mentionsBlocked("self refer with HCA Roodlane"), true);
  assert.equal(mentionsBlocked("physiotherapy is covered in full"), false);
});

t("does not touch the insurer's own name", () => {
  const s = "Bupa must pre-authorise treatment before you book.";
  assert.equal(cleanText(s), s);
});

t("drops a sentence whose only job is routing", () => {
  const s = "Physiotherapy is paid in full. Book through HCA Roodlane to arrange it.";
  assert.equal(cleanText(s), "Physiotherapy is paid in full.");
});

t("KEEPS the entitlement and loses the provider", () => {
  const out = cleanText("You can self refer for physiotherapy treatment with HCA Roodlane without referral from a GP.");
  assert.ok(!/roodlane/i.test(out), out);
  assert.ok(/self refer/i.test(out), out);
  assert.ok(/without referral from a GP/i.test(out), out);
});

t("NEVER removes a pre-authorisation requirement", () => {
  const out = cleanText("Call Nuffield Health for an appointment, but you must get pre-authorisation first.");
  assert.ok(!/nuffield/i.test(out), out);
  assert.ok(/pre-authorisation/i.test(out), out);
  assert.ok(/must/i.test(out), out);
});

t("NEVER removes the recognised-practitioner condition", () => {
  const out = cleanText("Treatment at Spire Healthcare is payable only if the practitioner is recognised by us.");
  assert.ok(!/spire/i.test(out), out);
  assert.ok(/recognised by us/i.test(out), out);
});

t("keeps excesses and session caps", () => {
  const out = cleanText("Ascenti provides up to 6 sessions, and your excess applies.");
  assert.ok(!/ascenti/i.test(out), out);
  assert.ok(/6 sessions/i.test(out), out);
  assert.ok(/excess/i.test(out), out);
});

t("drops a verbatim quote that names a provider, rather than misquoting it", () => {
  const { data, redactions } = redactReading({
    services: [{ name: "Physiotherapy", status: "limited", headline: "Covered in full",
      detail: "Paid in full.", limit: null,
      evidence: "You can self refer for physiotherapy treatment with HCA Roodlane." }],
  });
  assert.equal(data.services[0].evidence, null);
  assert.equal(data.services[0].headline, "Covered in full");
  assert.ok(redactions.some((r) => r.where === "Physiotherapy.evidence" && r.dropped));
});

t("removes a perk that is really a third-party signup", () => {
  const { data } = redactReading({
    services: [],
    extras: [{ name: "Menopause support", value: "In partnership with Peppy" },
             { name: "Gym discount", value: "Up to 40% off" }],
  });
  assert.deepEqual(data.extras.map((x) => x.name), ["Gym discount"]);
});

t("never leaves a service row blank", () => {
  const { data } = redactReading({
    services: [{ name: "Physiotherapy", headline: "Arranged via Ascenti", detail: "Call Ascenti.", evidence: null }],
  });
  assert.ok(data.services[0].headline && data.services[0].headline.length > 3, JSON.stringify(data.services[0]));
});

t("BLOCKED_PROVIDERS extends the list at runtime", () => {
  process.env.BLOCKED_PROVIDERS = "Acme Physio Ltd";
  assert.equal(mentionsBlocked("Book with Acme Physio Ltd today"), true);
  delete process.env.BLOCKED_PROVIDERS;
});

t("a clean reading passes through untouched", () => {
  const input = { services: [{ name: "Physiotherapy", headline: "Paid in full",
    detail: "No session cap applies.", limit: null, evidence: "Therapists' fees for outpatient treatment." }],
    extras: [], caveat: "Your excess still applies." };
  const { data, redactions } = redactReading(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(data, input);
  assert.equal(redactions.length, 0);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
