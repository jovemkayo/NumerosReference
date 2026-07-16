
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.phone_status AS ENUM ('working', 'blocked', 'under_review', 'deactivated', 'permanently_banned');
CREATE TYPE public.whatsapp_type AS ENUM ('business', 'normal', 'none');
CREATE TYPE public.history_event AS ENUM (
  'created','activated','blocked','unblocked','transferred',
  'deactivated','reactivated','banned','edited',
  'observation_added','whatsapp_changed','carrier_changed'
);

-- ============ UTIL: updated_at ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ AUTO CREATE PROFILE + ADMIN PROMOTION ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  IF lower(NEW.email) = 'kayoliveiraaa@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_all_auth" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_ins_auth" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "employees_upd_auth" ON public.employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CARRIERS ============
CREATE TABLE public.carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.carriers TO authenticated;
GRANT ALL ON public.carriers TO service_role;
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carriers_all_auth" ON public.carriers FOR SELECT TO authenticated USING (true);
CREATE POLICY "carriers_ins_auth" ON public.carriers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "carriers_upd_auth" ON public.carriers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER carriers_updated_at BEFORE UPDATE ON public.carriers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.carriers (name) VALUES ('Claro'),('Vivo'),('TIM'),('Oi');

-- ============ PHONE NUMBERS ============
CREATE TABLE public.phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  carrier_id UUID REFERENCES public.carriers(id),
  whatsapp_type whatsapp_type NOT NULL DEFAULT 'none',
  status phone_status NOT NULL DEFAULT 'working',
  current_employee_id UUID REFERENCES public.employees(id),
  previous_employee_id UUID REFERENCES public.employees(id),
  previous_number_id UUID REFERENCES public.phone_numbers(id),
  replacement_number_id UUID REFERENCES public.phone_numbers(id),
  block_reason TEXT,
  observations TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  blocked_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.phone_numbers TO authenticated;
GRANT ALL ON public.phone_numbers TO service_role;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phones_sel_auth" ON public.phone_numbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "phones_ins_auth" ON public.phone_numbers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "phones_upd_auth" ON public.phone_numbers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER phones_updated_at BEFORE UPDATE ON public.phone_numbers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_phones_current_employee ON public.phone_numbers(current_employee_id);
CREATE INDEX idx_phones_status ON public.phone_numbers(status);
CREATE INDEX idx_phones_carrier ON public.phone_numbers(carrier_id);

-- ============ ASSIGNMENTS (append-only) ============
CREATE TABLE public.phone_number_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID NOT NULL REFERENCES public.phone_numbers(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id)
);
GRANT SELECT, INSERT ON public.phone_number_assignments TO authenticated;
GRANT ALL ON public.phone_number_assignments TO service_role;
ALTER TABLE public.phone_number_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assign_sel_auth" ON public.phone_number_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assign_ins_auth" ON public.phone_number_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_assign_phone ON public.phone_number_assignments(phone_number_id);
CREATE INDEX idx_assign_employee ON public.phone_number_assignments(employee_id);

-- ============ HISTORY (append-only, imutável) ============
CREATE TABLE public.phone_number_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID NOT NULL REFERENCES public.phone_numbers(id) ON DELETE CASCADE,
  event_type history_event NOT NULL,
  from_status phone_status,
  to_status phone_status,
  from_employee_id UUID REFERENCES public.employees(id),
  to_employee_id UUID REFERENCES public.employees(id),
  reason TEXT,
  changed_fields JSONB,
  performed_by UUID REFERENCES public.profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.phone_number_history TO authenticated;
GRANT ALL ON public.phone_number_history TO service_role;
ALTER TABLE public.phone_number_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hist_sel_auth" ON public.phone_number_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "hist_ins_auth" ON public.phone_number_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_hist_phone ON public.phone_number_history(phone_number_id, performed_at DESC);
CREATE INDEX idx_hist_event ON public.phone_number_history(event_type);

