begin;
alter table public.brand_profiles add column website text not null default '' check(char_length(website)<=500);
alter table public.brand_profiles add column socials jsonb not null default '[]' check(jsonb_typeof(socials)='array' and jsonb_array_length(socials)<=7 and octet_length(socials::text)<8000);
create function public.valid_brand_web_url(value text) returns boolean language sql immutable set search_path='' as $$
 select char_length(value)<=500 and value ~ '^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z0-9-]+(:[0-9]+)?([/?#][^[:space:]]*)?$';
$$;
revoke all on function public.valid_brand_web_url(text) from public;
create or replace function public.save_brand_profile(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare site text:=trim(coalesce(p->>'website','')); accounts jsonb:=coalesce(p->'socials','[]'); cleaned jsonb:='[]'; account jsonb; handle text;
begin
 if auth.uid() is null then raise exception 'Sign in to save a brand profile.'; end if;
 if site<>'' and not public.valid_brand_web_url(site) then raise exception 'Use a public http:// or https:// website URL.'; end if;
 if jsonb_typeof(accounts)<>'array' then raise exception 'Use a list of social accounts.'; end if;
 if jsonb_array_length(accounts)>7 then raise exception 'Use up to seven social accounts.'; end if;
 for account in select value from jsonb_array_elements(accounts) loop
  if jsonb_typeof(account)<>'object' or coalesce(account->>'platform','') not in ('instagram','tiktok','x','youtube','threads','facebook','linkedin') then raise exception 'Choose a supported social platform.'; end if;
  handle:=trim(coalesce(account->>'handle',''));
  if left(handle,1)='@' then handle:=substring(handle from 2); end if;
  if handle !~ '^[A-Za-z0-9_.-]{1,100}$' and not public.valid_brand_web_url(handle) then raise exception 'Enter an @username or full social page URL.'; end if;
  cleaned:=cleaned||jsonb_build_array(jsonb_build_object('platform',account->>'platform','handle',handle));
 end loop;
 insert into public.brand_profiles(id,display_name,location,bio,website,socials) values(auth.uid(),trim(p->>'display_name'),coalesce(p->>'location',''),coalesce(p->>'bio',''),site,cleaned)
 on conflict(id) do update set display_name=excluded.display_name,location=excluded.location,bio=excluded.bio,website=excluded.website,socials=excluded.socials,updated_at=now();
end;$$;
commit;
