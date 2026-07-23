-- Caixa de entrada para eventos importantes do sistema.
-- Começa com notificações de término do prazo de restrição.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  phone_number_id uuid references public.phone_numbers(id) on delete cascade,
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('restriction_expired')),
  constraint notifications_restriction_expired_unique unique (type, phone_number_id)
);

alter table public.notifications enable row level security;

grant select, insert, update, delete on public.notifications to authenticated;

drop policy if exists "notifications_admin_select" on public.notifications;
drop policy if exists "notifications_admin_insert" on public.notifications;
drop policy if exists "notifications_admin_update" on public.notifications;
drop policy if exists "notifications_admin_delete" on public.notifications;

create policy "notifications_admin_select"
on public.notifications
for select
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create policy "notifications_admin_insert"
on public.notifications
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "notifications_admin_update"
on public.notifications
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy "notifications_admin_delete"
on public.notifications
for delete
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create index if not exists notifications_read_at_created_at_idx
on public.notifications (read_at, created_at desc);

create index if not exists notifications_phone_number_id_idx
on public.notifications (phone_number_id);
