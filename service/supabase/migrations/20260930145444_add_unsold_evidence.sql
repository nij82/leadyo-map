-- Official dated evidence; absence means unverified, never sold out.
alter table public.projects add column unsold_evidence jsonb
  check (unsold_evidence is null or (
    jsonb_typeof(unsold_evidence) = 'object'
    and unsold_evidence->>'status' = 'confirmed'
    and unsold_evidence ?& array['status','as_of','provider','source_url','source_address']
  ));
comment on column public.projects.unsold_evidence is
  'Dated official evidence of unsold housing at this site. Null means unverified.';
