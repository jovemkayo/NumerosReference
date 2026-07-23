import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  EVENT_LABEL,
  STATUS_LABEL,
  WHATSAPP_LABEL,
  formatDateTime,
  formatPhone,
  formatRestrictionCountdown,
  getEffectivePhoneStatus,
  type HistoryEvent,
  type PhoneStatus,
  type WhatsappType,
} from "@/lib/phone-utils";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Clock3,
  HardDrive,
  History as HistoryIcon,
  Phone,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserRoundX,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Início - Controle de Números WhatsApp" },
      {
        name: "description",
        content: "Painel operacional de números, dispositivos, restrições e notificações.",
      },
    ],
  }),
  component: DashboardPage,
});

type DashboardPhone = {
  id: string;
  phone_number: string | null;
  status: PhoneStatus | string | null;
  whatsapp_type: WhatsappType | string | null;
  current_employee_id: string | null;
  device_id: string | null;
  device_slot: number | null;
  restriction_ends_at: string | null;
  restriction_under_review: boolean | null;
};

type DashboardDevice = {
  id: string;
  chip_capacity: number;
  is_active: boolean;
};

type RecentHistory = {
  id: string;
  event_type: HistoryEvent | string;
  performed_at: string;
  phone_numbers?: { phone_number?: string | null } | null;
  to?: { name?: string | null } | null;
};

type StatusCounts = Record<PhoneStatus, number>;

type AttentionItem = {
  id: string;
  phone: string;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "neutral";
  sort: number;
};

type NextRestriction = {
  id: string;
  phone: string;
  endsAt: string;
  endsAtMs: number;
};

