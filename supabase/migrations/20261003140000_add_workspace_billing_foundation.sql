-- Curruscos workspace / SaaS foundation
-- Keeps billing-provider details optional so the product can evolve without
-- coupling the core group model to Stripe or another provider.

create table if not exists public.workspace_plans (
  code text primary key,
  name text not null,
  description text,
  max_members integer,
  max_events_per_month integer,
  max_trips integer,
  max_storage_mb integer,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.workspace_plans(code,name,description,max_members,max_events_per_month,max_trips,max_storage_mb,features)
values
('free','Free','Para grupos que empiezan',25,20,3,250,'{"sense":true,"social":true,"travel":true,"competitions":true}'::jsonb),
('pro','Pro','Para grupos que organizan con frecuencia',100,100,20,2500,'{"sense":true,"social":true,"travel":true,"competitions":true,"advanced_analytics":true}'::jsonb),
('organization','Organization','Para comunidades y organizaciones grandes',null,null,null,25000,'{"sense":true,"social":true,"travel":true,"competitions":true,"advanced_analytics":true,"custom_branding":true}'::jsonb)
on conflict (code) do update set
name=excluded.name,description=excluded.description,max_members=excluded.max_members,
max_events_per_month=excluded.max_events_per_month,max_trips=excluded.max_trips,
max_storage_mb=excluded.max_storage_mb,features=excluded.features,active=excluded.active;

alter table public.groups add column if not exists slug text;
alter table public.groups add column if not exists created_by uuid references auth.users(id);
alter table public.groups add column if not exists timezone text not null default 'Europe/Madrid';
alter table public.groups add column if not exists default_locale text not null default 'es';
alter table public.groups add column if not exists visibility text not null default 'private';
alter table public.groups add column if not exists avatar_url text;

update public.groups g set created_by=gm.user_id
from public.group_members gm
where gm.group_id=g.id and gm.role='owner' and g.created_by is null;

update public.groups
set slug=trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g'))
where slug is null;

with duplicates as (
  select id,slug,row_number() over(partition by slug order by created_at,id) rn
  from public.groups
)
update public.groups g set slug=g.slug || '-' || d.rn
from duplicates d where g.id=d.id and d.rn>1;

alter table public.groups alter column slug set not null;
create unique index if not exists groups_slug_key on public.groups(slug);
alter table public.groups drop constraint if exists groups_visibility_check;
alter table public.groups add constraint groups_visibility_check check (visibility in ('private','unlisted','public'));

create table if not exists public.group_subscriptions (
  group_id uuid primary key references public.groups(id) on delete cascade,
  plan_code text not null references public.workspace_plans(code) default 'free',
  status text not null default 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_subscriptions_status_check check (status in ('trialing','active','past_due','cancelled','paused'))
);

insert into public.group_subscriptions(group_id,plan_code)
select id,'free' from public.groups
on conflict (group_id) do nothing;

create index if not exists group_subscriptions_plan_idx on public.group_subscriptions(plan_code);
create index if not exists groups_created_by_idx on public.groups(created_by);

alter table public.workspace_plans enable row level security;
alter table public.group_subscriptions enable row level security;

drop policy if exists workspace_plans_public_read on public.workspace_plans;
create policy workspace_plans_public_read on public.workspace_plans for select to authenticated using (active=true);

drop policy if exists group_subscriptions_member_read on public.group_subscriptions;
create policy group_subscriptions_member_read on public.group_subscriptions for select to authenticated using (
  exists (select 1 from public.group_members gm where gm.group_id=group_subscriptions.group_id and gm.user_id=auth.uid())
);

revoke all on public.workspace_plans from anon;
revoke all on public.group_subscriptions from anon;
grant select on public.workspace_plans to authenticated;
grant select on public.group_subscriptions to authenticated;