-- Athleet portals. Apply once in Supabase SQL Editor or with the Supabase CLI.
-- Private request details are accessible only to the athlete and sponsor.
begin;
create table public.athlete_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 2 and 80),
 location text not null default '' check (char_length(location)<=120),
 bio text not null default '' check (char_length(bio)<=600),
 avatar jsonb not null default '{}', socials jsonb not null default '[]', audience jsonb,
 check (octet_length(avatar::text)<2000 and octet_length(socials::text)<4000 and octet_length(coalesce(audience,'{}')::text)<16000),
 updated_at timestamptz not null default now()
);
create table public.brand_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 2 and 80),
 location text not null default '' check (char_length(location)<=120),
 bio text not null default '' check (char_length(bio)<=600), updated_at timestamptz not null default now()
);
create table public.race_listings (
 id uuid primary key default gen_random_uuid(), athlete_id uuid not null references public.athlete_profiles(id),
 event_name text not null check (char_length(event_name) between 1 and 120), race_date date not null,
 location text not null check (char_length(location) between 1 and 120),
 discipline text not null check (discipline in ('Road running','Trail / ultramarathon','Triathlon','HYROX','Cycling','Other endurance')),
 distance text not null check (char_length(distance) between 1 and 100), expected_field integer check(expected_field between 1 and 1000000),
 finish_band text not null default '' check(char_length(finish_band)<=100),
 outfit text not null check(outfit in ('singlet','shirtless','sports-bra','tee','long-sleeve','tri-suit','wetsuit')),
 phase text not null default 'Full race' check(phase in ('Full race','Bike + run','Bike only','Run only','Swim only')),
 placements text[] not null check(cardinality(placements) between 1 and 6 and placements <@ array['chest','back','left-arm','right-arm','left-thigh','right-thigh']),
 asking_price integer not null check(asking_price between 25 and 1000000),
 deliverables text not null check(char_length(deliverables) between 1 and 1000),notes text not null default '' check(char_length(notes)<=1000),
 status text not null default 'draft' check(status in ('draft','published')),rules_confirmed boolean not null default false,
 check(status='draft' or rules_confirmed), created_at timestamptz not null default now()
);
create table public.sponsorship_requests (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.race_listings(id),
 sponsor_id uuid not null references public.brand_profiles(id), placement text not null,
 brand_name text not null check(char_length(brand_name) between 2 and 80), brand_mark text not null default '' check(char_length(brand_mark)<=18),
 message text not null default '' check(char_length(message)<=1500), price integer not null,
 deliverables text not null, status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','submitted','completed')),
 proof_url text check(proof_url is null or (proof_url ~ '^https://' and char_length(proof_url)<=2000)),
 proof_note text not null default '' check(char_length(proof_note)<=1500),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index one_confirmed_placement on public.sponsorship_requests(listing_id,placement) where status in ('accepted','submitted','completed');
create unique index one_open_request_per_sponsor on public.sponsorship_requests(listing_id,placement,sponsor_id) where status in ('pending','accepted','submitted','completed');
create index listings_discovery on public.race_listings(status,race_date,discipline);
create index listing_owner on public.race_listings(athlete_id);
create index requests_sponsor on public.sponsorship_requests(sponsor_id);
create table public.sponsor_shortlists(user_id uuid not null references auth.users(id) on delete cascade,listing_id uuid not null references public.race_listings(id) on delete cascade,primary key(user_id,listing_id));

alter table public.athlete_profiles enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.race_listings enable row level security;
alter table public.sponsorship_requests enable row level security;
alter table public.sponsor_shortlists enable row level security;
-- All writes go through the constrained RPC functions below. No direct table API grants.
revoke all on public.athlete_profiles,public.brand_profiles,public.race_listings,public.sponsorship_requests,public.sponsor_shortlists from public,anon,authenticated;

create function public.portal_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'profile',(select to_jsonb(p) from public.athlete_profiles p where p.id=auth.uid()),
 'brand_profile',(select to_jsonb(p) from public.brand_profiles p where p.id=auth.uid()),
 'listings',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object(
   'profile',(select to_jsonb(p) from public.athlete_profiles p where p.id=l.athlete_id),
   'reserved',coalesce((select jsonb_agg(b.placement) from public.sponsorship_requests b where b.listing_id=l.id and b.status in ('accepted','submitted','completed')),'[]'::jsonb)))
   from public.race_listings l where (l.status='published' and l.race_date>=current_date) or l.athlete_id=auth.uid()),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('listing',to_jsonb(l)) order by b.created_at desc) from public.sponsorship_requests b join public.race_listings l on l.id=b.listing_id where b.sponsor_id=auth.uid() or l.athlete_id=auth.uid()),'[]'::jsonb),
 'shortlist',coalesce((select jsonb_agg(s.listing_id) from public.sponsor_shortlists s where s.user_id=auth.uid()),'[]'::jsonb));
