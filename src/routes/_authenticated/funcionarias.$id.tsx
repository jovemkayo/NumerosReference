import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Phone, ChevronRight } from "lucide-react";
import {
  formatPhone,
  WHATSAPP_LABEL,
  type PhoneStatus,
  type WhatsappType,
} from "@/lib/phone-utils";

export const Route = createFileRoute("/_authenticated/funcionarias/$id")({
  head: () => ({ meta: [{ title: "Colaboradora — Controle WhatsApp" }] }),
  component: FuncionariaDetail,
});

function FuncionariaDetail() {
  const { id } = useParams({ from: "/_authenticated/funcionarias/$id" });

  const empQ = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const numsQ = useQuery({
    queryKey: ["employee-numbers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("id,phone_number,status,whatsapp_type,carrier_id,carriers(name)")
        .eq("current_employee_id", id)
        .order("phone_number");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Link
          to="/funcionarias"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>

        {empQ.isLoading ? (
          <Skeleton className="h-16 w-full mb-4" />
        ) : !empQ.data ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Colaboradora não encontrada.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                {empQ.data.name[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                  {empQ.data.name}
                  {!empQ.data.is_active && <Badge variant="secondary">Desativada</Badge>}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {numsQ.data?.length ?? 0} números atribuídos atualmente
                </p>
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-3">Números atribuídos</h2>
            {numsQ.isLoading ? (
              <div className="grid gap-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (numsQ.data ?? []).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum número atribuído.{" "}
                  <Link to="/numeros" className="text-primary underline">
                    Cadastrar número
                  </Link>
                  .
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {numsQ.data!.map((n) => (
                  <Link key={n.id} to="/numeros/$id" params={{ id: n.id }}>
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{formatPhone(n.phone_number)}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {n.carriers?.name ?? "Sem operadora"} ·{" "}
                            {WHATSAPP_LABEL[n.whatsapp_type as WhatsappType]}
                          </div>
                        </div>
                        <StatusBadge status={n.status as PhoneStatus} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
