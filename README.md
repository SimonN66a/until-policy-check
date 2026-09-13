# UNTIL — Unlock Your Cover

Reads someone's private health insurance policy and tells them which wellness and therapy
services they can already claim for, quoting the wording in their own document behind every
verdict. Eighteen services are assessed.

Three pages share one codebase and one design system:

| Path | Page |
| --- | --- |
| `/` | The un-branded checker |
| `/bakermckenzie` | UNTIL &times; Baker McKenzie — same-building pitch for 280 Bishopsgate |
| `/meta` | UNTIL &times; Meta — King's Cross, 15 minutes from Soho |

Both co-branded pages carry a partner **logo slot** that is deliberately empty of artwork:
the partner's mark is a trademark and is not reproduced. Drop the supplied SVG or PNG in as
the background of `.partner-logo` and the lockup is finished.

PDF text is extracted **in the browser** with pdf.js, so the document itself never leaves the
visitor's machine. Only the extracted text is posted to `/api/analyse`, which calls the
Anthropic API server side.

## Deploying

`./deploy.sh` does the install, the CSS build and the deploy in one go, then prints the env
vars you still need. What follows is the same thing step by step.

Four steps. The app degrades honestly at every stage, so you can stop after any of them and
the page still works — it just does less, and says so.

### 1. Supabase

Create a project, then run `supabase/migrations/0001_init.sql` in the SQL editor
(Database → SQL Editor → New query → paste → Run). It is idempotent, so re-running it is safe.

Copy from Project Settings → API:

- the **Project URL** → `SUPABASE_URL`
- the **`service_role`** key → `SUPABASE_SERVICE_ROLE_KEY`

Take the service role key, not the anon key. It bypasses row level security, which is exactly
why it is only ever read inside a serverless function. The browser never talks to Supabase at
all, so there is no anon key in this project and nothing to leak.

### 2. Vercel

```bash
vercel link
vercel env add ANTHROPIC_API_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add RATE_LIMIT_SALT production      # openssl rand -hex 32
vercel --prod
```

`vercel.json` sets the build command (`node scripts/build-css.mjs`), the output directory and
the security headers. There is no framework and no bundler.

### 3. Set the spend ceiling

`/api/analyse` is a public endpoint spending a paid API key on every call, so it is capped in
two places. Both are environment variables you can change without redeploying logic:

| Variable | Default | What it caps |
| --- | --- | --- |
| `RATE_LIMIT_PER_IP` | 5 | Analyses per connection per window |
| `RATE_LIMIT_WINDOW_SECONDS` | 3600 | The window |
| `RATE_LIMIT_GLOBAL_PER_DAY` | 200 | **Total** analyses per day, everyone combined |

The global cap is the one that actually protects you: the per-IP limit is trivially evaded
with a proxy, the global one is not. Start it low and raise it once you see real traffic.

If the rate-limit check itself fails — Supabase unreachable — the endpoint **refuses** rather
than proceeding. That is deliberate. An unbounded bill is a worse failure than a few minutes
of "try again shortly".

### 4. Check it

Visit the deployment, click **See a worked example**. That path exercises the page without
spending an API call. Then upload a real policy and confirm a row appears in
`analysis_runs`.

## What is stored

Three tables, deliberately separated by how sensitive they are.

**`leads`** — the email from the gate screen, with a timestamp, referrer and user agent.
Ordinary marketing contact data.

**`enquiries`** — the booking request: name, email, club, insurer, chosen services, and the
free-text note. **This table holds health data.** The form labels that field *"Symptoms,
timings, or a practitioner you have seen before"*, and the chosen services reveal what someone
is seeking treatment for. Under UK GDPR that is special category data (Article 9). It needs a
stated retention period, least-privilege access, and to sit inside UNTIL's existing clinical
information governance rather than beside it. `forget_email('someone@example.com')` clears
both tables for one address, so a subject access or erasure request does not depend on someone
writing ad-hoc SQL.

**`analysis_runs`** — anonymous. Insurer, plan name, document type, the four verdict counts,
duration, and the unverified-quote count. **No policy text, no quotes, no policy holder, no
policy number, and no link to a lead or an enquiry.** That is what makes it safe to query
freely for product insight. Keep it that way: adding anything identifying to this table
defeats the reason it exists. `analysis_daily` is a ready-made view over it.

All four tables have row level security enabled with **no policies**, so the `anon` and
`authenticated` roles can read and write nothing. Only the service role gets in.

### The unverified-quote count

The most useful number in the database. Every verdict is supposed to carry a verbatim quote;
`/api/analyse` re-checks each quote against the document text and counts the ones it cannot
find. If that number starts climbing, the model is fabricating evidence and the product's core
promise is breaking. Watch it.

## Local development

```bash
npm install
npm run dev            # http://localhost:3000, with vercel.json's headers applied
```

`scripts/dev-server.mjs` serves `public/` and routes `/api/*` to the same handlers Vercel runs,
with the real security headers, so a CSP problem shows up locally rather than in production.

To run the API tests you need an empty Postgres. `supabase start` gives you one:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres npm test
```

The suite stands up its own PostgREST shim, so `supabase-js` makes real HTTP calls against a
real database rather than a mock. `npm run test:shim` starts that shim standalone — use it
with `npm run dev` when you want the local app writing to a local Postgres, not alongside
`npm test`, which would collide on the port.

The harness applies `0001_init.sql` on every run, so the schema under test can never drift
from the migration you will apply to Supabase. 24 checks cover validation, storage, the rate
limiter under concurrency, the fail-closed path, and — importantly — that no policy holder or
policy number can reach `analysis_runs`.

## The design system

The page's styling comes from `public/ds/`, the UNTIL design system extracted from what used
to be a single 964 KB `index.html`. `scripts/build-css.mjs` flattens its `@import` chain into
one `public/ds/until.css` at build time.

`index.html` is now 55 KB and the assets are separately cacheable, with a one-year immutable
cache header. The extraction was verified pixel-identical against the original at three
viewport widths in both themes.

To change how something looks, edit the file under `public/ds/css/` or `public/ds/tokens/` and
rebuild — not `index.html`.

## Model

`claude-opus-5`, adaptive thinking, medium effort. Effort is medium to stay inside the 60
second serverless limit. If analyses get cut short, raise `maxDuration` in `api/analyse.js` on
a plan that allows it before reaching for a smaller model.

## Still open

- **The gate is in the wrong place.** It sits between "I uploaded my policy" and "here is what
  you are covered for" — the highest-intent moment in the funnel, gated before the visitor has
  seen any value. Moving it after the results, or making it optional, is worth testing.
- **Nobody is notified when an enquiry arrives.** Rows land in `enquiries` and wait to be
  looked at. A Supabase database webhook to email or Slack is a small piece of work and is the
  difference between a lead pipeline and a table nobody opens.
- **No retention policy is enforced.** Nothing deletes old rows. Decide the period and add a
  scheduled job.
- **Font licensing is unverified.** Tungsten and D-DIN are licensed to UNTIL; confirm the
  licence covers the deployment domain before this goes public.
