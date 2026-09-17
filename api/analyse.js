import { ask, isConfigured, keyName, modelName, provider } from "./_lib/model.js";
import { redactReading } from "./_lib/redact.js";
import { mergeStatuses } from "./_lib/status.js";
import { checkLimits } from "./_lib/ratelimit.js";
import { recordRun } from "./_lib/telemetry.js";

// The read can take the best part of a minute. 60s is the ceiling on a Vercel
// Hobby plan; raise it here if the project moves to a plan that allows more.
export const maxDuration = 60;

const MAX_PROMPT_CHARS = 60000;

function fail(res, status, code, message) {
  res.status(status).json({ code, message });
}

/**
 * Pull the JSON object out of the reply. The prompt asks for bare JSON, but a
 * fenced block or a stray sentence either side should not lose the analysis.
 */
function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return fail(res, 405, "invalid_request", "Send a POST request.");
  }
  if (!isConfigured()) {
    return fail(res, 503, "not_configured",
      "The analyser is not switched on for this deployment. A " + keyName()
      + " needs setting in the hosting project.");
  }

  const prompt = req.body && req.body.prompt;
  if (typeof prompt !== "string" || prompt.trim().length < 40) {
    return fail(res, 400, "invalid_request", "No policy text was sent.");
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return fail(res, 413, "prompt_too_large",
      "That document is too long to read in one go. Send the summary of cover rather than the full policy pack.");
  }

  // Checked after validating the request, so a malformed call does not consume quota,
  // and before calling the model, so a refused call costs nothing.
  const limited = await checkLimits(req, { scope: "analyse" });
  if (limited) {
    if (limited.resetsAt) res.setHeader("Retry-After",
      Math.max(1, Math.ceil((new Date(limited.resetsAt) - Date.now()) / 1000)));
    return fail(res, limited.status, limited.code, limited.message);
  }

  const startedAt = Date.now();

  try {
    // Whichever model this deployment is pointed at. See api/_lib/model.js.
    const { text, refused } = await ask(prompt);

    if (refused) {
      return fail(res, 422, "refused",
        "That document could not be read. Try the summary of cover instead.");
    }

    const data = parseJson(text);
    if (!data) {
      return fail(res, 502, "invalid_json",
        "The reading came back in a form this page could not use. Try again.");
    }

    // Third-party clinical providers come out before the reading is returned.
    // The prompt asks the model not to name them; this is the layer that does
    // not depend on the model having listened. Conditions the member has to meet
    // to be paid are deliberately preserved. See api/_lib/redact.js.
    const { redactions } = redactReading(data);
    if (redactions.length) {
      console.log("redacted providers", JSON.stringify(redactions));
    }

    // Telemetry reads the model's own words, before the merge below, so we keep
    // seeing how often it still reaches for "limited".
    recordRun(data, prompt, req.body && req.body.meta, Date.now() - startedAt);

    // Three statuses, not four. Cover with a condition attached is covered; the
    // condition itself is carried in the row's "limit". See api/_lib/status.js.
    const remapped = mergeStatuses(data);
    if (remapped) console.log("statuses remapped onto current vocabulary", remapped);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data);
  } catch (err) {
    const status = err && err.status;
    if (status === 401 || status === 403) {
      return fail(res, 503, "not_configured",
        "The analyser's API key was rejected. Check " + keyName() + " in the hosting project.");
    }
    if (status === 429) {
      return fail(res, 429, "rate_limited",
        "The analyser is busy right now. Wait a moment and try again.");
    }
    console.error("analyse failed", provider(), modelName(), err);
    return fail(res, 502, "upstream_error",
      "Something went wrong reading the document. Try again in a moment.");
  }
}