function DashboardPage() {
  const { isAdmin } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [showAllAttention, setShowAllAttention] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const dashboardQ = useQuery({
    queryKey: ["dashboard-operational"],
    queryFn: async () => {
      const [phonesResult, devicesResult, historyResult] = await Promise.all([
        supabase
          .from("phone_numbers")
          .select(
            "id,phone_number,status,whatsapp_type,current_employee_id,device_id,device_slot,restriction_ends_at,restriction_under_review",
          ),
        supabase.from("devices").select("id,chip_capacity,is_active").order("name"),
        supabase
          .from("phone_number_history")
          .select(
            "id,event_type,performed_at,phone_numbers(phone_number),to:employees!to_employee_id(name)",
          )
          .order("performed_at", { ascending: false })
          .limit(8),
      ]);

      if (phonesResult.error) throw phonesResult.error;
      if (devicesResult.error) throw devicesResult.error;
      if (historyResult.error) throw historyResult.error;

      return {
        phones: (phonesResult.data ?? []) as DashboardPhone[],
        devices: (devicesResult.data ?? []) as DashboardDevice[],
        history: (historyResult.data ?? []) as RecentHistory[],
      };
    },
  });

  const unreadNotificationsQ = useQuery({
    queryKey: ["dashboard-unread-notifications"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);

      if (error) throw error;
      return count ?? 0;
    },
  });

  const model = useMemo(() => {
    const phones = dashboardQ.data?.phones ?? [];
    const devices = dashboardQ.data?.devices ?? [];
    const statusCounts: StatusCounts = {
      working: 0,
      blocked: 0,
      under_review: 0,
      deactivated: 0,
      permanently_banned: 0,
    };
    const whatsappCounts = new Map<string, number>();
    const attention: AttentionItem[] = [];

    let expiredRestrictions = 0;
    let restrictionsDueSoon = 0;
    let restrictionsWithoutDeadline = 0;
    let withoutEmployee = 0;
    let withoutDevice = 0;
    let occupiedSlots = 0;
    let nextRestriction: NextRestriction | null = null;

    const dayMs = 24 * 60 * 60 * 1000;

    for (const phone of phones) {
      const rawStatus = (phone.status ?? "working") as PhoneStatus;
      const effectiveStatus = getEffectivePhoneStatus(rawStatus, phone.restriction_ends_at, now);
      statusCounts[effectiveStatus] += 1;

      if (rawStatus === "blocked" && phone.restriction_under_review) {
        statusCounts.under_review += 1;
      }

      const whatsappLabel =
        WHATSAPP_LABEL[(phone.whatsapp_type ?? "none") as WhatsappType] ?? "Sem WhatsApp";
      whatsappCounts.set(whatsappLabel, (whatsappCounts.get(whatsappLabel) ?? 0) + 1);

      if (!phone.current_employee_id) {
        withoutEmployee += 1;
        attention.push({
          id: phone.id,
          phone: phone.phone_number ?? "",
          label: "Sem colaboradora",
          detail: "Número sem responsável atual",
          severity: "warning",
          sort: 30,
        });
      }

      if (!phone.device_id) {
        withoutDevice += 1;
        attention.push({
          id: phone.id,
          phone: phone.phone_number ?? "",
          label: "Sem dispositivo",
          detail: "Chip ainda não está ligado a um aparelho",
          severity: "neutral",
          sort: 20,
        });
      } else if (phone.device_slot) {
        occupiedSlots += 1;
      }

      if (rawStatus === "blocked") {
        if (!phone.restriction_ends_at) {
          restrictionsWithoutDeadline += 1;
          attention.push({
            id: phone.id,
            phone: phone.phone_number ?? "",
            label: "Restrição sem prazo",
            detail: "Defina quando a restrição deve encerrar",
            severity: "warning",
            sort: 75,
          });
        } else {
          const endsAt = new Date(phone.restriction_ends_at);
          const remainingMs = endsAt.getTime() - now.getTime();
          if (!Number.isNaN(remainingMs) && remainingMs <= 0) {
            expiredRestrictions += 1;
            attention.push({
              id: phone.id,
              phone: phone.phone_number ?? "",
              label: "Restrição vencida",
              detail: "Prazo encerrado e aguardando liberação",
              severity: "critical",
              sort: 100,
            });
          } else if (!Number.isNaN(remainingMs) && remainingMs <= dayMs) {
            restrictionsDueSoon += 1;
            attention.push({
              id: phone.id,
              phone: phone.phone_number ?? "",
              label: "Restrição perto do fim",
              detail: formatRestrictionCountdown(phone.restriction_ends_at, now),
              severity: "warning",
              sort: 80,
            });
          }

          if (!Number.isNaN(remainingMs) && remainingMs > 0) {
            if (!nextRestriction || endsAt.getTime() < nextRestriction.endsAtMs) {
              nextRestriction = {
                id: phone.id,
                phone: phone.phone_number ?? "",
                endsAt: phone.restriction_ends_at,
                endsAtMs: endsAt.getTime(),
              };
            }
          }
        }
      }
    }

    const totalCapacity = devices
      .filter((device) => device.is_active)
      .reduce((sum, device) => sum + (device.chip_capacity || 0), 0);
    const availableSlots = Math.max(totalCapacity - occupiedSlots, 0);
    const healthPercent =
      phones.length > 0 ? Math.round((statusCounts.working / phones.length) * 100) : 0;
    const deviceUsagePercent =
      totalCapacity > 0 ? Math.round((occupiedSlots / totalCapacity) * 100) : 0;

    return {
      totalNumbers: phones.length,
      statusCounts,
      healthPercent,
      expiredRestrictions,
      restrictionsDueSoon,
      restrictionsWithoutDeadline,
      withoutEmployee,
      withoutDevice,
      occupiedSlots,
      totalCapacity,
      availableSlots,
      deviceUsagePercent,
      nextRestriction,
      whatsappDistribution: toSortedEntries(whatsappCounts),
      attention: attention.sort((a, b) => b.sort - a.sort),
    };
  }, [dashboardQ.data, now]);

  const loading = dashboardQ.isLoading;
  const visibleAttention = showAllAttention ? model.attention : model.attention.slice(0, 5);
  const hiddenAttentionCount = Math.max(model.attention.length - visibleAttention.length, 0);
  const shouldShowAttention = loading || model.attention.length > 0;
  const nextRestrictionCountdown = model.nextRestriction
    ? formatRestrictionCountdown(model.nextRestriction.endsAt, now)
    : "Sem restrições";
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Início</h1>
          <p className="text-sm text-slate-600">
            Visão operacional dos números, dispositivos, restrições e notificações.
          </p>
        </div>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {model.nextRestriction ? (
            <Link
              to="/numeros/$id"
              params={{ id: model.nextRestriction.id }}
              className="block h-full"
            >
              <SignalCard
                title="Atenção Agora"
                value={nextRestrictionCountdown}
                detail={`Próxima: ${formatPhone(model.nextRestriction.phone)}`}
                icon={<AlertTriangle className="h-4 w-4" />}
                tone="warning"
                loading={loading}
              />
            </Link>
          ) : (
            <SignalCard
              title="Atenção Agora"
              value={nextRestrictionCountdown}
              detail="Nenhuma restrição com prazo"
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="good"
              loading={loading}
            />
          )}
          <SignalCard
            title="Saúde da Base"
            value={`${model.healthPercent}%`}
            detail={`${model.statusCounts.working} funcionando de ${model.totalNumbers}`}
            icon={<ShieldCheck className="h-4 w-4" />}
            tone={model.healthPercent >= 80 ? "good" : "neutral"}
            loading={loading}
          />
          <SignalCard
            title="Ocupação dos Chips"
            value={`${model.occupiedSlots}/${model.totalCapacity}`}
            detail={`${model.availableSlots} espaços livres em dispositivos`}
            icon={<Smartphone className="h-4 w-4" />}
            tone={model.availableSlots > 0 ? "neutral" : "warning"}
            loading={loading}
          />
          <Link
            to="/entrada"
            className={isAdmin ? "block h-full" : "pointer-events-none block h-full"}
          >
            <SignalCard
              title="Entrada"
              value={isAdmin ? (unreadNotificationsQ.data ?? 0) : "-"}
              detail={isAdmin ? "Notificações não lidas" : "Visível apenas para admin"}
              icon={<Bell className="h-4 w-4" />}
              tone={unreadNotificationsQ.data ? "warning" : "neutral"}
              loading={isAdmin ? unreadNotificationsQ.isLoading : false}
            />
          </Link>
        </section>

        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusMetric
            label={STATUS_LABEL.working}
            value={model.statusCounts.working}
            color="bg-emerald-500"
            loading={loading}
            status="working"
          />
          <StatusMetric
            label={STATUS_LABEL.blocked}
            value={model.statusCounts.blocked}
            color="bg-orange-500"
            loading={loading}
            status="blocked"
          />
          <StatusMetric
            label={STATUS_LABEL.under_review}
            value={model.statusCounts.under_review}
            color="bg-amber-400"
            loading={loading}
            status="under_review"
          />
          <StatusMetric
            label={STATUS_LABEL.deactivated}
            value={model.statusCounts.deactivated}
            color="bg-slate-400"
            loading={loading}
            status="deactivated"
          />
          <StatusMetric
            label={STATUS_LABEL.permanently_banned}
            value={model.statusCounts.permanently_banned}
            color="bg-zinc-950"
            loading={loading}
            status="permanently_banned"
          />
        </section>

        <div
          className={
            shouldShowAttention
              ? "grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]"
              : "grid gap-4"
          }
        >
          {shouldShowAttention && (
            <Card className="self-start">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Fila de Atenção</CardTitle>
                  <Badge variant="destructive">{model.attention.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <LoadingRows rows={3} height="h-14" />
                ) : (
                  <>
                    {visibleAttention.map((item) => (
                      <Link
                        key={`${item.id}-${item.label}`}
                        to="/numeros/$id"
                        params={{ id: item.id }}
                        className="flex items-center gap-3 rounded-md border bg-white px-3 py-2.5 transition-colors hover:border-slate-400"
                      >
                        <span className={severityDot(item.severity)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-950">
                              {formatPhone(item.phone)}
                            </span>
                            <span className="text-sm text-slate-600">{item.label}</span>
                          </div>
                          <div className="truncate text-xs text-slate-500">{item.detail}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    ))}
                    {hiddenAttentionCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAttention(true)}
                        className="w-full rounded-md border border-dashed bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950"
                      >
                        Ver mais {hiddenAttentionCount}
                      </button>
                    )}
                    {showAllAttention && model.attention.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAttention(false)}
                        className="w-full rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
                      >
                        Ver menos
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Resumo Operacional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <LoadingRows rows={4} height="h-10" />
                ) : (
                  <>
                    <ProgressBlock
                      label="Números Saudáveis"
                      value={model.healthPercent}
                      helper={`${model.statusCounts.working} de ${model.totalNumbers}`}
                    />
                    <ProgressBlock
                      label="Uso dos Dispositivos"
                      value={model.deviceUsagePercent}
                      helper={`${model.availableSlots} espaços livres`}
                    />
                    <MiniFacts
                      items={[
                        {
                          icon: <UserRoundX className="h-4 w-4" />,
                          label: "Sem Colaboradora",
                          value: model.withoutEmployee,
                        },
                        {
                          icon: <HardDrive className="h-4 w-4" />,
                          label: "Sem Dispositivo",
                          value: model.withoutDevice,
                        },
                        {
                          icon: <Clock3 className="h-4 w-4" />,
                          label: "Sem Prazo",
                          value: model.restrictionsWithoutDeadline,
                        },
                      ]}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <DistributionCard
              title="WhatsApp"
              items={model.whatsappDistribution}
              total={model.totalNumbers}
              loading={loading}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HistoryIcon className="h-4 w-4" />
                  Histórico Recente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <LoadingRows rows={5} height="h-12" />
                ) : (dashboardQ.data?.history ?? []).length === 0 ? (
                  <EmptyState
                    icon={<HistoryIcon className="h-5 w-5" />}
                    text="Nenhum evento recente."
                  />
                ) : (
                  dashboardQ.data?.history.map((item) => (
                    <div key={item.id} className="rounded-md border bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium text-slate-950">
                          {EVENT_LABEL[item.event_type as HistoryEvent] ?? item.event_type}
                        </div>
                        <div className="shrink-0 text-xs text-slate-500">
                          {formatDateTime(item.performed_at)}
                        </div>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {item.phone_numbers?.phone_number
                          ? formatPhone(item.phone_numbers.phone_number)
                          : "Número removido"}
                        {item.to?.name ? ` · ${item.to.name}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function SignalCard({
  title,
  value,
  detail,
  icon,
  tone,
  loading,
}: {
  title: string;
  value: number | string;
  detail: string;
  icon: ReactNode;
  tone: "good" | "warning" | "neutral";
  loading: boolean;
}) {
  const toneClass = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-orange-200 bg-orange-50 text-orange-700",
    neutral: "border-slate-200 bg-white text-slate-700",
  }[tone];

  return (
    <Card className={`${toneClass} h-full transition-colors hover:border-slate-400`}>
      <CardContent className="flex min-h-[124px] flex-col justify-between p-4">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{title}</span>
            <span className="shrink-0">{icon}</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-3xl font-semibold leading-none text-slate-950">{value}</div>
          )}
        </div>
        <div className="mt-3 text-xs leading-4 text-slate-600">{detail}</div>
      </CardContent>
    </Card>
  );
}

function StatusMetric({
  label,
  value,
  color,
  loading,
  status,
}: {
  label: string;
  value: number;
  color: string;
  loading: boolean;
  status: PhoneStatus;
}) {
  return (
    <Link to="/numeros" search={{ status }}>
      <Card className="h-full transition-colors hover:border-slate-400">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-slate-500">{label}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          </div>
          {loading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <div className="text-2xl font-semibold">{value}</div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ProgressBlock({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{value}%</span>
      </div>
      <Progress value={value} className="h-2 bg-slate-100" />
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function MiniFacts({
  items,
}: {
  items: Array<{
    icon: ReactNode;
    label: string;
    value: number;
  }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between rounded-md border bg-white px-3 py-2"
        >
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <span className="font-semibold text-slate-950">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function DistributionCard({
  title,
  items,
  total,
  loading,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  total: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <LoadingRows rows={4} height="h-8" />
        ) : items.length === 0 ? (
          <EmptyState icon={<Phone className="h-5 w-5" />} text="Sem dados para exibir." />
        ) : (
          items.map((item) => {
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{item.label}</span>
                  <span className="shrink-0 text-slate-500">{item.value}</span>
                </div>
                <Progress value={percent} className="h-2 bg-slate-100" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md border border-dashed bg-white px-3 py-8 text-sm text-slate-500">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function LoadingRows({ rows, height }: { rows: number; height: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={height} />
      ))}
    </div>
  );
}

function toSortedEntries(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function severityDot(severity: AttentionItem["severity"]) {
  if (severity === "critical") return "h-2.5 w-2.5 rounded-full bg-red-500";
  if (severity === "warning") return "h-2.5 w-2.5 rounded-full bg-orange-500";
  return "h-2.5 w-2.5 rounded-full bg-slate-400";
}
