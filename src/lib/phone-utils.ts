import type { Database } from "@/integrations/supabase/types";

export type PhoneStatus = Database["public"]["Enums"]["phone_status"];
export type WhatsappType = Database["public"]["Enums"]["whatsapp_type"];
export type HistoryEvent = Database["public"]["Enums"]["history_event"];

// Status exibidos na UI (blocked e under_review ficam ocultos, apenas para compat)
export const VISIBLE_STATUSES: PhoneStatus[] = [
  "working",
  "blocked",
  "deactivated",
  "permanently_banned",
];

export const STATUS_LABEL: Record<PhoneStatus, string> = {
  working: "Funcionando",
  blocked: "Restringido",
  under_review: "Em análise",
  deactivated: "Desativado",
  permanently_banned: "Banido permanentemente",
};

export const STATUS_COLOR: Record<PhoneStatus, string> = {
  working: "bg-emerald-500 text-white",
  blocked: "bg-orange-500 text-white",
  under_review: "bg-yellow-500 text-black",
  deactivated: "bg-gray-400 text-white",
  permanently_banned: "bg-black text-white",
};

export const STATUS_DOT: Record<PhoneStatus, string> = {
  working: "bg-emerald-500",
  blocked: "bg-orange-500",
  under_review: "bg-yellow-500",
  deactivated: "bg-gray-400",
  permanently_banned: "bg-black",
};

export const STATUS_ORDER: PhoneStatus[] = VISIBLE_STATUSES;

export const WHATSAPP_LABEL: Record<WhatsappType, string> = {
  business: "WhatsApp Business",
  normal: "WhatsApp Normal",
  none: "Sem WhatsApp",
};

export const EVENT_LABEL: Record<HistoryEvent, string> = {
  created: "Cadastrado",
  activated: "Ativado",
  blocked: "Restringido",
  unblocked: "Restrição removida",
  transferred: "Transferido",
  deactivated: "Desativado",
  reactivated: "Reativado",
  banned: "Banido",
  edited: "Editado",
  observation_added: "Observação adicionada",
  whatsapp_changed: "WhatsApp alterado",
  carrier_changed: "Operadora alterada",
};

export function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
