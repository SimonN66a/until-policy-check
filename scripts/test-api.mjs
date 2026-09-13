// End-to-end test for the API handlers.
//
// Stands up a minimal PostgREST-compatible shim over a real Postgres so
// @supabase/supabase-js makes genuine HTTP calls against the real migration.
// That exercises the handler code, the client config and the SQL together --
// what a mocked client would not.
import http from "node:http";
import { readFileSync } from "node:fs";
import { Client } from "pg";

// Any empty Postgres will do: `supabase start` gives you one, or run a local server.
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres npm test
const pg = new Client(process.env.TEST_DATABASE_URL
  ? { connectionString: process.env.TEST_DATABASE_URL }
  : { host: "/tmp", port: 5433, database: "untiltest", user: "pgtest" });
await pg.connect();

// Apply the migration every run, so the schema under test can never drift from the
// migration that will be applied to Supabase.
await pg.query("drop schema public cascade; create schema public;");
await pg.query("create role anon; create role authenticated;").catch(() => {});
await pg.query(readFileSync(new URL("../supabase/migrations/0001_init.sql", import.meta.url), "utf8"));

// ------------------------------------------------ PostgREST shim
const shim = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    const send = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    try {
      const m = req.url.match(/^\/rest\/v1\/(rpc\/)?([^?]+)/);
      if (!m) return send(404, { message: "no route" });
      const payload = body ? JSON.parse(body) : {};
      if (m[1]) {
        const fn = m[2];
        const keys = Object.keys(payload);
        const args = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
        const r = await pg.query(`select * from ${fn}(${args})`, keys.map((k) => payload[k]));
        return send(200, r.rows);
      }
      const rows = Array.isArray(payload) ? payload : [payload];
      const cols = Object.keys(rows[0]).filter((c) => rows[0][c] !== undefined);
      const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
      const r = await pg.query(
        `insert into ${m[2]} (${cols.join(",")}) values (${vals}) returning *`,
        cols.map((c) => rows[0][c])
      );
      return send(201, r.rows);
    } catch (e) {
      send(400, { message: e.message, code: e.code });
    }
  });
});
await new Promise((r) => shim.listen(54321, r));

process.env.SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.RATE_LIMIT_SALT = "test-salt";
process.env.RATE_LIMIT_PER_IP = "3";
process.env.RATE_LIMIT_WINDOW_SECONDS = "60";
process.env.RATE_LIMIT_GLOBAL_PER_DAY = "5";

const enquiry = (await import("../api/enquiry.js")).default;
const lead = (await import("../api/lead.js")).default;
const { checkLimits } = await import("../api/_lib/ratelimit.js");

