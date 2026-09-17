/* Exercises every provider branch without a real API key. */
import assert from "node:assert";
const mod = new URL("../api/_lib/model.js", import.meta.url).href;
let passed = 0, failed = 0;
const t = async (name, fn) => {
  try { await fn(); console.log("  ok   " + name); passed++; }
  catch (e) { console.log("  FAIL " + name + " :: " + e.message); failed++; }
};
const fresh = async () => { const u = mod + "?v=" + Math.random(); return import(u); }

// --- defaults ---------------------------------------------------------------
await t("defaults to anthropic/claude-opus-5", async () => {
  delete process.env.MODEL_PROVIDER; delete process.env.MODEL_NAME;
  const m = await fresh();
  assert.equal(m.provider(), "anthropic");
  assert.equal(m.modelName(), "claude-opus-5");
  assert.equal(m.keyName(), "ANTHROPIC_API_KEY");
});

await t("MODEL_NAME overrides the default", async () => {
  process.env.MODEL_NAME = "claude-haiku-4";
  const m = await fresh();
  assert.equal(m.modelName(), "claude-haiku-4");
  delete process.env.MODEL_NAME;
});

await t("openai picks its own key name and default", async () => {
  process.env.MODEL_PROVIDER = "openai";
  const m = await fresh();
  assert.equal(m.keyName(), "OPENAI_API_KEY");
  assert.equal(m.modelName(), "gpt-4o");
});

await t("isConfigured tracks the provider's key", async () => {
  process.env.MODEL_PROVIDER = "openai";
  delete process.env.OPENAI_API_KEY;
  let m = await fresh();
  assert.equal(m.isConfigured(), false);
  process.env.OPENAI_API_KEY = "sk-test";
  m = await fresh();
  assert.equal(m.isConfigured(), true);
});

// --- openai request/response -------------------------------------------------
await t("openai sends the right request and parses the reply", async () => {
  process.env.MODEL_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.MODEL_NAME = "gpt-4o-mini";
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
    return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: '{"ok":1}' } }] }) };
  };
  const m = await fresh();
  const r = await m.ask("hello");
  assert.ok(seen.url.endsWith("/chat/completions"), seen.url);
  assert.equal(seen.body.model, "gpt-4o-mini");
  assert.equal(seen.auth, "Bearer sk-test");
  assert.equal(r.text, '{"ok":1}');
  assert.equal(r.refused, false);
});

await t("openai honours MODEL_BASE_URL for compatible endpoints", async () => {
  process.env.MODEL_BASE_URL = "http://localhost:11434/v1/";
  let seen;
  globalThis.fetch = async (url) => { seen = url; return { ok: true, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }; };
  const m = await fresh();
  await m.ask("x");
  assert.equal(seen, "http://localhost:11434/v1/chat/completions");
  delete process.env.MODEL_BASE_URL;
});

await t("openai content_filter surfaces as refused", async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: "content_filter", message: { content: "" } }] }) });
  const m = await fresh();
  assert.equal((await m.ask("x")).refused, true);
});

await t("http failure carries the status through", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => "bad key" });
  const m = await fresh();
  await assert.rejects(() => m.ask("x"), (e) => e.status === 401);
});

// --- google ------------------------------------------------------------------
await t("google sends the right request and parses the reply", async () => {
  process.env.MODEL_PROVIDER = "google";
  process.env.GOOGLE_API_KEY = "g-test";
  process.env.MODEL_NAME = "gemini-1.5-flash";
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, key: init.headers["x-goog-api-key"] };
    return { ok: true, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"a":2}' }] } }] }) };
  };
  const m = await fresh();
  const r = await m.ask("hello");
  assert.ok(seen.url.includes("gemini-1.5-flash:generateContent"), seen.url);
  assert.equal(seen.key, "g-test");
  assert.equal(r.text, '{"a":2}');
});

await t("google SAFETY surfaces as refused", async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }) });
  const m = await fresh();
  assert.equal((await m.ask("x")).refused, true);
});

// --- guard rails --------------------------------------------------------------
await t("an unknown provider fails loudly and names the valid ones", async () => {
  process.env.MODEL_PROVIDER = "llama-via-carrier-pigeon";
  const m = await fresh();
  await assert.rejects(() => m.ask("x"), /Unknown MODEL_PROVIDER.*anthropic, openai, google/s);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