-- ============ TRIGGER: registra eventos automaticamente ============
CREATE OR REPLACE FUNCTION public.log_phone_number_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor UUID := auth.uid();
  diff JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.phone_number_history (phone_number_id, event_type, to_status, to_employee_id, performed_by)
    VALUES (NEW.id, 'created', NEW.status, NEW.current_employee_id, actor);

    IF NEW.current_employee_id IS NOT NULL THEN
      INSERT INTO public.phone_number_assignments (phone_number_id, employee_id, assigned_by)
      VALUES (NEW.id, NEW.current_employee_id, actor);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: mudança de responsável
  IF NEW.current_employee_id IS DISTINCT FROM OLD.current_employee_id THEN
    UPDATE public.phone_number_assignments
      SET unassigned_at = now()
      WHERE phone_number_id = NEW.id AND unassigned_at IS NULL;
    IF NEW.current_employee_id IS NOT NULL THEN
      INSERT INTO public.phone_number_assignments (phone_number_id, employee_id, assigned_by)
      VALUES (NEW.id, NEW.current_employee_id, actor);
    END IF;
    NEW.previous_employee_id := OLD.current_employee_id;
    INSERT INTO public.phone_number_history
      (phone_number_id, event_type, from_employee_id, to_employee_id, performed_by)
    VALUES (NEW.id, 'transferred', OLD.current_employee_id, NEW.current_employee_id, actor);
  END IF;

  -- UPDATE: mudança de status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.phone_number_history
      (phone_number_id, event_type, from_status, to_status, reason, performed_by)
    VALUES (NEW.id,
      CASE NEW.status
        WHEN 'blocked' THEN 'blocked'::history_event
        WHEN 'working' THEN CASE WHEN OLD.status = 'blocked' THEN 'unblocked'::history_event ELSE 'activated'::history_event END
        WHEN 'deactivated' THEN 'deactivated'::history_event
        WHEN 'permanently_banned' THEN 'banned'::history_event
        WHEN 'under_review' THEN 'edited'::history_event
      END,
      OLD.status, NEW.status, NEW.block_reason, actor);

    IF NEW.status = 'blocked' THEN NEW.blocked_at := now(); END IF;
    IF NEW.status = 'working' AND OLD.status <> 'working' THEN NEW.activated_at := now(); END IF;
    IF NEW.status = 'deactivated' THEN NEW.deactivated_at := now(); END IF;
  END IF;

  -- Diff dos demais campos
  IF NEW.carrier_id IS DISTINCT FROM OLD.carrier_id THEN
    diff := diff || jsonb_build_object('carrier_id', jsonb_build_object('from', OLD.carrier_id, 'to', NEW.carrier_id));
    INSERT INTO public.phone_number_history (phone_number_id, event_type, performed_by, changed_fields)
    VALUES (NEW.id, 'carrier_changed', actor, jsonb_build_object('from', OLD.carrier_id, 'to', NEW.carrier_id));
  END IF;
  IF NEW.whatsapp_type IS DISTINCT FROM OLD.whatsapp_type THEN
    INSERT INTO public.phone_number_history (phone_number_id, event_type, performed_by, changed_fields)
    VALUES (NEW.id, 'whatsapp_changed', actor, jsonb_build_object('from', OLD.whatsapp_type, 'to', NEW.whatsapp_type));
  END IF;
  IF NEW.observations IS DISTINCT FROM OLD.observations AND NEW.observations IS NOT NULL THEN
    INSERT INTO public.phone_number_history (phone_number_id, event_type, reason, performed_by)
    VALUES (NEW.id, 'observation_added', NEW.observations, actor);
  END IF;
  IF NEW.phone_number IS DISTINCT FROM OLD.phone_number THEN
    INSERT INTO public.phone_number_history (phone_number_id, event_type, performed_by, changed_fields)
    VALUES (NEW.id, 'edited', actor, jsonb_build_object('phone_number', jsonb_build_object('from', OLD.phone_number, 'to', NEW.phone_number)));
  END IF;

  NEW.updated_by := actor;
  RETURN NEW;
END; $$;

CREATE TRIGGER phones_log_insert AFTER INSERT ON public.phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.log_phone_number_changes();
CREATE TRIGGER phones_log_update BEFORE UPDATE ON public.phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.log_phone_number_changes();

-- ============ VIEW: contadores ============
CREATE OR REPLACE VIEW public.phone_number_stats AS
SELECT
  p.id AS phone_number_id,
  COUNT(*) FILTER (WHERE h.event_type = 'blocked') AS block_count,
  COUNT(*) FILTER (WHERE h.event_type = 'transferred') AS transfer_count,
  COUNT(*) FILTER (WHERE h.event_type IN ('activated','unblocked','reactivated')) AS activation_count,
  COUNT(*) FILTER (WHERE h.event_type = 'deactivated') AS deactivation_count,
  MAX(h.performed_at) AS last_event_at
FROM public.phone_numbers p
LEFT JOIN public.phone_number_history h ON h.phone_number_id = p.id
GROUP BY p.id;

GRANT SELECT ON public.phone_number_stats TO authenticated;