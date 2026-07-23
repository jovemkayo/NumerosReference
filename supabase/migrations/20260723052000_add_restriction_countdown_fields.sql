-- Add explicit restriction review state and make restriction countdowns
-- independent from the old fixed "duration in days" workflow.

alter table public.phone_numbers
  add column if not exists restriction_under_review boolean not null default false;

create index if not exists idx_phones_restriction_ends_at
on public.phone_numbers(restriction_ends_at)
where status = 'blocked';

update public.phone_numbers
set status = 'blocked'
where status::text = 'restricted';

-- Keep restriction timestamps consistent for the current UI status model.
-- The app uses "blocked" as the visible "Restringido" status.
create or replace function public.log_phone_number_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.phone_number_history (
      phone_number_id,
      event_type,
      to_status,
      to_employee_id,
      performed_by
    )
    values (
      new.id,
      'created',
      new.status,
      new.current_employee_id,
      actor
    );

    if new.current_employee_id is not null then
      insert into public.phone_number_assignments (
        phone_number_id,
        employee_id,
        assigned_by
      )
      values (
        new.id,
        new.current_employee_id,
        actor
      );
    end if;

    if new.status = 'blocked' then
      new.restricted_at := coalesce(new.restricted_at, now());
      new.blocked_at := coalesce(new.blocked_at, new.restricted_at);
    else
      new.restricted_at := null;
      new.restriction_duration_days := null;
      new.restriction_ends_at := null;
      new.restriction_under_review := false;
    end if;

    return new;
  end if;

  ------------------------------------------------------------------
  -- Transferencia de colaboradora
  ------------------------------------------------------------------
  if new.current_employee_id is distinct from old.current_employee_id then
    update public.phone_number_assignments
    set unassigned_at = now()
    where phone_number_id = new.id
      and unassigned_at is null;

    if new.current_employee_id is not null then
      insert into public.phone_number_assignments (
        phone_number_id,
        employee_id,
        assigned_by
      )
      values (
        new.id,
        new.current_employee_id,
        actor
      );
    end if;

    new.previous_employee_id := old.current_employee_id;

    insert into public.phone_number_history (
      phone_number_id,
      event_type,
      from_employee_id,
      to_employee_id,
      performed_by
    )
    values (
      new.id,
      'transferred',
      old.current_employee_id,
      new.current_employee_id,
      actor
    );
  end if;

  ------------------------------------------------------------------
  -- Mudanca de status
  ------------------------------------------------------------------
  if new.status is distinct from old.status then
    insert into public.phone_number_history (
      phone_number_id,
      event_type,
      from_status,
      to_status,
      reason,
      performed_by
    )
    values (
      new.id,
      case new.status
        when 'blocked' then 'blocked'::history_event
        when 'working' then
          case
            when old.status = 'blocked' then 'unblocked'::history_event
            else 'activated'::history_event
          end
        when 'deactivated' then 'deactivated'::history_event
        when 'permanently_banned' then 'banned'::history_event
        when 'under_review' then 'edited'::history_event
        else 'edited'::history_event
      end,
      old.status,
      new.status,
      new.block_reason,
      actor
    );

    if new.status = 'blocked' then
      new.restricted_at := coalesce(new.restricted_at, now());
      new.blocked_at := coalesce(new.blocked_at, new.restricted_at);
      new.restriction_duration_days := null;
    else
      new.restricted_at := null;
      new.restriction_duration_days := null;
      new.restriction_ends_at := null;
      new.restriction_under_review := false;
    end if;

    if new.status = 'working' and old.status <> 'working' then
      new.activated_at := now();
    end if;

    if new.status = 'deactivated' then
      new.deactivated_at := now();
    end if;
  elsif new.status = 'blocked' then
    new.restricted_at := coalesce(new.restricted_at, old.restricted_at, old.blocked_at, now());
    new.blocked_at := coalesce(new.blocked_at, new.restricted_at);
    new.restriction_duration_days := null;
  elsif new.status <> 'blocked' then
    new.restriction_under_review := false;
  end if;

  ------------------------------------------------------------------
  -- Operadora
  ------------------------------------------------------------------
  if new.carrier_id is distinct from old.carrier_id then
    insert into public.phone_number_history (
      phone_number_id,
      event_type,
      performed_by,
      changed_fields
    )
    values (
      new.id,
      'carrier_changed',
      actor,
      jsonb_build_object(
        'from', old.carrier_id,
        'to', new.carrier_id
      )
    );
  end if;

  ------------------------------------------------------------------
  -- WhatsApp
  ------------------------------------------------------------------
  if new.whatsapp_type is distinct from old.whatsapp_type then
    insert into public.phone_number_history (
      phone_number_id,
      event_type,
      performed_by,
      changed_fields
    )
    values (
      new.id,
      'whatsapp_changed',
      actor,
      jsonb_build_object(
        'from', old.whatsapp_type,
        'to', new.whatsapp_type
      )
    );
  end if;

  ------------------------------------------------------------------
  -- Observacoes
  ------------------------------------------------------------------
  if new.observations is distinct from old.observations
     and new.observations is not null then
    insert into public.phone_number_history (
      phone_number_id,
      event_type,
      reason,
      performed_by
    )
    values (
      new.id,
      'observation_added',
      new.observations,
      actor
    );
  end if;

  ------------------------------------------------------------------
  -- Numero editado
  ------------------------------------------------------------------
  if new.phone_number is distinct from old.phone_number then
    insert into public.phone_number_history (
      phone_number_id,
      event_type,
      performed_by,
      changed_fields
    )
    values (
      new.id,
      'edited',
      actor,
      jsonb_build_object(
        'phone_number',
        jsonb_build_object(
          'from', old.phone_number,
          'to', new.phone_number
        )
      )
    );
  end if;

  new.updated_by := actor;
  return new;
end;
$function$;
