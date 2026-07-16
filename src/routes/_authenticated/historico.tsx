import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EVENT_LABEL, STATUS_LABEL, STATUS_DOT, formatPhone, formatDateTime,
  type HistoryEvent, type PhoneStatus,
} from "@/lib/phone-utils";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico — Controle WhatsApp" }] }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const q = useQuery({
    queryKey: ["global-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_number_history")
        .select("id,event_type,performed_at,from_status,to_status,reason,phone_number_id,phone_numbers(phone_number),from:employees!from_employee_id(name),to:employees!to_employee_id(name),by:profiles!performed_by(full_name,email)")
        .order("performed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Histórico geral</h1>
          <p className="text-sm text-muted-foreground">Últimos 200 eventos registrados em todos os números.</p>
        </div>

        {q.isLoading ? (
          <div className="grid gap-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (q.data ?? []).length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum evento registrado.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <ol className="relative border-l border-border ml-2 space-y-4">
                {q.data!.map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className={`absolute -left-1.5 w-3 h-3 rounded-full ${h.to_status ? STATUS_DOT[h.to_status as PhoneStatus] : "bg-primary"}`} />
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link to="/numeros/$id" params={{ id: h.phone_number_id }} className="font-medium hover:underline">
                        {h.phone_numbers?.phone_number ? formatPhone(h.phone_numbers.phone_number) : "—"}
                      </Link>
                      <span className="text-sm">— {EVENT_LABEL[h.event_type as HistoryEvent]}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(h.performed_at)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5 space-y-0.5">
                      {h.from_status && h.to_status && (
                        <div>De <b>{STATUS_LABEL[h.from_status as PhoneStatus]}</b> para <b>{STATUS_LABEL[h.to_status as PhoneStatus]}</b></div>
                      )}
                      {(h.from?.name || h.to?.name) && (
                        <div>Responsável: {h.from?.name ? <>de <b>{h.from.name}</b> </> : ""}para <b>{h.to?.name ?? "—"}</b></div>
                      )}
                      {h.reason && <div>Motivo: {h.reason}</div>}
                      <div>Por: {h.by?.full_name || h.by?.email || "Sistema"}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