function mockRes() {
  const r = { code: 0, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const mockReq = (body, ip = "1.2.3.4") => ({
  method: "POST", body,
  headers: { "x-forwarded-for": ip, "user-agent": "test", referer: "https://until.co.uk/" },
  socket: { remoteAddress: ip },
});

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};

console.log("\n/api/enquiry");
let res = mockRes();
await enquiry(mockReq({ name: "Simon Nicholls", email: "simon@until.co.uk", club: "Marylebone",
  insurer: "Example Health", services: ["Physiotherapy", "Private GP"],
  notes: "Lower back pain for three weeks" }), res);
check("valid enquiry returns 201", res.code === 201, JSON.stringify(res.body));
let row = (await pg.query("select * from enquiries")).rows[0];
check("row stored with services array", row?.services?.length === 2, JSON.stringify(row?.services));
check("notes stored", row?.notes === "Lower back pain for three weeks");
check("status defaults to new", row?.status === "new");

res = mockRes();
await enquiry(mockReq({ name: "", email: "simon@until.co.uk" }), res);
check("missing name rejected 400", res.code === 400);

res = mockRes();
await enquiry(mockReq({ name: "Simon", email: "not-an-email" }), res);
check("bad email rejected 400", res.code === 400);

res = mockRes();
await enquiry(mockReq({ name: "Simon", email: "s@until.co.uk", club: "Mars" }), res);
check("unknown club nulled, not rejected", res.code === 201);
check("club stored as null", (await pg.query(
  "select club from enquiries order by created_at desc limit 1")).rows[0].club === null);

res = mockRes();
await enquiry({ ...mockReq({}), method: "GET" }, res);
check("GET rejected 405", res.code === 405);

console.log("\n/api/lead");
res = mockRes();
await lead(mockReq({ email: "simon@until.co.uk" }), res);
check("lead accepted 202", res.code === 202 && res.body.stored === true, JSON.stringify(res.body));
check("referrer + user agent captured",
  (await pg.query("select referrer,user_agent from leads")).rows[0].referrer === "https://until.co.uk/");

console.log("\n/api/analyse telemetry (anonymous)");
const { recordRun } = await import("../api/_lib/telemetry.js");
const DOC = "Physiotherapy: benefit paid in full for up to 6 sessions per policy year. "
  + "This policy does not provide benefit for routine dental treatment.";
recordRun({
  policy: { holder: {value:"S. Nicholls"}, insurer: {value:"Example Health"},
            planName: {value:"Comprehensive"}, policyNumber: {value:"EX-4471-092"} },
  docType: "Summary of cover",
  services: [
    {name:"Physiotherapy", status:"covered",
     evidence:"benefit paid in full for up to 6 sessions per policy year"},
    {name:"Dentistry", status:"not_covered",
     evidence:"does not provide benefit for routine dental treatment"},
    {name:"Acupuncture", status:"limited",
     evidence:"acupuncture is reimbursed to a limit of nine hundred pounds annually"},
    {name:"Audiology", status:"not_stated", evidence:null}
  ]
}, DOC, {source:"pdf", chars: 4200}, 41000);
await new Promise((r) => setTimeout(r, 400));
const run = (await pg.query("select * from analysis_runs")).rows[0];
check("run recorded", Boolean(run), JSON.stringify(run));
check("verdict counts correct",
  run?.covered === 1 && run?.not_covered === 1 && run?.limited === 1 && run?.not_stated === 1,
  JSON.stringify([run?.covered, run?.limited, run?.not_covered, run?.not_stated]));
check("the fabricated quote is counted as unverified", run?.unverified_quotes === 1,
  String(run?.unverified_quotes));
check("insurer and doc type kept", run?.insurer === "Example Health" && run?.doc_type === "Summary of cover");
check("NO policy holder column exists to leak into",
  !Object.keys(run || {}).some((k) => /holder|policy_number|quote_text|evidence|text/.test(k)),
  Object.keys(run || {}).join(","));
check("no holder or policy number anywhere in the row",
  !JSON.stringify(run).includes("Nicholls") && !JSON.stringify(run).includes("EX-4471"));
check("duration and source captured", run?.duration_ms === 41000 && run?.source === "pdf");

console.log("\nrate limiting");
await pg.query("truncate rate_limits");
const verdicts = [];
for (let i = 0; i < 5; i++) verdicts.push(await checkLimits(mockReq({}, "9.9.9.9")));
check("first 3 allowed, then refused", verdicts.slice(0, 3).every((v) => v === null)
  && verdicts[3]?.status === 429, JSON.stringify(verdicts.map((v) => v?.status ?? "ok")));
check("refusal carries a reset time", Boolean(verdicts[3]?.resetsAt));
check("a different address is unaffected", (await checkLimits(mockReq({}, "8.8.8.8"))) === null);
check("no raw IP is stored", (await pg.query(
  "select count(*)::int c from rate_limits where bucket like '%9.9.9.9%'")).rows[0].c === 0);

console.log("\nglobal daily cap");
await pg.query("truncate rate_limits");
const global = [];
for (let i = 0; i < 8; i++) global.push(await checkLimits(mockReq({}, `10.0.0.${i}`)));
check("global cap of 5 stops the 6th distinct caller",
  global.slice(0, 5).every((v) => v === null) && global[5]?.status === 429,
  JSON.stringify(global.map((v) => v?.status ?? "ok")));

console.log("\nfail-closed when the database is unreachable");
await new Promise((r) => shim.close(r));
const down = await checkLimits(mockReq({}, "7.7.7.7"));
check("refuses rather than spending the API key", down?.status === 503, JSON.stringify(down));

await pg.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
