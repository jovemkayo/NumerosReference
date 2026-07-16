
# Sistema: Controle de Números WhatsApp

Conforme solicitado, apresento **primeiro a modelagem completa do banco de dados** para sua aprovação. **Nada será criado no Supabase até você aprovar.**

Depois da aprovação, implementarei em etapas nesta ordem:
1. Banco de dados (migrations + RLS)
2. Login e permissões (admin / usuário comum)
3. Dashboard (centrado nas funcionárias)
4. Módulo de Números (CRUD, status, edição)
5. Histórico / Linha do tempo
6. Transferências
7. Filtros, pesquisa global, ordenações personalizáveis
8. Relatórios
9. Modo claro/escuro e refinamentos de UI responsiva

---

## Princípios da modelagem

- **Centrada no número telefônico**, mas visualização centrada em funcionárias via relacionamento.
- **Nada é apagado**: usamos `is_active` (soft delete) + status. Sem `DELETE` no fluxo do app.
- **Histórico imutável**: tabela append-only registrando cada evento.
- **Contadores derivados** (bloqueios, transferências, ativações, desativações) calculados a partir do histórico — nunca perdemos precisão.
- **Atribuição atual** vs **histórico de atribuições**: número não pertence à funcionária, apenas é atribuído.

---

## Tabelas

### 1. `profiles` (usuários do sistema)
- `id` uuid PK → `auth.users(id)`
- `full_name` text
- `email` text
- `is_active` boolean default true
- `created_at`, `updated_at` timestamptz

### 2. `user_roles` (permissões — tabela separada por segurança)
- `id` uuid PK
- `user_id` uuid → `auth.users(id)`
- `role` enum `app_role`: `admin` | `user`
- unique(`user_id`, `role`)

### 3. `employees` (funcionárias)
- `id` uuid PK
- `name` text
- `is_active` boolean default true (desativação, nunca deletar)
- `notes` text
- `created_at`, `updated_at`, `created_by` (uuid → profiles)

### 4. `carriers` (operadoras — administrável pelo cliente)
- `id` uuid PK
- `name` text unique (Vivo, Claro, TIM, Oi, etc.)
- `is_active` boolean

### 5. `phone_numbers` (números telefônicos — entidade central)
- `id` uuid PK
- `phone_number` text unique (formato E.164)
- `carrier_id` uuid → carriers
- `whatsapp_type` enum: `business` | `normal` | `none`
- `status` enum `phone_status`: `working` | `blocked` | `under_review` | `deactivated` | `permanently_banned`
- `current_employee_id` uuid → employees (nullable — pode estar sem responsável)
- `previous_employee_id` uuid → employees (nullable — última responsável anterior)
- `previous_number_id` uuid → phone_numbers (nullable — número que este substituiu)
- `replacement_number_id` uuid → phone_numbers (nullable — número que substituiu este)
- `block_reason` text (nullable, último motivo)
- `observations` text
- `registered_at` timestamptz default now()
- `activated_at`, `blocked_at`, `deactivated_at` timestamptz (últimas datas)
- `created_at`, `updated_at`, `updated_by`

*(Contadores — bloqueios, transferências, ativações, desativações — vêm de views/consultas sobre `phone_number_history`, garantindo consistência absoluta. Se preferir campos materializados, marco como opção.)*

### 6. `phone_number_assignments` (histórico de atribuições — append-only)
- `id` uuid PK
- `phone_number_id` uuid → phone_numbers
- `employee_id` uuid → employees
- `assigned_at` timestamptz
- `unassigned_at` timestamptz (nullable — nulo = atribuição atual)
- `assigned_by` uuid → profiles

*Permite reconstruir qualquer momento: "quem tinha este número em X data?"*

### 7. `phone_number_history` (linha do tempo — append-only, imutável)
- `id` uuid PK
- `phone_number_id` uuid → phone_numbers
- `event_type` enum `history_event`: `created` | `activated` | `blocked` | `unblocked` | `transferred` | `deactivated` | `reactivated` | `banned` | `edited` | `observation_added` | `whatsapp_changed` | `carrier_changed`
- `from_status` phone_status (nullable)
- `to_status` phone_status (nullable)
- `from_employee_id` uuid → employees (nullable)
- `to_employee_id` uuid → employees (nullable)
- `reason` text (nullable — motivo de bloqueio, obs., etc.)
- `changed_fields` jsonb (nullable — diff estruturado para edições)
- `performed_by` uuid → profiles
- `performed_at` timestamptz default now()

