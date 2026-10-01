-- Expanded race placements and artwork shared with sponsorship requests.
begin;
alter table public.race_listings drop constraint race_listings_placements_check;
alter table public.race_listings add constraint race_listings_placements_check check(cardinality(placements) between 1 and 16 and placements <@ array['chest','left-pec','right-pec','cleavage','back','left-shoulder','right-shoulder','left-arm','right-arm','left-forearm','right-forearm','left-calf','right-calf','left-thigh','right-thigh','butt']);
alter table public.sponsorship_requests add column brand_artwork text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('brand-artwork','brand-artwork',false,2097152,array['image/png']) on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/png'];
create function public.listing_sponsor_marks(listing uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('placement',placement,'brand_name',brand_name,'brand_mark',brand_mark,'brand_artwork',brand_artwork,'status',status)),'[]'::jsonb) from public.sponsorship_requests where listing_id=listing and status in ('accepted','submitted','completed');
$$;
revoke all on function public.listing_sponsor_marks(uuid) from public;
create or replace function public.portal_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'profile',(select to_jsonb(p) from public.athlete_profiles p where p.id=auth.uid()),
 'brand_profile',(select to_jsonb(p) from public.brand_profiles p where p.id=auth.uid()),
 'listings',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object(
   'profile',(select to_jsonb(p) from public.athlete_profiles p where p.id=l.athlete_id),
   'sponsors',public.listing_sponsor_marks(l.id),
   'reserved',coalesce((select jsonb_agg(b.placement) from public.sponsorship_requests b where b.listing_id=l.id and b.status in ('accepted','submitted','completed')),'[]'::jsonb)))
   from public.race_listings l where (l.status='published' and l.race_date>=current_date) or l.athlete_id=auth.uid()),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('listing',to_jsonb(l)||jsonb_build_object('profile',(select to_jsonb(p) from public.athlete_profiles p where p.id=l.athlete_id),'sponsors',public.listing_sponsor_marks(l.id))) order by b.created_at desc) from public.sponsorship_requests b join public.race_listings l on l.id=b.listing_id where b.sponsor_id=auth.uid() or l.athlete_id=auth.uid()),'[]'::jsonb),
 'shortlist',coalesce((select jsonb_agg(s.listing_id) from public.sponsor_shortlists s where s.user_id=auth.uid()),'[]'::jsonb));
$$;

-- Keep the existing booking validation/locking in one place, and validate the
-- optional artwork object before attaching it to the new request.
alter function public.request_placement(jsonb) rename to request_placement_without_artwork;
revoke all on function public.request_placement_without_artwork(jsonb) from public,anon,authenticated;
create function public.request_placement(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; path text:=nullif(p->>'brand_artwork','');
begin
 if auth.uid() is null then raise exception 'Sign in to request a placement.'; end if;
 if path is not null and (path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.png$') or not exists(select 1 from storage.objects o where o.bucket_id='brand-artwork' and o.name=path and o.metadata->>'mimetype'='image/png' and (o.metadata->>'size')::bigint between 1 and 2097152)) then raise exception 'Artwork must be an uploaded PNG owned by your account.'; end if;
 rid:=public.request_placement_without_artwork(p);
 update public.sponsorship_requests set brand_artwork=path where id=rid;return rid;
end;$$;
revoke all on function public.request_placement(jsonb) from public;
grant execute on function public.request_placement(jsonb) to authenticated;
create function public.can_read_brand_artwork(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (split_part(object_name,'/',1)=auth.uid()::text or exists(select 1 from public.sponsorship_requests b join public.race_listings l on l.id=b.listing_id where b.brand_artwork=object_name and (b.sponsor_id=auth.uid() or l.athlete_id=auth.uid() or (b.status in ('accepted','submitted','completed') and l.status='published' and l.race_date>=current_date and exists(select 1 from public.brand_profiles p where p.id=auth.uid())))));
$$;
create function public.can_delete_brand_artwork(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and split_part(object_name,'/',1)=auth.uid()::text and not exists(select 1 from public.sponsorship_requests where brand_artwork=object_name);
$$;
revoke all on function public.can_read_brand_artwork(text),public.can_delete_brand_artwork(text) from public;
grant execute on function public.can_read_brand_artwork(text),public.can_delete_brand_artwork(text) to authenticated;
create policy "Upload own brand artwork" on storage.objects for insert to authenticated with check(bucket_id='brand-artwork' and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.png$'));
create policy "Read shared brand artwork" on storage.objects for select to authenticated using(bucket_id='brand-artwork' and public.can_read_brand_artwork(name));
create policy "Delete unattached brand artwork" on storage.objects for delete to authenticated using(bucket_id='brand-artwork' and public.can_delete_brand_artwork(name));
commit;
