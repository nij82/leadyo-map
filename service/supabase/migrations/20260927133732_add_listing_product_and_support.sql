-- Listing product and support information is additive; existing listings stay unclassified.
alter table public.projects
  add column showroom_address text check (length(showroom_address) <= 300),
  add column product_details jsonb check (product_details is null or jsonb_typeof(product_details) = 'object');

alter table public.listings
  add column product_type text check (product_type in ('apartment', 'officetel', 'retail')),
  add column rate_options jsonb,
  add column supports jsonb;

create function private.valid_rate_options(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; labels text[] := '{}'; label text;
begin
  if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) not between 1 and 20 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    label := trim(item->>'label');
    if label is null or length(label) > 40 or label = any(labels)
       or not private.valid_rates(item->'rates') then return false; end if;
    labels := array_append(labels, label);
  end loop;
  return true;
exception when others then return false;
end $$;

create function private.valid_supports(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare kind text; item jsonb;
begin
  if jsonb_typeof(value) <> 'object' then return false; end if;
  foreach kind in array array['ad', 'db', 'daily', 'housing', 'meal'] loop
    item := value->kind;
    if jsonb_typeof(item) <> 'object'
       or coalesce(item->>'status', '') not in ('yes', 'conditional', 'no', 'unknown')
       or jsonb_typeof(item->'detail') <> 'string'
       or length(item->>'detail') > 300 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

alter table public.listings
  add constraint listing_rate_options_valid check (rate_options is null or private.valid_rate_options(rate_options)),
  add constraint listing_supports_valid check (supports is null or private.valid_supports(supports));

create function private.require_listing_catalog() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.product_type is null or new.rate_options is null or new.supports is null then
    raise exception 'Product type, rate options and support states are required';
  end if;
  return new;
end $$;
create trigger require_listing_catalog before insert on public.listings
  for each row execute function private.require_listing_catalog();

revoke all on function private.valid_rate_options(jsonb), private.valid_supports(jsonb), private.require_listing_catalog() from public;
grant execute on function private.valid_rate_options(jsonb), private.valid_supports(jsonb) to authenticated;
