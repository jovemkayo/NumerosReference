create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  chip_capacity integer not null default 2,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_chip_capacity_check check (chip_capacity between 1 and 2)
);

grant select, insert, update on public.devices to authenticated;
grant all on public.devices to service_role;

alter table public.devices enable row level security;

create policy "devices_select_auth"
on public.devices
for select
to authenticated
using (true);

create policy "devices_insert_admin"
on public.devices
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "devices_update_admin"
on public.devices
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

drop trigger if exists devices_updated_at on public.devices;
create trigger devices_updated_at
before update on public.devices
for each row
execute function public.set_updated_at();

insert into public.devices (name, chip_capacity)
values
  ('ANNA 01', 2),
  ('LAYS 01', 2),
  ('LAYS 02', 2),
  ('GILMARA', 2),
  ('MAGA 01', 2),
  ('MAGA 02', 2),
  ('FIAMA 01', 2),
  ('REFERENCE 01', 2),
  ('PAULA 01', 2),
  ('PAULA 02', 2),
  ('MARIANA 01', 2),
  ('MARIANA 02', 2),
  ('LALA 01', 2),
  ('LUIZA 01', 2)
on conflict (name) do update
set chip_capacity = excluded.chip_capacity,
    is_active = true;

alter table public.phone_numbers
add column if not exists device_id uuid references public.devices(id),
add column if not exists device_slot integer,
add constraint phone_numbers_device_slot_check check (device_slot in (1, 2)),
add constraint phone_numbers_device_slot_pair_check check (
  (device_id is null and device_slot is null)
  or (device_id is not null and device_slot is not null)
);

create unique index if not exists phone_numbers_device_slot_unique
on public.phone_numbers(device_id, device_slot)
where device_id is not null and device_slot is not null;

create index if not exists idx_phone_numbers_device
on public.phone_numbers(device_id);