-- Optional measurements and evidence-backed past results. Apply after 202609300001.
begin;
alter table public.athlete_profiles add column height_cm numeric check(height_cm between 80 and 260), add column weight_kg numeric check(weight_kg between 25 and 350), add column performances jsonb not null default '[]' check(jsonb_typeof(performances)='array' and jsonb_array_length(performances)<=12 and octet_length(performances::text)<64000);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('performance-evidence','performance-evidence',false,2097152,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];
create or replace function public.save_portal_profile(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb; results jsonb:=coalesce(p->'performances','[]'::jsonb); cleaned jsonb:='[]'::jsonb; h numeric:=nullif(p->>'height_cm','')::numeric; w numeric:=nullif(p->>'weight_kg','')::numeric;
begin
 if auth.uid() is null then raise exception 'Sign in to save a profile.'; end if;
 if jsonb_typeof(coalesce(p->'socials','[]'))<>'array' or jsonb_array_length(coalesce(p->'socials','[]'))>5 then raise exception 'Use up to five social accounts.'; end if;
 if jsonb_typeof(coalesce(p->'avatar','{}'))<>'object' or exists(select 1 from jsonb_array_elements(coalesce(p->'socials','[]')) s where jsonb_typeof(s)<>'object' or coalesce(s->>'platform','') not in ('instagram','tiktok','x','youtube','threads') or coalesce(char_length(s->>'handle'),0) not between 1 and 100) then raise exception 'Invalid avatar or social accounts.'; end if;
 if p->'audience' is not null and p->'audience'<>'null'::jsonb and (coalesce((p->'audience'->>'total')::bigint,-1) not between 0 and 10000000000) then raise exception 'Invalid audience total.'; end if;
 if h is not null and (h<80 or h>260 or h='NaN'::numeric) then raise exception 'Enter a height between 80 and 260 cm.'; end if;
 if w is not null and (w<25 or w>350 or w='NaN'::numeric) then raise exception 'Enter a weight between 25 and 350 kg.'; end if;
 if jsonb_typeof(results)<>'array' then raise exception 'Results must be an array.'; end if;
 if jsonb_array_length(results)>12 then raise exception 'Add up to 12 past results.'; end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(results) x)<>jsonb_array_length(results) then raise exception 'Results must have distinct IDs.'; end if;
 for r in select value from jsonb_array_elements(results) loop
  if jsonb_typeof(r)<>'object' or nullif(r->>'id','') is null then raise exception 'Invalid result.'; end if;
  perform (r->>'id')::uuid;
  if coalesce(char_length(trim(r->>'event_name')),0) not between 1 and 120 or coalesce(char_length(trim(r->>'location')),0) not between 1 and 120 or coalesce(char_length(trim(r->>'distance')),0) not between 1 and 100 then raise exception 'Add an event, location and distance for each result.'; end if;
  if coalesce(r->>'discipline','') not in ('Road running','Trail / ultramarathon','Triathlon','HYROX','Cycling','Other endurance') then raise exception 'Invalid result discipline.'; end if;
  if coalesce(r->>'year','')!~'^[0-9]{4}$' or (r->>'year')::integer not between 1950 and extract(year from current_date)::integer then raise exception 'Choose the year of a completed race.'; end if;
  if coalesce(r->>'place','')!~'^[0-9]{1,7}$' or (r->>'place')::integer not between 1 and 1000000 then raise exception 'Enter a valid placing.'; end if;
  if coalesce(r->>'ranking','') not in ('Overall','Gender','Age group','Division') or char_length(coalesce(r->>'division',''))>100 or (r->>'ranking'<>'Overall' and coalesce(trim(r->>'division'),'')='') then raise exception 'Name the ranking category or division.'; end if;
  if nullif(r->>'field_size','') is not null and ((r->>'field_size')!~'^[0-9]{1,7}$' or (r->>'field_size')::integer not between (r->>'place')::integer and 1000000) then raise exception 'Field size must be at least your placing.'; end if;
  if coalesce(r->>'finish_time','')<>'' and (r->>'finish_time')!~'^[0-9]{1,3}:[0-5][0-9]:[0-5][0-9]$' then raise exception 'Use H:MM:SS for finish time.'; end if;
  if coalesce(r->>'evidence_path','')!~('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$') or not exists(select 1 from storage.objects o where o.bucket_id='performance-evidence' and o.name=r->>'evidence_path' and o.metadata->>'mimetype'='image/jpeg' and (o.metadata->>'size')::bigint between 1 and 2097152) then raise exception 'Each result requires an uploaded evidence image owned by you.'; end if;
  cleaned:=cleaned||jsonb_build_array(jsonb_build_object('id',r->>'id','event_name',trim(r->>'event_name'),'location',trim(r->>'location'),'discipline',r->>'discipline','distance',trim(r->>'distance'),'year',(r->>'year')::integer,'place',(r->>'place')::integer,'ranking',r->>'ranking','division',coalesce(r->>'division',''),'field_size',nullif(r->>'field_size','')::integer,'finish_time',coalesce(r->>'finish_time',''),'evidence_path',r->>'evidence_path'));
 end loop;
 insert into public.athlete_profiles(id,display_name,location,bio,avatar,socials,audience,height_cm,weight_kg,performances)
 values(auth.uid(),trim(p->>'display_name'),coalesce(p->>'location',''),coalesce(p->>'bio',''),coalesce(p->'avatar','{}'),coalesce(p->'socials','[]'),p->'audience',h,w,cleaned)
 on conflict(id) do update set display_name=excluded.display_name,location=excluded.location,bio=excluded.bio,avatar=excluded.avatar,socials=excluded.socials,audience=excluded.audience,height_cm=excluded.height_cm,weight_kg=excluded.weight_kg,performances=excluded.performances,updated_at=now();
end;$$;

-- Evidence is private. Only its owner and signed-in brands reviewing a live
-- listing may read it. Unattached uploads are never visible to sponsors.
create function public.can_read_performance_evidence(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (split_part(object_name,'/',1)=auth.uid()::text or (exists(select 1 from public.brand_profiles b where b.id=auth.uid()) and exists(select 1 from public.athlete_profiles p join public.race_listings l on l.athlete_id=p.id where l.status='published' and l.race_date>=current_date and exists(select 1 from jsonb_array_elements(p.performances) r where r->>'evidence_path'=object_name))));
$$;
create function public.can_delete_performance_evidence(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and split_part(object_name,'/',1)=auth.uid()::text and not exists(select 1 from public.athlete_profiles p, jsonb_array_elements(p.performances) r where r->>'evidence_path'=object_name);
$$;
revoke all on function public.can_read_performance_evidence(text),public.can_delete_performance_evidence(text) from public;
grant execute on function public.can_read_performance_evidence(text),public.can_delete_performance_evidence(text) to authenticated;
create policy "Upload own performance evidence" on storage.objects for insert to authenticated with check(bucket_id='performance-evidence' and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$'));
create policy "Read attached performance evidence" on storage.objects for select to authenticated using(bucket_id='performance-evidence' and public.can_read_performance_evidence(name));
create policy "Delete unattached own evidence" on storage.objects for delete to authenticated using(bucket_id='performance-evidence' and public.can_delete_performance_evidence(name));
commit;
