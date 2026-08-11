-- The scan claim, which is both the daily cap gate and the pessimistic row
-- (spec 0007, AC-7, AC-8, AC-18).
--
-- HAND WRITTEN, and the only file here that is. The other three are generated
-- by `npm run gen:supabase-migration` from the table declarations in
-- src/data/schema/, because they describe tables. This one describes no table:
-- it adds a function, and there is no declaration to generate it from. The
-- generator only writes its own three files, so this one sits beside them
-- untouched. Spec 0007's data model sketch says no schema change, and no
-- column, index, or constraint changes here; `meal_scans` is exactly as
-- migration 20260809000000 left it.
--
-- Why a database function rather than two PostgREST calls. The cap has to be
-- counted and the row written as one indivisible step. Counting first and
-- inserting second is the money bug spec 0007's cross check found: two requests
-- from one account both read 24, both pass, and both spend.
--
-- Why an advisory lock rather than a conditional insert alone. `insert ...
-- select ... where (count) < 25` is one statement, but it is not one *serial*
-- statement: under READ COMMITTED two concurrent transactions take their
-- snapshots before either has committed, so both see 24 and both insert. The
-- per account transaction lock below is what actually serialises them, and it
-- is held only for the length of this function. Locking on the account rather
-- than the table means two people scanning at once never wait on each other.
--
-- Why the row goes in as 'failed'. Whatever happens next (Anthropic times out,
-- the function crashes, the platform kills it), the row it leaves behind reads
-- 'failed', and a 'failed' row costs the person nothing: it is excluded from
-- the count below, so a crashed scan never eats a cap slot (AC-7).
--
-- security invoker, so this runs as the caller and `meal_scans`'s existing
-- policy is still the gate on every row it touches. There is no service role
-- key anywhere in this feature.

create or replace function public.claim_meal_scan(
  p_scan_id uuid,
  p_model text,
  p_prompt_version text,
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_cap integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user text := (select auth.jwt() ->> 'sub');
  v_existing public.meal_scans;
  v_row public.meal_scans;
begin
  -- No usable token means no identity, and every branch below needs one. The
  -- function refuses rather than falling through to a null user_id, which the
  -- policy would reject anyway but far less legibly.
  if v_user is null or v_user = '' then
    raise exception 'no session' using errcode = '42501';
  end if;

  -- AC-8. Everything from here to commit is serialised per account. The lock
  -- is released when the transaction ends, including when it aborts.
  perform pg_advisory_xact_lock(hashtext(v_user)::bigint);

  -- AC-18. One scan_id costs at most one Anthropic call, forever. The policy
  -- scopes this read to the caller, so another account's id simply is not
  -- found and is claimed fresh under this user, which is the safe answer.
  select * into v_existing from public.meal_scans where id = p_scan_id;

  if found then
    if v_existing.status <> 'failed' then
      -- Already settled. Hand back what was recorded: no Anthropic call, no
      -- charge, no second cap slot.
      return jsonb_build_object('outcome', 'recorded', 'scan', to_jsonb(v_existing));
    end if;

    -- A 'failed' row is a slot already paid for that never produced an answer,
    -- so a retry reuses it rather than claiming another.
    return jsonb_build_object('outcome', 'claimed', 'scan', to_jsonb(v_existing));
  end if;

  -- AC-7, AC-8. The count excludes 'failed', so only ok, low_confidence and
  -- unrecognised consume the day's allowance.
  insert into public.meal_scans (
    id, user_id, model, prompt_version, status, created_at, updated_at
  )
  select
    p_scan_id, v_user, p_model, p_prompt_version, 'failed',
    -- The trigger stamps updated_at on insert but deliberately leaves
    -- created_at alone, so it is supplied here, from the server's clock.
    clock_timestamp(), clock_timestamp()
  where (
    select count(*) from public.meal_scans
     where user_id = v_user
       and created_at >= p_day_start
       and created_at < p_day_end
       and status <> 'failed'
  ) < p_cap
  returning * into v_row;

  if v_row.id is null then
    -- Over the cap. No row was written, because nothing was attempted and
    -- nothing was spent.
    return jsonb_build_object('outcome', 'over_cap');
  end if;

  return jsonb_build_object('outcome', 'claimed', 'scan', to_jsonb(v_row));
end;
$$;

-- Only a signed in caller may claim, and the function's own body plus the
-- table policy decide what they may claim.
revoke all on function public.claim_meal_scan(uuid, text, text, timestamptz, timestamptz, integer) from public;
grant execute on function public.claim_meal_scan(uuid, text, text, timestamptz, timestamptz, integer) to authenticated;