**Sem UPDATE, sem DELETE nesta tabela** (garantido via RLS/policies).

### 8. `audit_log` (opcional — auditoria global de todas as ações)
- `id`, `table_name`, `record_id`, `action`, `old_data` jsonb, `new_data` jsonb, `performed_by`, `performed_at`

---

## Enums

```
app_role: admin, user
phone_status: working, blocked, under_review, deactivated, permanently_banned
whatsapp_type: business, normal, none
history_event: created, activated, blocked, unblocked, transferred,
               deactivated, reactivated, banned, edited,
               observation_added, whatsapp_changed, carrier_changed
```

---

## Relacionamentos (resumo)

```text
auth.users ─┬─ profiles
            └─ user_roles

employees ──┬─< phone_numbers.current_employee_id
            ├─< phone_numbers.previous_employee_id
            ├─< phone_number_assignments
            └─< phone_number_history (from/to)

phone_numbers ─┬─< phone_number_assignments
               ├─< phone_number_history
               ├── previous_number_id (auto-ref)
               └── replacement_number_id (auto-ref)

carriers ──< phone_numbers
profiles ──< phone_number_history.performed_by
```

---

## Regras de negócio (aplicadas via triggers)

1. **Trigger em `phone_numbers`**: qualquer INSERT/UPDATE gera automaticamente linha em `phone_number_history` com `changed_fields` (diff) e `performed_by`.
2. **Trigger em mudança de `current_employee_id`**: fecha assignment atual (`unassigned_at = now()`) e abre novo em `phone_number_assignments`; grava evento `transferred` no histórico.
3. **Trigger em mudança de `status`**: grava evento correspondente (`blocked`, `activated`, `deactivated`, etc.) e atualiza a data respectiva (`blocked_at`, `activated_at`…).
4. **Contadores**: expostos via view `phone_number_stats` (COUNT por event_type no histórico). Zero risco de dessincronização.
5. **Proteção do histórico**: policies bloqueiam UPDATE/DELETE em `phone_number_history` e `phone_number_assignments`.

---

## Segurança (RLS)

- **admin**: acesso total (SELECT/INSERT/UPDATE em tudo, exceto DELETE em qualquer lugar).
- **user (comum)**: SELECT em tudo; INSERT/UPDATE em `phone_numbers`, `employees`, `phone_number_history`; NUNCA gerencia `user_roles`.
- Função `has_role(uuid, app_role)` SECURITY DEFINER para evitar recursão em policies.
- Nenhum role tem permissão DELETE em nenhuma tabela.

---

## Views auxiliares

- `phone_number_stats` — contadores por número (bloqueios, transferências, ativações, desativações).
- `employee_dashboard` — por funcionária: total, funcionando, bloqueados, em análise, desativados, banidos.
- `recent_changes` — últimas N entradas do histórico com joins.

---

## Perguntas para você antes de eu criar as migrations

1. **Operadoras** — devo pré-cadastrar Vivo/Claro/TIM/Oi ou deixar o cliente cadastrar tudo do zero?
2. **Contadores materializados** — prefere que os totais fiquem calculados via view (sempre corretos) ou como colunas em `phone_numbers` (mais rápido para listar, mais complexo para manter)? Recomendo **view**.
3. **Auditoria global (`audit_log`)** — quer essa tabela extra, ou o `phone_number_history` já é suficiente? Recomendo manter só o histórico do número para não duplicar.
4. **Primeiro usuário admin** — como quer criar? Sugestão: primeiro usuário que se cadastrar vira admin automaticamente (via trigger); demais nascem como `user` e o admin promove.

---

**Se aprovar, começo pela Etapa 1 (habilitar Lovable Cloud + criar as tabelas, enums, triggers, RLS e views acima).** Se quiser ajustes na modelagem, me diga o que mudar.
