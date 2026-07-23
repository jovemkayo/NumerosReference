alter table public.phone_number_history
add column if not exists observation text;

comment on column public.phone_number_history.observation
is 'Optional note explaining why a phone number transfer or history event happened.';

grant update (observation) on public.phone_number_history to authenticated;

drop policy if exists "phone_number_history_update_transfer_observation_admin"
on public.phone_number_history;

create policy "phone_number_history_update_transfer_observation_admin"
on public.phone_number_history
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  and event_type = 'transferred'
)
with check (
  public.has_role((select auth.uid()), 'admin')
  and event_type = 'transferred'
);