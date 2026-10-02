-- Keep allocation arithmetic in numeric space for high-value bookings and index worker queues.
begin;
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.request_placement(jsonb)'::regprocedure);
 if position('amount*l.placement_share' in definition)=0 then raise exception 'Unexpected booking function; review allocation patch.';end if;
 execute replace(definition,'amount*l.placement_share','amount::numeric*l.placement_share');
end;$$;
create index payment_work_queue on public.booking_payments(livemode,state,updated_at);
create index payment_notice_queue on public.payment_notifications(created_at) where sent_at is null;
commit;
