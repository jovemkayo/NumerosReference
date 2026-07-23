-- Tighten RLS permissions so regular authenticated users cannot mutate
-- administrative business data directly from the client.

-- Helper function already exists in the initial schema:
-- public.has_role(_user_id uuid, _role app_role)

drop policy if exists "employees_insert_admin" on public.employees;
drop policy if exists "employees_update_admin" on public.employees;
drop policy if exists "carriers_insert_admin" on public.carriers;
drop policy if exists "carriers_update_admin" on public.carriers;
drop policy if exists "phone_numbers_insert_admin" on public.phone_numbers;
drop policy if exists "phone_numbers_update_admin" on public.phone_numbers;
drop policy if exists "phone_number_assignments_insert_admin" on public.phone_number_assignments;
drop policy if exists "phone_number_history_insert_admin" on public.phone_number_history;
drop policy if exists "user_roles_admin_insert" on public.user_roles;
drop policy if exists "user_roles_admin_update" on public.user_roles;
drop policy if exists "user_roles_admin_delete" on public.user_roles;

-- Employees: all authenticated users can read, only admins can create/update.
drop policy if exists "employees_ins_auth" on public.employees;
drop policy if exists "employees_upd_auth" on public.employees;

create policy "employees_insert_admin"
on public.employees
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "employees_update_admin"
on public.employees
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

-- Carriers: all authenticated users can read, only admins can create/update.
drop policy if exists "carriers_ins_auth" on public.carriers;
drop policy if exists "carriers_upd_auth" on public.carriers;

create policy "carriers_insert_admin"
on public.carriers
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "carriers_update_admin"
on public.carriers
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

-- Phone numbers: all authenticated users can read, only admins can create/update.
drop policy if exists "phones_ins_auth" on public.phone_numbers;
drop policy if exists "phones_upd_auth" on public.phone_numbers;

create policy "phone_numbers_insert_admin"
on public.phone_numbers
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "phone_numbers_update_admin"
on public.phone_numbers
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

-- Phone number assignments/history: all authenticated users can read,
-- only admins can insert directly.
drop policy if exists "assign_ins_auth" on public.phone_number_assignments;
drop policy if exists "hist_ins_auth" on public.phone_number_history;

create policy "phone_number_assignments_insert_admin"
on public.phone_number_assignments
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "phone_number_history_insert_admin"
on public.phone_number_history
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

-- User roles: users can read their own role, admins can manage all roles.
drop policy if exists "roles_admin_manage" on public.user_roles;

create policy "user_roles_admin_insert"
on public.user_roles
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "user_roles_admin_update"
on public.user_roles
for update
to authenticated
using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));

create policy "user_roles_admin_delete"
on public.user_roles
for delete
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

-- Ensure the stats view follows the permissions of the querying user.
alter view public.phone_number_stats set (security_invoker = true);