-- Novas colunas
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS chip_location text,
  ADD COLUMN IF NOT EXISTS restricted_at timestamptz,
  ADD COLUMN IF NOT EXISTS restriction_duration_days integer,
  ADD COLUMN IF NOT EXISTS restriction_ends_at timestamptz;

-- Migração de dados antigos "blocked" -> "restricted"
UPDATE public.phone_numbers SET status = 'restricted' WHERE status = 'blocked';

-- Trigger atualizado: trata 'restricted' e preenche restricted_at/restriction_ends_at
CREATE OR REPLACE FUNCTION public.log_phone_number_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.phone_number_history (
      phone_number_id,
      event_type,
      to_status,
      to_employee_id,
      performed_by
    )
    VALUES (
      NEW.id,
      'created',
      NEW.status,
      NEW.current_employee_id,
      actor
    );

    IF NEW.current_employee_id IS NOT NULL THEN
      INSERT INTO public.phone_number_assignments (
        phone_number_id,
        employee_id,
        assigned_by
      )
      VALUES (
        NEW.id,
        NEW.current_employee_id,
        actor
      );
    END IF;

    RETURN NEW;
  END IF;

  ------------------------------------------------------------------
  -- Transferência de colaboradora
  ------------------------------------------------------------------
  IF NEW.current_employee_id IS DISTINCT FROM OLD.current_employee_id THEN

    UPDATE public.phone_number_assignments
    SET unassigned_at = now()
    WHERE phone_number_id = NEW.id
      AND unassigned_at IS NULL;

    IF NEW.current_employee_id IS NOT NULL THEN
      INSERT INTO public.phone_number_assignments (
        phone_number_id,
        employee_id,
        assigned_by
      )
      VALUES (
        NEW.id,
        NEW.current_employee_id,
        actor
      );
    END IF;

    NEW.previous_employee_id := OLD.current_employee_id;

    INSERT INTO public.phone_number_history (
      phone_number_id,
      event_type,
      from_employee_id,
      to_employee_id,
      performed_by
    )
    VALUES (
      NEW.id,
      'transferred',
      OLD.current_employee_id,
      NEW.current_employee_id,
      actor
    );

  END IF;

  ------------------------------------------------------------------
  -- Mudança de status
  ------------------------------------------------------------------
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    INSERT INTO public.phone_number_history (
      phone_number_id,
      event_type,
      from_status,
      to_status,
      reason,
      performed_by
    )
    VALUES (
      NEW.id,
      CASE NEW.status
        WHEN 'restricted' THEN 'blocked'::history_event
        WHEN 'working' THEN
          CASE
            WHEN OLD.status = 'restricted'
              THEN 'unblocked'::history_event
            ELSE 'activated'::history_event
          END
        WHEN 'deactivated' THEN 'deactivated'::history_event
        WHEN 'permanently_banned' THEN 'banned'::history_event
      END,
      OLD.status,
      NEW.status,
      NEW.block_reason,
      actor
    );

    IF NEW.status = 'restricted' THEN

      NEW.restricted_at := COALESCE(
        NEW.restricted_at,
        now()
      );

      NEW.blocked_at := NEW.restricted_at;

      IF NEW.restriction_duration_days IS NOT NULL THEN
        NEW.restriction_ends_at :=
          NEW.restricted_at +
          (NEW.restriction_duration_days || ' days')::interval;
      END IF;

    END IF;

    IF NEW.status = 'working'
       AND OLD.status <> 'working' THEN
      NEW.activated_at := now();
    END IF;

    IF NEW.status = 'deactivated' THEN
      NEW.deactivated_at := now();
    END IF;

  END IF;

  ------------------------------------------------------------------
  -- Operadora
  ------------------------------------------------------------------
  IF NEW.carrier_id IS DISTINCT FROM OLD.carrier_id THEN

    INSERT INTO public.phone_number_history (
      phone_number_id,
      event_type,
      performed_by,
      changed_fields
    )
    VALUES (
      NEW.id,
      'carrier_changed',
      actor,
      jsonb_build_object(
        'from', OLD.carrier_id,
        'to', NEW.carrier_id
      )
    );

  END IF;

  ------------------------------------------------------------------
  -- WhatsApp
  ------------------------------------------------------------------
  IF NEW.whatsapp_type IS DISTINCT FROM OLD.whatsapp_type THEN

    INSERT INTO public.phone_number_history (
      phone_number_id,
      event_type,
      performed_by,
      changed_fields
    )
    VALUES (
      NEW.id,
      'whatsapp_changed',
      actor,
      jsonb_build_object(
        'from', OLD.whatsapp_type,
        'to', NEW.whatsapp_type
      )
    );

  END IF;

  ------------------------------------------------------------------
  -- Observações
  ------------------------------------------------------------------
  IF NEW.observations IS DISTINCT FROM OLD.observations
     AND NEW.observations IS NOT NULL THEN

    INSERT INTO public.phone_number_history (
      phone_number_id,
      event_type,
      reason,
      performed_by
    )
    VALUES (
      NEW.id,
      'observation_added',
      NEW.observations,
      actor
    );

  END IF;

  ------------------------------------------------------------------
  -- Número alterado
  ------------------------------------------------------------------
  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN

    INSERT INTO public.phone_number_history (
      phone_number_id,
      event_type,
      performed_by,
      changed_fields
    )
    VALUES (
      NEW.id,
      'edited',
      actor,
      jsonb_build_object(
        'phone_number',
        jsonb_build_object(
          'from', OLD.phone_number,
          'to', NEW.phone_number
        )
      )
    );

  END IF;

  NEW.updated_by := actor;

  RETURN NEW;

END;
$function$;