create table if not exists public.recommendation_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  surface text not null default 'home',
  position integer not null default 0,
  recommendation_score numeric,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_recommendation_impressions_user_created on public.recommendation_impressions(user_id,created_at desc);
create index if not exists idx_recommendation_impressions_event_created on public.recommendation_impressions(event_id,created_at desc);
alter table public.recommendation_impressions enable row level security;
revoke all on public.recommendation_impressions from anon,authenticated;
create or replace function public.log_recommendation_impression(target_event_id uuid,target_surface text default 'home',target_position integer default 0,target_score numeric default null,target_reason text default null)
returns boolean language plpgsql security definer set search_path='pg_catalog','public','auth','pg_temp' as $function$
begin
  if auth.uid() is null or target_event_id is null then return false; end if;
  insert into public.recommendation_impressions(user_id,event_id,surface,position,recommendation_score,reason)
  values(auth.uid(),target_event_id,left(coalesce(nullif(trim(target_surface),''),'home'),40),greatest(0,least(100,target_position)),target_score,left(nullif(trim(target_reason),''),160));
  return true;
end;$function$;
revoke execute on function public.log_recommendation_impression(uuid,text,integer,numeric,text) from public;
grant execute on function public.log_recommendation_impression(uuid,text,integer,numeric,text) to authenticated;