-- UNTIL policy check — initial schema.
--
-- Access model: the browser never talks to Supabase. Every write goes through a
-- Vercel function using the service role key, which bypasses RLS. RLS is therefore
-- enabled on every table with NO policies, so the anon and authenticated roles can
-- read and write nothing. If you later add a client that talks to Supabase directly,
-- that is the moment to write policies — not before.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- leads
-- The email captured at the gate, before the analysis is shown.
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null,
  source      text not null default 'gate',
  referrer    text,
  user_agent  text
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx      on public.leads (lower(email));

-- ------------------------------------------------------------ enquiries
-- The booking request. THIS TABLE HOLDS HEALTH DATA: the notes field is presented
-- to the visitor as "Symptoms, timings, or a practitioner you have seen before",
-- and the chosen services reveal what someone is seeking treatment for. Under UK
-- GDPR that is special category data (Article 9). Treat this table with the same
-- information governance as any other UNTIL clinical record: least-privilege access,
-- a stated retention period, and a route to honour erasure requests.
create table if not exists public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  club        text,
  insurer     text,
  services    text[] not null default '{}',
  notes       text,
  status      text not null default 'new'
              check (status in ('new','contacted','booked','closed')),
  handled_at  timestamptz,
  handled_by  text
);
create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);
create index if not exists enquiries_status_idx     on public.enquiries (status)
  where status = 'new';

-- Erasure helper: one call removes everything held about an address, across both
-- tables, so a subject request does not depend on someone writing ad-hoc SQL.
create or replace function public.forget_email(p_email text)
returns table (leads_deleted int, enquiries_deleted int)
language plpgsql security definer set search_path = public as $$
declare l int; e int;
begin
  delete from leads     where lower(email) = lower(p_email); get diagnostics l = row_count;
  delete from enquiries where lower(email) = lower(p_email); get diagnostics e = row_count;
  return query select l, e;
end $$;

-- ------------------------------------------------------- analysis_runs
-- Anonymous. Deliberately holds no policy text, no quotes, no policy holder, no
-- policy number, and no link to a lead or an enquiry — so it can be queried freely
-- for product insight without touching anyone's personal data. Add nothing to this
-- table that could identify a person; that is the whole point of it being separate.
create table if not exists public.analysis_runs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  insurer           text,
  plan_name         text,
  doc_type          text,
  source            text check (source in ('pdf','paste')),
  doc_chars         int,
  duration_ms       int,
  covered           int not null default 0,
  limited           int not null default 0,
  not_covered       int not null default 0,
  not_stated        int not null default 0,
  unverified_quotes int not null default 0
);
create index if not exists analysis_runs_created_at_idx on public.analysis_runs (created_at desc);
create index if not exists analysis_runs_insurer_idx    on public.analysis_runs (lower(insurer));

-- ---------------------------------------------------------- rate_limits
-- Keyed on a salted hash of the caller's IP, never the IP itself.
create table if not exists public.rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  hits         int not null default 0
);

-- Atomic: the upsert takes a row lock, so concurrent calls cannot both pass the cap.
-- Returns allowed=false on the request that exceeds p_max, not the one after it.
create or replace function public.bump_rate_limit(
  p_bucket text, p_window_seconds int, p_max int
) returns table (allowed boolean, hits int, resets_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_now   timestamptz := now();
  v_start timestamptz;
  v_hits  int;
begin
  insert into rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update set
    window_start = case when r.window_start < v_now - make_interval(secs => p_window_seconds)
                        then v_now else r.window_start end,
    hits         = case when r.window_start < v_now - make_interval(secs => p_window_seconds)
                        then 1 else r.hits + 1 end
  returning r.window_start, r.hits into v_start, v_hits;

  -- Opportunistic cleanup, so the table cannot grow without bound and no cron is needed.
  if random() < 0.01 then
    delete from rate_limits where window_start < v_now - interval '1 day';
  end if;

  return query select v_hits <= p_max, v_hits, v_start + make_interval(secs => p_window_seconds);
end $$;

-- --------------------------------------------------------------- lockdown
alter table public.leads         enable row level security;
alter table public.enquiries     enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.rate_limits   enable row level security;

revoke all on public.leads, public.enquiries, public.analysis_runs, public.rate_limits
  from anon, authenticated;
revoke all on function public.bump_rate_limit(text, int, int) from anon, authenticated;
revoke all on function public.forget_email(text) from anon, authenticated;

-- --------------------------------------------------------------- reporting
-- A view the team can read without going near the enquiries table.
create or replace view public.analysis_daily as
select date_trunc('day', created_at)::date as day,
       count(*)                            as runs,
       count(distinct lower(insurer))      as insurers,
       round(avg(covered), 1)              as avg_covered,
       round(avg(not_stated), 1)           as avg_not_stated,
       sum(unverified_quotes)              as unverified_quotes
from public.analysis_runs
group by 1 order by 1 desc;
