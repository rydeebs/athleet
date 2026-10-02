-- Marketplace payments: client RPCs can agree terms and submit evidence, never assert payment.
begin;
alter table public.race_listings add column placement_share integer not null default 70 check(placement_share between 0 and 100);
alter table public.sponsorship_requests add column contract jsonb;
create table public.payout_accounts(
 user_id uuid not null references auth.users(id),livemode boolean not null,stripe_account text unique,
 ready boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(user_id,livemode)
);
create table public.booking_payments(
 booking_id uuid primary key references public.sponsorship_requests(id),
 athlete_cents integer not null check(athlete_cents>0),markup_cents integer not null check(markup_cents>=0),total_cents integer not null,
 currency text not null default 'usd' check(currency='usd'),livemode boolean,
 state text not null default 'unpaid' check(state in ('unpaid','paid','review','release_ready','processing','released','refunded','partially_refunded','disputed','expired')),
 pay_by timestamptz,proof_due timestamptz,review_by timestamptz,paid_at timestamptz,
 checkout_key uuid not null default gen_random_uuid(),checkout_created_at timestamptz,checkout_expires_at timestamptz,checkout_session text unique,
 payment_intent text unique,charge_id text unique,transfer_id text unique,refund_id text,
 draft_url text,draft_approved_at timestamptz,issue text,issue_by uuid,issue_at timestamptz,
 resolution_note text,review_notified_at timestamptz,earned_cents integer,refund_cents integer not null default 0,operation_key uuid,operation_at timestamptz,
 settled_at timestamptz,updated_at timestamptz not null default now(),
 check(total_cents=athlete_cents+markup_cents),check(earned_cents between 0 and athlete_cents),check(refund_cents between 0 and total_cents)
);
create table public.payment_notifications(booking_id uuid not null references public.sponsorship_requests(id),kind text not null check(kind in ('accepted','paid','proof','issue','resolution','settled')),recipient uuid not null references auth.users(id),sent_at timestamptz,created_at timestamptz not null default now(),primary key(booking_id,kind,recipient));
create table public.payment_audit(id bigint generated always as identity primary key,booking_id uuid references public.sponsorship_requests(id),actor uuid,action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now());
alter table public.payout_accounts enable row level security;
alter table public.booking_payments enable row level security;
alter table public.payment_notifications enable row level security;
alter table public.payment_audit enable row level security;
revoke all on public.payout_accounts,public.booking_payments,public.payment_audit,public.payment_notifications from public,anon,authenticated;

-- Snapshot only participants' payment summaries; never expose service credentials or other payouts.
alter function public.portal_snapshot() rename to portal_snapshot_before_payments;
revoke all on function public.portal_snapshot_before_payments() from public,anon,authenticated;
create function public.portal_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select public.portal_snapshot_before_payments() || jsonb_build_object(
 'payments',coalesce((select jsonb_agg(to_jsonb(p)-array['checkout_key','operation_key','checkout_created_at','payment_intent','charge_id','transfer_id','refund_id','checkout_session']) from public.booking_payments p join public.sponsorship_requests b on b.id=p.booking_id join public.race_listings l on l.id=b.listing_id where auth.uid() in (b.sponsor_id,l.athlete_id)),'[]'::jsonb),
 'payout_accounts',coalesce((select jsonb_agg(jsonb_build_object('livemode',a.livemode,'ready',a.ready)) from public.payout_accounts a where a.user_id=auth.uid()),'[]'::jsonb));
$$;
revoke all on function public.portal_snapshot() from public;grant execute on function public.portal_snapshot() to anon,authenticated;

