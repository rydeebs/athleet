begin;
create table public.social_ownership (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
 platform text not null check(platform in ('instagram','tiktok','x','youtube','threads')),
 handle text not null,
 code text not null default ('enduur-'||replace(gen_random_uuid()::text,'-','')),
 status text not null default 'challenge' check(status in ('challenge','pending','verified','rejected','revoked')),
 expires_at timestamptz not null default now()+interval '7 days',
 requested_at timestamptz, reviewed_at timestamptz, valid_until timestamptz,
 review_note text, unique(athlete_id,platform,handle)
);
create unique index one_verified_social_owner on public.social_ownership(platform,handle) where status='verified';
alter table public.social_ownership enable row level security;
revoke all on public.social_ownership from public,anon,authenticated;

-- Preserve evidence validation while allowing only known social fields.
alter function public.save_portal_profile(jsonb) rename to save_portal_profile_before_media_kit;
revoke all on function public.save_portal_profile_before_media_kit(jsonb) from public,anon,authenticated;
create function public.save_portal_profile(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare s jsonb; m jsonb; cleaned jsonb:='[]'; h text; k text; n numeric; d date; keys text[]:=array[]::text[];
begin
 if auth.uid() is null then raise exception 'Sign in to save a profile.';end if;
 if jsonb_typeof(coalesce(p->'socials','[]'))<>'array' or jsonb_array_length(coalesce(p->'socials','[]'))>5 then raise exception 'Use up to five social accounts.';end if;
 for s in select value from jsonb_array_elements(coalesce(p->'socials','[]')) loop
  h:=regexp_replace(trim(coalesce(s->>'handle','')),'^@','');
  if coalesce(s->>'platform','') not in ('instagram','tiktok','x','youtube','threads') or h!~'^[[:alnum:]_.·-]{1,100}$' then raise exception 'Enter a valid social username.';end if;
  if s->>'platform'='x' and h!~'^[a-zA-Z0-9_]{1,15}$' or s->>'platform' in ('instagram','threads') and h!~'^[a-zA-Z0-9._]{1,30}$' or s->>'platform'='tiktok' and h!~'^[a-zA-Z0-9._]{1,24}$' or s->>'platform'='youtube' and char_length(h) not between 3 and 30 then raise exception 'Enter a valid username for this platform.';end if;
  k:=(s->>'platform')||':'||lower(h);if k=any(keys) then raise exception 'Each social account can only be added once.';end if;keys:=array_append(keys,k);
  m:='{}';
  if s ? 'metrics' and jsonb_typeof(s->'metrics')<>'object' then raise exception 'Invalid social metrics.';end if;
  foreach k in array array['followers','avg_likes','avg_comments','avg_views','avg_story_views','post_count'] loop
   if nullif(s->'metrics'->>k,'') is not null then
    n:=(s->'metrics'->>k)::numeric;
    if n<0 or n>2000000000 or n='NaN'::numeric or k in ('followers','post_count') and n<>trunc(n) then raise exception 'Invalid social metric.';end if;
    m:=m||jsonb_build_object(k,n);
   end if;
  end loop;
  if m<>'{}'::jsonb then
   if coalesce(s->'metrics'->>'as_of','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Add a reporting date for your metrics.';end if;
   d:=(s->'metrics'->>'as_of')::date;if d>current_date then raise exception 'Reporting date must be today or earlier.';end if;
   m:=m||jsonb_build_object('as_of',d);
  end if;
  cleaned:=cleaned||jsonb_build_array(jsonb_build_object('platform',s->>'platform','handle',h,'metrics',m));
 end loop;
 perform public.save_portal_profile_before_media_kit(jsonb_set(p,'{socials}',cleaned));
 -- Changing/removing a handle revokes the check, even if later added again.
 update public.social_ownership v set status='revoked',valid_until=null where v.athlete_id=auth.uid() and not exists(select 1 from jsonb_array_elements(cleaned) entry where entry->>'platform'=v.platform and lower(entry->>'handle')=v.handle);
end;$$;
revoke all on function public.save_portal_profile(jsonb) from public;
grant execute on function public.save_portal_profile(jsonb) to authenticated;

create function public.social_ownership_action(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.social_ownership; h text:=lower(regexp_replace(trim(coalesce(p->>'handle','')),'^@',''));
begin
 if auth.uid() is null then raise exception 'Sign in to verify an account.';end if;
 -- Serialize with profile edits so a removed handle cannot be re-verified in a race.
 perform 1 from public.athlete_profiles where id=auth.uid() for update;
 if not exists(select 1 from public.athlete_profiles a,jsonb_array_elements(a.socials) s where a.id=auth.uid() and s->>'platform'=p->>'platform' and lower(s->>'handle')=h) then raise exception 'Save this social account on your profile first.';end if;
 select * into v from public.social_ownership where athlete_id=auth.uid() and platform=p->>'platform' and handle=h for update;
 if p->>'action'='start' then
  if v.id is not null and ((v.status in ('challenge','pending') and v.expires_at>now()) or (v.status='verified' and v.valid_until>now())) then return to_jsonb(v)-'review_note';end if;
  insert into public.social_ownership(athlete_id,platform,handle) values(auth.uid(),p->>'platform',h)
  on conflict(athlete_id,platform,handle) do update set code=excluded.code,status='challenge',expires_at=excluded.expires_at,requested_at=null,reviewed_at=null,valid_until=null,review_note=null returning * into v;
 elsif p->>'action'='submit' then
  if v.id is null or v.status not in ('challenge','pending') or v.expires_at<=now() then raise exception 'Generate a fresh verification code first.';end if;
  update public.social_ownership set status='pending',requested_at=coalesce(requested_at,now()) where id=v.id returning * into v;
 else raise exception 'Unknown verification action.';end if;
 return to_jsonb(v)-'review_note';
end;$$;
revoke all on function public.social_ownership_action(jsonb) from public,anon;
grant execute on function public.social_ownership_action(jsonb) to authenticated;

-- Operator-only review. Never grant this function to browser roles.
create function public.review_social_ownership(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.social_ownership; owner_id uuid;
begin
 if p->>'action'='list' then return coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('display_name',a.display_name) order by q.requested_at) from public.social_ownership q join public.athlete_profiles a on a.id=q.athlete_id where q.status='pending' and q.expires_at>now()),'[]');end if;
 select athlete_id into owner_id from public.social_ownership where id=(p->>'id')::uuid;
 perform 1 from public.athlete_profiles where id=owner_id for update;
 select * into v from public.social_ownership where id=(p->>'id')::uuid for update;
 if v.id is null or v.status<>'pending' or v.expires_at<=now() then raise exception 'No active review request.';end if;
 if p->>'action' not in ('approve','reject') or p->>'action' is null or length(trim(coalesce(p->>'note','')))<10 or length(p->>'note')>1000 then raise exception 'Supply a review decision and evidence note.';end if;
 if p->>'action'='approve' then
  if p->>'observed_code' is distinct from v.code then raise exception 'The code observed on the live public profile must match.';end if;
  if not exists(select 1 from public.athlete_profiles a,jsonb_array_elements(a.socials) s where a.id=v.athlete_id and s->>'platform'=v.platform and lower(s->>'handle')=v.handle) then raise exception 'Account is no longer on this profile.';end if;
  update public.social_ownership set status='revoked' where platform=v.platform and handle=v.handle and status='verified' and valid_until<=now();
 end if;
 update public.social_ownership set status=case when p->>'action'='approve' then 'verified' else 'rejected' end,reviewed_at=now(),valid_until=case when p->>'action'='approve' then now()+interval '90 days' end,review_note=p->>'note' where id=v.id returning * into v;
 return to_jsonb(v);
end;$$;
revoke all on function public.review_social_ownership(jsonb) from public,anon,authenticated;
grant execute on function public.review_social_ownership(jsonb) to service_role;

alter function public.portal_snapshot() rename to portal_snapshot_before_media_kit;
revoke all on function public.portal_snapshot_before_media_kit() from public,anon,authenticated;
create function public.portal_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snap jsonb:=public.portal_snapshot_before_media_kit();
begin
 return snap||jsonb_build_object(
 'social_ownership',coalesce((select jsonb_agg(jsonb_build_object('athlete_id',v.athlete_id,'platform',v.platform,'handle',v.handle,'status','verified','reviewed_at',v.reviewed_at,'valid_until',v.valid_until)) from public.social_ownership v where v.status='verified' and v.valid_until>now() and (v.athlete_id=auth.uid() or exists(select 1 from jsonb_array_elements(snap->'listings') l where l->>'athlete_id'=v.athlete_id::text))),'[]'),
 'my_social_reviews',coalesce((select jsonb_agg(to_jsonb(v)-'review_note') from public.social_ownership v where v.athlete_id=auth.uid()),'[]'));
end;$$;
revoke all on function public.portal_snapshot() from public;
grant execute on function public.portal_snapshot() to anon,authenticated;
commit;
