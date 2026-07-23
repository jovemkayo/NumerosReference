import type { Database } from "@/integrations/supabase/types";

export type PhoneStatus = Database["public"]["Enums"]["phone_status"];
export type WhatsappType = Database["public"]["Enums"]["whatsapp_type"];
export type HistoryEvent = Database["public"]["Enums"]["history_event"];

// Status exibidos na UI
export const VISIBLE_STATUSES: PhoneStatus[] = [
  "working",
  "blocked",
  "under_review",
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

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = date.getFullYear();
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function getEffectivePhoneStatus(
  status: PhoneStatus,
  restrictionEndsAt?: string | null,
  now: Date = new Date(),
): PhoneStatus {
  if (status === "blocked" && restrictionEndsAt) {
    const endsAt = new Date(restrictionEndsAt);
    if (!Number.isNaN(endsAt.getTime()) && endsAt.getTime() <= now.getTime()) {
      return "working";
    }
  }

  return status;
}

export function isRestrictionExpired(
  status: PhoneStatus | string | null | undefined,
  restrictionEndsAt?: string | null,
  now: Date = new Date(),
): boolean {
  return (
    status === "blocked" &&
    getEffectivePhoneStatus(status as PhoneStatus, restrictionEndsAt, now) === "working"
  );
}

export function formatRestrictionCountdown(
  restrictionEndsAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!restrictionEndsAt) return "Sem prazo definido";

  const endsAt = new Date(restrictionEndsAt);
  if (Number.isNaN(endsAt.getTime())) return "Prazo inválido";

  const remainingMs = endsAt.getTime() - now.getTime();
  if (remainingMs <= 0) return "Restrição expirada";

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${padDatePart(hours)}h ${padDatePart(minutes)}min`;
  if (hours > 0) return `${hours}h ${padDatePart(minutes)}min`;
  return `${minutes}min`;
}

export function toDateTimeLocalValue(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function toBrazilDateTimeInputValue(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "";

  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = date.getFullYear();
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function parseBrazilDateTimeInput(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4] ?? "0");
  const minute = Number(match[5] ?? "0");

  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
}
