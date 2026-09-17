/* The one place this app talks to a language model.
 *
 * Everything else — the prompt, the parsing, the rate limiter, the pages — is
 * provider agnostic. Swap models by setting two environment variables:
 *
 *   MODEL_PROVIDER   anthropic | openai | google        (default: anthropic)
 *   MODEL_NAME       the model id for that provider
 *
 * plus that provider's API key. Nothing else in the codebase needs to change.
 *
 * The "openai" provider speaks the Chat Completions API, so it also covers
 * Azure OpenAI, OpenRouter, Together, Groq, Fireworks, vLLM and Ollama: point
 * MODEL_BASE_URL at the endpoint and use that service's key.
 *
 * Every provider returns the same shape:
 *   { text: string, refused: boolean }
 * and throws an Error carrying .status on an HTTP failure, so the caller can
 * tell "bad key" from "rate limited" from "everything else".
 */

const DEFAULTS = {
  anthropic: "claude-opus-5",
  openai: "gpt-4o",
  google: "gemini-1.5-pro",
};

const KEY_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};

export function provider() {
  return (process.env.MODEL_PROVIDER || "anthropic").toLowerCase();
}

export function modelName() {
  return process.env.MODEL_NAME || DEFAULTS[provider()] || DEFAULTS.anthropic;
}

/** The env var this deployment needs set, so errors can name it. */
export function keyName() {
  return KEY_ENV[provider()] || KEY_ENV.anthropic;
}

export function isConfigured() {
  return Boolean(process.env[keyName()]);
}

const MAX_TOKENS = Number(process.env.MODEL_MAX_TOKENS || 16000);

function httpError(status, body) {
  const e = new Error("model request failed: " + status + " " + String(body).slice(0, 400));
  e.status = status;
  return e;
}

/* ---------------------------------------------------------------- anthropic */
async function askAnthropic(prompt) {
  // Streamed so a long read cannot trip the SDK's HTTP timeout.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: modelName(),
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: prompt }],
  });
  const message = await stream.finalMessage();
  return {
    refused: message.stop_reason === "refusal",
    text: message.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
  };
}

/* ------------------------------------------------- openai and compatibles */
async function askOpenAI(prompt) {
  const base = process.env.MODEL_BASE_URL || "https://api.openai.com/v1";
  const r = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + process.env[keyName()],
    },
    body: JSON.stringify({
      model: modelName(),
      max_completion_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
      // Ask for JSON where the endpoint supports it. Harmless where it does not,
      // because the caller extracts the object from the text either way.
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw httpError(r.status, await r.text());
  const j = await r.json();
  const choice = (j.choices && j.choices[0]) || {};
  return {
    refused: choice.finish_reason === "content_filter",
    text: (choice.message && choice.message.content) || "",
  };
}

/* ------------------------------------------------------------------ google */
async function askGoogle(prompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/"
    + encodeURIComponent(modelName()) + ":generateContent";
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env[keyName()],
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: MAX_TOKENS, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw httpError(r.status, await r.text());
  const j = await r.json();
  const cand = (j.candidates && j.candidates[0]) || {};
  const parts = (cand.content && cand.content.parts) || [];
  return {
    refused: cand.finishReason === "SAFETY" || cand.finishReason === "PROHIBITED_CONTENT",
    text: parts.map((p) => p.text || "").join(""),
  };
}

const PROVIDERS = { anthropic: askAnthropic, openai: askOpenAI, google: askGoogle };

/** Send the prompt to whichever model this deployment is configured for. */
export async function ask(prompt) {
  const fn = PROVIDERS[provider()];
  if (!fn) {
    throw new Error("Unknown MODEL_PROVIDER: " + provider()
      + ". Use one of: " + Object.keys(PROVIDERS).join(", "));
  }
  return fn(prompt);
}