$$;
create function public.save_portal_profile(p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to save a profile.'; end if;
 if jsonb_typeof(coalesce(p->'socials','[]'))<>'array' or jsonb_array_length(coalesce(p->'socials','[]'))>5 then raise exception 'Use up to five social accounts.'; end if;
 if jsonb_typeof(coalesce(p->'avatar','{}'))<>'object' or exists(select 1 from jsonb_array_elements(coalesce(p->'socials','[]')) s where jsonb_typeof(s)<>'object' or coalesce(s->>'platform','') not in ('instagram','tiktok','x','youtube','threads') or coalesce(char_length(s->>'handle'),0) not between 1 and 100) then raise exception 'Invalid avatar or social accounts.'; end if;
 if p->'audience' is not null and p->'audience'<>'null'::jsonb and (coalesce((p->'audience'->>'total')::bigint,-1) not between 0 and 10000000000) then raise exception 'Invalid audience total.'; end if;
 insert into public.athlete_profiles(id,display_name,location,bio,avatar,socials,audience)
 values(auth.uid(),trim(p->>'display_name'),coalesce(p->>'location',''),coalesce(p->>'bio',''),coalesce(p->'avatar','{}'),coalesce(p->'socials','[]'),p->'audience')
 on conflict(id) do update set display_name=excluded.display_name,location=excluded.location,bio=excluded.bio,avatar=excluded.avatar,socials=excluded.socials,audience=excluded.audience,updated_at=now();
end;$$;
create function public.save_brand_profile(p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to save a brand profile.'; end if;
 insert into public.brand_profiles(id,display_name,location,bio) values(auth.uid(),trim(p->>'display_name'),coalesce(p->>'location',''),coalesce(p->>'bio',''))
 on conflict(id) do update set display_name=excluded.display_name,location=excluded.location,bio=excluded.bio,updated_at=now();
end;$$;
create function public.save_race_listing(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; owner_id uuid; selected text[];
begin
 if auth.uid() is null then raise exception 'Sign in to save a race.'; end if;
 if not exists(select 1 from public.athlete_profiles where id=auth.uid()) then raise exception 'Save your profile before adding a race.'; end if;
 if (p->>'race_date')::date<current_date then raise exception 'Choose an upcoming race date.'; end if;
 select array_agg(value) into selected from jsonb_array_elements_text(p->'placements');
 if selected is null or cardinality(selected)<>(select count(distinct v) from unnest(selected) v) then raise exception 'Choose distinct available placements.'; end if;
 if nullif(p->>'id','') is not null then
  rid:=(p->>'id')::uuid;
  select athlete_id into owner_id from public.race_listings where id=rid for update;
  if owner_id is distinct from auth.uid() then raise exception 'This listing belongs to another athlete.'; end if;
  if exists(select 1 from public.sponsorship_requests where listing_id=rid and status in ('pending','accepted','submitted','completed')) then raise exception 'Resolve existing requests before editing. Confirmed listings are locked.'; end if;
 else rid:=gen_random_uuid(); end if;
 insert into public.race_listings(id,athlete_id,event_name,race_date,location,discipline,distance,expected_field,finish_band,outfit,phase,placements,asking_price,deliverables,notes,status,rules_confirmed)
 values(rid,auth.uid(),trim(p->>'event_name'),(p->>'race_date')::date,trim(p->>'location'),p->>'discipline',p->>'distance',nullif(p->>'expected_field','')::integer,coalesce(p->>'finish_band',''),p->>'outfit',p->>'phase',selected,(p->>'asking_price')::integer,p->>'deliverables',coalesce(p->>'notes',''),p->>'status',coalesce((p->>'rules_confirmed')::boolean,false))
 on conflict(id) do update set event_name=excluded.event_name,race_date=excluded.race_date,location=excluded.location,discipline=excluded.discipline,distance=excluded.distance,expected_field=excluded.expected_field,finish_band=excluded.finish_band,outfit=excluded.outfit,phase=excluded.phase,placements=excluded.placements,asking_price=excluded.asking_price,deliverables=excluded.deliverables,notes=excluded.notes,status=excluded.status,rules_confirmed=excluded.rules_confirmed;
 return rid;
end;$$;
create function public.set_shortlist(p jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to save athletes.'; end if;
 if (p->>'on')::boolean then
  if not exists(select 1 from public.race_listings where id=(p->>'listing_id')::uuid and status='published' and race_date>=current_date) then raise exception 'This listing is unavailable.'; end if;
  insert into public.sponsor_shortlists values(auth.uid(),(p->>'listing_id')::uuid) on conflict do nothing;
 else delete from public.sponsor_shortlists where user_id=auth.uid() and listing_id=(p->>'listing_id')::uuid; end if;
end;$$;
create function public.request_placement(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.race_listings; rid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to request a placement.'; end if;
 if not exists(select 1 from public.brand_profiles where id=auth.uid()) then raise exception 'Save your brand profile first.'; end if;
 select * into l from public.race_listings where id=(p->>'listing_id')::uuid for update;
 if l.id is null or l.status<>'published' or l.race_date<current_date or l.athlete_id=auth.uid() then raise exception 'Choose another athlete’s upcoming published race.'; end if;
 if p->>'placement' is null or not (p->>'placement'=any(l.placements)) then raise exception 'This placement is unavailable.'; end if;
 if exists(select 1 from public.sponsorship_requests where listing_id=l.id and placement=p->>'placement' and status in ('accepted','submitted','completed')) then raise exception 'This placement is already reserved.'; end if;
 if (select count(*) from public.sponsorship_requests where sponsor_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Too many requests. Please try again later.'; end if;
 insert into public.sponsorship_requests(listing_id,sponsor_id,placement,brand_name,brand_mark,message,price,deliverables)
 values(l.id,auth.uid(),p->>'placement',trim(p->>'brand_name'),coalesce(p->>'brand_mark',''),coalesce(p->>'message',''),l.asking_price,l.deliverables) returning id into rid;
 return rid;
exception when unique_violation then raise exception 'You already have a request for this placement.';
end;$$;
create function public.transition_booking(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.sponsorship_requests; l public.race_listings; target text:=p->>'status';
begin
 if auth.uid() is null then raise exception 'Sign in to manage this request.'; end if;
 -- All booking mutations lock the listing first to serialize competing reservations.
 select l0.* into l from public.race_listings l0 join public.sponsorship_requests b0 on b0.listing_id=l0.id where b0.id=(p->>'id')::uuid for update of l0;
 select * into b from public.sponsorship_requests where id=(p->>'id')::uuid for update;
 if b.id is null or target is null or not (
 (l.athlete_id=auth.uid() and b.status='pending' and target in ('accepted','declined')) or
 (b.sponsor_id=auth.uid() and b.status='pending' and target='cancelled') or
 (l.athlete_id=auth.uid() and b.status='accepted' and target='submitted') or
 (b.sponsor_id=auth.uid() and b.status='submitted' and target='completed')) then raise exception 'This request can no longer be changed that way.'; end if;
 if target='accepted' then
  if l.race_date<current_date then raise exception 'This race has already passed.'; end if;
  if exists(select 1 from public.sponsorship_requests where listing_id=l.id and placement=b.placement and status in ('accepted','submitted','completed')) then raise exception 'This placement is already reserved.'; end if;
  update public.sponsorship_requests set status='declined',updated_at=now() where listing_id=l.id and placement=b.placement and status='pending' and id<>b.id;
 end if;
 if target='submitted' and (coalesce(p->>'proof_url','')!~'^https://' or char_length(p->>'proof_url')>2000) then raise exception 'Add an HTTPS link to your event photos and posts.'; end if;
 update public.sponsorship_requests set status=target,proof_url=case when target='submitted' then p->>'proof_url' else proof_url end,proof_note=case when target='submitted' then coalesce(p->>'proof_note','') else proof_note end,updated_at=now() where id=b.id;
end;$$;
revoke all on function public.portal_snapshot(),public.save_portal_profile(jsonb),public.save_brand_profile(jsonb),public.save_race_listing(jsonb),public.set_shortlist(jsonb),public.request_placement(jsonb),public.transition_booking(jsonb) from public;
grant execute on function public.portal_snapshot() to anon,authenticated;
grant execute on function public.save_portal_profile(jsonb),public.save_brand_profile(jsonb),public.save_race_listing(jsonb),public.set_shortlist(jsonb),public.request_placement(jsonb),public.transition_booking(jsonb) to authenticated;
commit;
