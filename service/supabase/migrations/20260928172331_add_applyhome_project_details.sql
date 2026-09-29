-- Preserve operator-entered product details separately from imported notices.
alter table public.projects
  add column applyhome_summary jsonb
    check (applyhome_summary is null or jsonb_typeof(applyhome_summary) = 'object'),
  add column applyhome_details jsonb
    check (applyhome_details is null or jsonb_typeof(applyhome_details) = 'object');
