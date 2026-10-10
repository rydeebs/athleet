begin;
-- Expose only the agreed sponsor-facing price, alongside already-public marks.
-- Legacy requests without a contract have no published total. Never expose an
-- athlete's payout, fees, contact details, payment identifiers or private brief.
create or replace function public.listing_sponsor_marks(listing uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('placement',placement,'brand_name',brand_name,'brand_mark',brand_mark,'brand_artwork',brand_artwork,'status',status,'sponsor_total_cents',contract->'total_cents')),'[]'::jsonb)
 from public.sponsorship_requests where listing_id=listing and status in ('accepted','submitted','completed');
$$;
revoke all on function public.listing_sponsor_marks(uuid) from public,anon,authenticated;
commit;