alter function public.save_race_listing(jsonb) rename to save_race_listing_before_payments;
revoke all on function public.save_race_listing_before_payments(jsonb) from public,anon,authenticated;
create function public.save_race_listing(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 rid:=public.save_race_listing_before_payments(p);
 update public.race_listings set placement_share=coalesce((p->>'placement_share')::integer,70) where id=rid;
 return rid;
end;$$;
revoke all on function public.save_race_listing(jsonb) from public;grant execute on function public.save_race_listing(jsonb) to authenticated;

alter function public.request_placement(jsonb) rename to request_placement_before_payments;
revoke all on function public.request_placement_before_payments(jsonb) from public,anon,authenticated;
create function public.request_placement(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;l public.race_listings;amount integer;
begin
 if p->>'terms_version' is distinct from '2026-10-02' then raise exception 'Accept the current booking and payment rules.';end if;
 if length(trim(coalesce(p->>'artwork_spec',''))) not between 5 and 500 then raise exception 'Agree the artwork size and placement instructions.';end if;
 rid:=public.request_placement_before_payments(p);select * into l from public.race_listings where id=(p->>'listing_id')::uuid;
 amount:=l.asking_price*100;
 if amount+round(amount*.2)::integer>99999999 then raise exception 'This amount exceeds the checkout limit. Agree a smaller race booking.';end if;
 update public.sponsorship_requests set contract=jsonb_build_object('version','2026-10-02','currency','usd','athlete_cents',amount,'total_cents',amount+round(amount*.2)::integer,'markup_bps',2000,'placement_cents',round(amount*l.placement_share/100.0)::integer,'social_cents',amount-round(amount*l.placement_share/100.0)::integer,'artwork_spec',trim(p->>'artwork_spec'),'preapproval',coalesce((p->>'preapproval')::boolean,false),'race_date',l.race_date,'event_name',l.event_name,'location',l.location,'outfit',l.outfit,'phase',l.phase,'deliverables',l.deliverables,'sponsor_agreed_at',now(),'pay_hours',48,'proof_days',7,'review_hours',72) where id=rid;
 insert into public.booking_payments(booking_id,athlete_cents,markup_cents,total_cents,proof_due) values(rid,amount,round(amount*.2)::integer,amount+round(amount*.2)::integer,(l.race_date+8)::timestamp at time zone 'UTC');
 return rid;
end;$$;
revoke all on function public.request_placement(jsonb) from public;grant execute on function public.request_placement(jsonb) to authenticated;

alter function public.transition_booking(jsonb) rename to transition_booking_before_payments;
revoke all on function public.transition_booking_before_payments(jsonb) from public,anon,authenticated;
create function public.transition_booking(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.sponsorship_requests;l public.race_listings;pay public.booking_payments;t text:=p->>'status';uid uuid:=auth.uid();
begin
 select l0.* into l from public.race_listings l0 join public.sponsorship_requests b0 on b0.listing_id=l0.id where b0.id=(p->>'id')::uuid for update of l0;
 select * into b from public.sponsorship_requests where id=(p->>'id')::uuid for update;
 select * into pay from public.booking_payments where booking_id=b.id for update;
 if uid is null or b.id is null or uid not in (b.sponsor_id,l.athlete_id) then raise exception 'Booking unavailable.';end if;
 if pay.booking_id is null then
  if t not in ('declined','cancelled') then raise exception 'This legacy request predates payment terms. Create a new request to use checkout.';end if;
  perform public.transition_booking_before_payments(p);return;
 end if;
 if t='accepted' then
  if p->>'terms_version' is distinct from b.contract->>'version' then raise exception 'Accept the booking rules.';end if;
  if l.race_date>(now() at time zone 'UTC')::date+30 or l.race_date<=(now() at time zone 'UTC')::date then raise exception 'Accept between 1 and 30 days before the race for this pilot.';end if;
  -- Ready payout account is checked again by checkout against the server-selected Stripe mode.
  if not exists(select 1 from public.payout_accounts where user_id=l.athlete_id and ready) then raise exception 'Set up athlete payouts before accepting.';end if;
  perform public.transition_booking_before_payments(p);
  update public.booking_payments set pay_by=least(now()+interval '48 hours',l.race_date::timestamp at time zone 'UTC'),updated_at=now() where booking_id=b.id;
  update public.sponsorship_requests set contract=contract||jsonb_build_object('athlete_agreed_at',now()) where id=b.id;
 elsif t='submitted' then
  if pay.state<>'paid' then raise exception 'Only funded, undisputed bookings can submit proof.';end if;
  if coalesce((p->>'complete')::boolean,false) is not true then raise exception 'Confirm that all agreed deliverables are included.';end if;
  if pay.proof_due<=now() then raise exception 'The proof deadline passed. Request a review instead.';end if;
  if (now() at time zone 'UTC')::date<l.race_date then raise exception 'Submit race proof after the event.';end if;
  if coalesce((b.contract->>'preapproval')::boolean,false) and pay.draft_approved_at is null then raise exception 'Get the required content draft approved first.';end if;
  perform public.transition_booking_before_payments(p);
  update public.booking_payments set state='review',review_by=null,updated_at=now() where booking_id=b.id;
 elsif t='completed' then
  if uid<>b.sponsor_id or b.status<>'submitted' or pay.state<>'review' then raise exception 'Only the sponsor can approve submitted, undisputed proof.';end if;
  update public.booking_payments set state='release_ready',earned_cents=athlete_cents,updated_at=now() where booking_id=b.id;
 elsif t in ('declined','cancelled') then
  perform public.transition_booking_before_payments(p);
 else raise exception 'Unsupported booking action.';end if;
 if t in ('accepted','submitted') then insert into public.payment_notifications(booking_id,kind,recipient) values(b.id,case when t='submitted' then 'proof' else 'accepted' end,b.sponsor_id) on conflict do nothing;end if;
 insert into public.payment_audit(booking_id,actor,action) values(b.id,uid,t);
end;$$;
revoke all on function public.transition_booking(jsonb) from public;grant execute on function public.transition_booking(jsonb) to authenticated;

create function public.booking_payment_action(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.sponsorship_requests;pay public.booking_payments;owner_id uuid;uid uuid:=auth.uid();a text:=p->>'action';
begin
 select l0.athlete_id into owner_id from public.race_listings l0 join public.sponsorship_requests b0 on b0.listing_id=l0.id where b0.id=(p->>'id')::uuid for update of l0;
 select * into b from public.sponsorship_requests where id=(p->>'id')::uuid for update;
 select * into pay from public.booking_payments where booking_id=b.id for update;
 if uid is null or uid not in (b.sponsor_id,owner_id) or pay.booking_id is null then raise exception 'Booking unavailable.';end if;
 if a='issue' then
  if pay.state not in ('paid','review','release_ready') then raise exception 'This payment is not available for a new review. Contact support for settled payments.';end if;
  if (pay.state='release_ready' or (pay.state='review' and pay.review_by<=now())) and uid=b.sponsor_id then raise exception 'The approval window has ended. Contact support.';end if;
  if length(trim(coalesce(p->>'reason',''))) not between 10 and 1500 then raise exception 'Describe the unmet requirement or cancellation reason (10–1500 characters).';end if;
  update public.booking_payments set state='disputed',issue=p->>'reason',issue_by=uid,issue_at=now(),review_by=null,updated_at=now() where booking_id=b.id;
 elsif a='draft' then
  if uid<>owner_id or pay.state<>'paid' or coalesce(p->>'url','')!~'^https://' or length(p->>'url')>2000 then raise exception 'Add an HTTPS draft link for a funded booking.';end if;
  update public.booking_payments set draft_url=p->>'url',draft_approved_at=null,updated_at=now() where booking_id=b.id;
 elsif a='approve-draft' then
  if uid<>b.sponsor_id or pay.state<>'paid' or pay.draft_url is null then raise exception 'No content draft is ready for approval.';end if;
  update public.booking_payments set draft_approved_at=now(),updated_at=now() where booking_id=b.id;
 else raise exception 'Unsupported payment action.';end if;
 if a='issue' then insert into public.payment_notifications(booking_id,kind,recipient) select b.id,'issue',u from unnest(array[b.sponsor_id,owner_id]) u on conflict do nothing;end if;
 insert into public.payment_audit(booking_id,actor,action,detail) values(b.id,uid,a,p-'id');
end;$$;
revoke all on function public.booking_payment_action(jsonb) from public;grant execute on function public.booking_payment_action(jsonb) to authenticated;

-- One service-only gateway owns financial state. Only the verified server invokes this.
create function public.payment_service(action text,p jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.sponsorship_requests;l public.race_listings;v public.booking_payments;a public.payout_accounts;result jsonb;mode boolean:=coalesce((p->>'livemode')::boolean,false);
begin
 if action='notification-queue' then
  return coalesce((select jsonb_agg(x) from (select n.* from public.payment_notifications n join public.booking_payments v on v.booking_id=n.booking_id where n.sent_at is null and (v.livemode=mode or v.livemode is null) order by n.created_at limit 30) x),'[]'::jsonb);
 elsif action='account-get' then
  if not exists(select 1 from public.athlete_profiles where id=(p->>'user_id')::uuid) then raise exception 'Save an athlete profile before setting up payouts.';end if;
  insert into public.payout_accounts(user_id,livemode) values((p->>'user_id')::uuid,mode) on conflict do nothing;
  select * into a from public.payout_accounts where user_id=(p->>'user_id')::uuid and livemode=mode for update;return to_jsonb(a);
 elsif action='account-save' then
  update public.payout_accounts set stripe_account=p->>'account',ready=coalesce((p->>'ready')::boolean,false),updated_at=now() where user_id=(p->>'user_id')::uuid and livemode=mode and (stripe_account is null or stripe_account=p->>'account') returning * into a;
  if a.user_id is null then raise exception 'Account mismatch.';end if;return to_jsonb(a);
 elsif action='queue' then
  return coalesce((select jsonb_agg(x) from (select booking_id,state from public.booking_payments where (livemode=mode or livemode is null) and (state in ('release_ready','processing') or (state='review' and review_by<=now()) or (state='paid' and proof_due<=now()) or (state='unpaid' and pay_by<=now())) order by updated_at limit 40) x),'[]'::jsonb);
 elsif action='review-list' then
  return coalesce((select jsonb_agg(to_jsonb(v0)||jsonb_build_object('contract',b0.contract,'proof_url',b0.proof_url,'proof_note',b0.proof_note,'brand_name',b0.brand_name,'placement',b0.placement)) from public.booking_payments v0 join public.sponsorship_requests b0 on b0.id=v0.booking_id where v0.state='disputed' and v0.livemode=mode),'[]'::jsonb);
 end if;
 -- Use the same lock order as reservation mutations.
 select l0.* into l from public.race_listings l0 join public.sponsorship_requests b0 on b0.listing_id=l0.id where b0.id=(p->>'id')::uuid for update of l0;
 select * into b from public.sponsorship_requests where id=(p->>'id')::uuid for update;
 select * into v from public.booking_payments where booking_id=b.id for update;
 if v.booking_id is null then raise exception 'Payment booking unavailable.';end if;
 if v.livemode is not null and v.livemode<>mode then raise exception 'Payment mode mismatch.';end if;
 if action='get' then null;
 elsif action='notification-sent' then
  update public.payment_notifications set sent_at=now() where booking_id=b.id and kind=p->>'kind' and recipient=(p->>'recipient')::uuid and sent_at is null;
  if found and p->>'kind'='proof' and v.state='review' and v.review_notified_at is null then update public.booking_payments set review_notified_at=now(),review_by=now()+interval '72 hours' where booking_id=b.id;end if;
 elsif action='tick' then
  if v.state='review' and v.review_by<=now() then update public.booking_payments set state='release_ready',earned_cents=athlete_cents,updated_at=now() where booking_id=b.id;
  elsif v.state='paid' and v.proof_due<=now() then update public.booking_payments set state='disputed',issue='Proof deadline passed. Manual review required.',issue_at=now(),updated_at=now() where booking_id=b.id;end if;
 elsif action='checkout-claim' then
  if b.sponsor_id<>(p->>'actor')::uuid or b.status<>'accepted' or v.state<>'unpaid' or v.pay_by<=now()+interval '31 minutes' then raise exception 'This booking is not available for checkout.';end if;
  if not exists(select 1 from public.payout_accounts where user_id=l.athlete_id and livemode=mode and ready and stripe_account is not null) then raise exception 'Athlete payout setup is incomplete.';end if;
  if l.race_date>(now() at time zone 'UTC')::date+30 then raise exception 'Payment opens 30 days before the race. Request closer to race day.';end if;
  update public.booking_payments set livemode=mode,checkout_created_at=coalesce(checkout_created_at,now()),checkout_expires_at=coalesce(checkout_expires_at,least(date_trunc('second',now())+interval '23 hours',pay_by)),updated_at=now() where booking_id=b.id;
 elsif action='checkout-save' then
  if v.checkout_key::text is distinct from p->>'key' or v.state<>'unpaid' then raise exception 'Checkout changed.';end if;
  update public.booking_payments set checkout_session=p->>'session',updated_at=now() where booking_id=b.id and (checkout_session is null or checkout_session=p->>'session');
 elsif action='checkout-reset' then
  if v.checkout_session is distinct from p->>'session' or v.state<>'unpaid' then raise exception 'Checkout changed.';end if;
  update public.booking_payments set checkout_key=gen_random_uuid(),checkout_session=null,checkout_created_at=null,checkout_expires_at=null,updated_at=now() where booking_id=b.id;
 elsif action='paid' then
  if (p->>'amount')::integer is distinct from v.total_cents or p->>'currency' is distinct from v.currency or nullif(p->>'intent','') is null or nullif(p->>'charge','') is null then raise exception 'Payment amount mismatch.';end if;
  if v.payment_intent is not null and v.payment_intent<>p->>'intent' then raise exception 'Duplicate payment needs review.';end if;
  if v.state='unpaid' and b.status='accepted' then
   update public.booking_payments set state='paid',payment_intent=p->>'intent',charge_id=p->>'charge',paid_at=now(),livemode=mode,updated_at=now() where booking_id=b.id;
  elsif v.payment_intent is null then
   update public.booking_payments set state='disputed',issue='Payment arrived after reservation closed. Refund review required.',payment_intent=p->>'intent',charge_id=p->>'charge',paid_at=now(),livemode=mode,issue_at=now(),updated_at=now() where booking_id=b.id;
  end if;
 elsif action='expire' then
  if v.state='unpaid' and v.pay_by<=now() then update public.booking_payments set state='expired',updated_at=now() where booking_id=b.id;update public.sponsorship_requests set status='cancelled',updated_at=now() where id=b.id and status='accepted';end if;
 elsif action='resolve' then
  if v.state<>'disputed' or v.transfer_id is not null or v.payment_intent is null or v.refund_cents<>0 or v.operation_key is not null then raise exception 'This case requires manual Stripe reconciliation.';end if;
  if length(coalesce(p->>'reason',''))<10 or p->>'earned_cents' is null or (p->>'earned_cents')::integer not between 0 and v.athlete_cents then raise exception 'Enter an earned amount and review explanation.';end if;
  update public.booking_payments set earned_cents=(p->>'earned_cents')::integer,resolution_note=p->>'reason',state='release_ready',updated_at=now() where booking_id=b.id;
 elsif action='settle-claim' then
  if v.state not in ('release_ready','processing') then raise exception 'Not eligible for settlement.';end if;
  if v.state='processing' then update public.booking_payments set updated_at=now() where booking_id=b.id;end if;
  if v.state='release_ready' then update public.booking_payments set state='processing',operation_key=gen_random_uuid(),operation_at=now(),earned_cents=coalesce(earned_cents,athlete_cents),updated_at=now() where booking_id=b.id;end if;
 elsif action='refund-record' then
  if v.state<>'processing' or v.operation_key::text is distinct from p->>'key' then raise exception 'Settlement changed.';end if;
  update public.booking_payments set refund_id=p->>'refund',refund_cents=(p->>'amount')::integer,updated_at=now() where booking_id=b.id;
 elsif action='settled' then
  if v.state<>'processing' or v.operation_key::text is distinct from p->>'key' then raise exception 'Settlement changed; manual reconciliation required.';end if;
  update public.booking_payments set state=case when earned_cents=0 then 'refunded' when refund_cents>0 then 'partially_refunded' else 'released' end,transfer_id=nullif(p->>'transfer',''),settled_at=now(),updated_at=now() where booking_id=b.id;
  update public.sponsorship_requests set status=case when coalesce(v.earned_cents,0)=0 then 'cancelled' else 'completed' end,updated_at=now() where id=b.id;
 elsif action='stripe-issue' then
  update public.booking_payments set state='disputed',issue=p->>'reason',issue_at=now(),updated_at=now() where booking_id=b.id;
 else raise exception 'Unsupported server payment action.';end if;
 if action in ('paid','settled','resolve','stripe-issue') or (action='tick' and v.state='paid' and v.proof_due<=now()) then
  insert into public.payment_notifications(booking_id,kind,recipient) select b.id,case action when 'resolve' then 'resolution' when 'stripe-issue' then 'issue' when 'tick' then 'issue' else action end,u from unnest(case when action='paid' then array[l.athlete_id] else array[b.sponsor_id,l.athlete_id] end) u on conflict do nothing;
 end if;
 if action<>'get' then insert into public.payment_audit(booking_id,actor,action,detail) values(b.id,nullif(p->>'actor','')::uuid,action,p-array['actor']);end if;
 select * into v from public.booking_payments where booking_id=b.id;
 select * into b from public.sponsorship_requests where id=b.id;
 select * into a from public.payout_accounts where user_id=l.athlete_id and livemode=mode;
 return to_jsonb(v)||jsonb_build_object('sponsor_id',b.sponsor_id,'athlete_id',l.athlete_id,'booking_status',b.status,'contract',b.contract,'event_name',l.event_name,'race_date',l.race_date,'stripe_account',a.stripe_account,'payout_ready',coalesce(a.ready,false));
end;$$;
revoke all on function public.payment_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.payment_service(text,jsonb) to service_role;
commit;
