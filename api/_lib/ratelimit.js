import { createHash } from "node:crypto";
import { supabase, isConfigured } from "./supabase.js";

// Two ceilings, because they fail differently. The per-caller limit stops one person
// looping the endpoint; the global limit is the actual spend cap, and it holds even
// when requests arrive from many addresses.
const PER_IP_MAX     = num(process.env.RATE_LIMIT_PER_IP, 5);
const PER_IP_WINDOW  = num(process.env.RATE_LIMIT_WINDOW_SECONDS, 3600);
const GLOBAL_MAX     = num(process.env.RATE_LIMIT_GLOBAL_PER_DAY, 200);

function num(v, fallback) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * The caller's address, hashed with a secret salt before it is stored, so the
 * database holds a bucket key and never an IP.
 */
function callerBucket(req, scope) {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : String(fwd || ""))
    .split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || "until-policy-check";
  return `${scope}:${createHash("sha256").update(salt + "|" + ip).digest("hex").slice(0, 32)}`;
}

async function bump(bucket, windowSeconds, max) {
  const { data, error } = await supabase().rpc("bump_rate_limit", {
    p_bucket: bucket, p_window_seconds: windowSeconds, p_max: max,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: row?.allowed !== false, resetsAt: row?.resets_at ?? null };
}

/**
 * Returns null when the request may proceed, or {status, code, message} when it
 * must be refused.
 *
 * Not configured -> allowed, so the app still runs on a deployment without a
 * database. Configured but erroring -> refused. That is deliberate: this endpoint
 * spends a paid API key on every call, and an unbounded bill is a worse failure
 * than a few minutes of "try again shortly".
 */
export async function checkLimits(req, { scope = "analyse", global = true } = {}) {
  if (!isConfigured()) return null;
  try {
    const mine = await bump(callerBucket(req, scope), PER_IP_WINDOW, PER_IP_MAX);
    if (!mine.allowed) {
      return { status: 429, code: "rate_limited", resetsAt: mine.resetsAt,
        message: `That is ${PER_IP_MAX} documents in an hour from this connection. Try again a little later.` };
    }
    if (global) {
      const day = new Date().toISOString().slice(0, 10);
      const all = await bump(`global:${scope}:${day}`, 86400, GLOBAL_MAX);
      if (!all.allowed) {
        return { status: 429, code: "rate_limited", resetsAt: all.resetsAt,
          message: "The checker has hit its daily limit. It will be available again tomorrow." };
      }
    }
    return null;
  } catch (err) {
    console.error("rate limit check failed", err);
    return { status: 503, code: "rate_limit_unavailable",
      message: "The checker cannot verify its usage limit right now. Try again in a few minutes." };
  }
}
